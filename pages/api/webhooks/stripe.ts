import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import { sendSubscriptionUpgradeEmail } from '../subscription';
import { reconcileCompanyBillingFromStripe, subscriptionStatusForDb } from '../../../lib/stripe/reconcileCompanyBilling';
import { stripeSubscriptionBillingSnapshot } from '../../../lib/stripe/subscriptionBilling';
import { sendSubscriptionCancellationScheduledEmail } from '../../../lib/email';

const GRACE_PERIOD_DAYS = 5;
const RETRIAL_PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildGraceEnd(fromDate: Date) {
  return new Date(fromDate.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
}

function buildRetrialEnd(fromDate: Date) {
  return new Date(fromDate.getTime() + RETRIAL_PERIOD_DAYS * DAY_MS);
}

async function clearGraceMetadata(stripeCustomerId: string) {
  await prisma.company.updateMany({
    where: { stripeCustomerId },
    data: {
      paymentFailedAt: null,
      paymentGraceEndsAt: null,
      nonPaymentCanceledAt: null,
    },
  });
}

async function applyExpiredGracePolicy(stripeCustomerId: string, now = new Date()) {
  const company = await prisma.company.findUnique({
    where: { stripeCustomerId },
    select: {
      id: true,
      paymentGraceEndsAt: true,
      retrialGrantedAt: true,
    },
  });

  if (!company?.paymentGraceEndsAt || company.paymentGraceEndsAt.getTime() > now.getTime()) {
    return;
  }

  if (!company.retrialGrantedAt) {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: 'trial',
        plan: 'trial',
        trialEndsAt: buildRetrialEnd(now),
        retrialGrantedAt: now,
        nonPaymentCanceledAt: now,
        paymentFailedAt: null,
        paymentGraceEndsAt: null,
      },
    });
    return;
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscriptionStatus: 'canceled',
      nonPaymentCanceledAt: now,
      trialEndsAt: null,
      paymentFailedAt: null,
      paymentGraceEndsAt: null,
    },
  });
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  const isValidPrefix = key?.startsWith('sk_') || key?.startsWith('rk_');
  
  if (
    !key || 
    key.trim().length === 0 || 
    !isValidPrefix ||
    key === 'sk_test_...' || 
    key.includes('your-secret-key')
  ) {
    throw new Error('Stripe Secret Key is missing or using a placeholder value. Please update STRIPE_SECRET_KEY in .env.local with your actual key starting with sk_test_');
  }
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

function stripeCustomerFromEvent(event: Stripe.Event): string | null {
  try {
    const obj = event.data.object as { customer?: string | string[] | null };
    const c = obj?.customer;
    return typeof c === 'string' ? c : null;
  } catch {
    return null;
  }
}

const getWebhookSecret = () => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.includes('whsec_...')) {
    throw new Error('STRIPE_WEBHOOK_SECRET is missing or using a placeholder.');
  }
  return secret;
};

/**
 * Helper to read the raw body from the request.
 * Required for Stripe signature verification when bodyParser is disabled.
 */
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let webhookSecret: string;
  try {
    webhookSecret = getWebhookSecret();
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const sig = req.headers['stripe-signature'] as string;
  if (!sig) return res.status(400).send('Webhook Error: Missing stripe-signature header.');

  let event: Stripe.Event;

  const stripe = (() => {
    try {
      return getStripe();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return message;
    }
  })();
  if (typeof stripe === 'string') {
    logger.error(`Stripe initialization error in webhook: ${stripe}`);
    return res.status(500).json({ error: 'Internal server error' });
  }

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Webhook signature verification failed: ${errorMessage}`);
    return res.status(400).send(`Webhook Error: ${errorMessage}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : null;
        const clientReferenceId = session.client_reference_id;

        // client_reference_id was set in create-checkout-session.ts as "companyId:plan"
        if (clientReferenceId && stripeCustomerId) {
          const [companyId, plan] = clientReferenceId.split(':');
          const validPlans = ['pro', 'business', 'enterprise'] as const;
          const resolvedPlan = validPlans.find((p) => p === plan) ?? 'pro';

          await prisma.company.update({
            where: { id: companyId },
            data: {
              stripeCustomerId,
              plan: resolvedPlan,
            },
          });

          await reconcileCompanyBillingFromStripe(companyId);

          await sendSubscriptionUpgradeEmail(companyId, resolvedPlan);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;
        const rawStatus = subscription.status;
        const dbStatus = subscriptionStatusForDb(rawStatus);
        const plan = subscription.metadata.plan;

        const validPlans = ['pro', 'business', 'enterprise'] as const;
        const resolvedPlan = validPlans.find((p) => p === plan);

        const snap = stripeSubscriptionBillingSnapshot(subscription);
        const periodEnd = snap.periodEnd;
        const cancelAtPeriodEnd = snap.cancelAtPeriodEnd;

        const companyRow = await prisma.company.findFirst({
          where: { stripeCustomerId },
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            subscriptionCancelAtPeriodEnd: true,
          },
        });

        if (!companyRow) {
          break;
        }

        const wasScheduled = Boolean(companyRow.subscriptionCancelAtPeriodEnd);
        const planForEmail = resolvedPlan ?? String(companyRow.plan ?? 'pro').toLowerCase();

        await prisma.company.update({
          where: { id: companyRow.id },
          data: {
            subscriptionStatus: dbStatus,
            subscriptionPeriodEndAt: periodEnd,
            subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
            ...(resolvedPlan && { plan: resolvedPlan }),
            ...(dbStatus === 'active' && {
              trialEndsAt: null,
              paymentFailedAt: null,
              paymentGraceEndsAt: null,
              nonPaymentCanceledAt: null,
            }),
          },
        });

        if (cancelAtPeriodEnd && !wasScheduled && companyRow.email?.trim()) {
          try {
            await sendSubscriptionCancellationScheduledEmail({
              email: companyRow.email.trim(),
              companyName: companyRow.name,
              plan: planForEmail,
              accessEndsAt: periodEnd,
            });
          } catch (emailErr) {
            logger.error(
              `Cancel-at-period-end email failed: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`,
            );
          }
        }

        if (dbStatus !== 'active') {
          await applyExpiredGracePolicy(stripeCustomerId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string | null;
        if (!stripeCustomerId) break;

        const failedAt = new Date(event.created * 1000);
        await prisma.company.updateMany({
          where: { stripeCustomerId },
          data: {
            paymentFailedAt: failedAt,
            paymentGraceEndsAt: buildGraceEnd(failedAt),
          },
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string | null;
        if (!stripeCustomerId) break;
        await clearGraceMetadata(stripeCustomerId);

        const company = await prisma.company.findUnique({
          where: { stripeCustomerId },
          select: { id: true },
        });
        if (company?.id) {
          await reconcileCompanyBillingFromStripe(company.id);
        }

        if (invoice.billing_reason === 'subscription_cycle') {
          logger.info(
            `Post-trial subscription invoice paid: customer=${stripeCustomerId} invoice=${invoice.id}`,
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;

        await applyExpiredGracePolicy(stripeCustomerId);

        const company = await prisma.company.findUnique({
          where: { stripeCustomerId },
          select: { id: true, subscriptionStatus: true },
        });

        if (company?.id) {
          await reconcileCompanyBillingFromStripe(company.id);
        }

        const fresh = await prisma.company.findUnique({
          where: { stripeCustomerId },
          select: { subscriptionStatus: true },
        });
        const st = (fresh?.subscriptionStatus ?? '').toLowerCase();
        if (st === 'active' || st === 'trialing') {
          break;
        }

        if (fresh?.subscriptionStatus !== 'trial') {
          await prisma.company.updateMany({
            where: { stripeCustomerId },
            data: {
              subscriptionStatus: 'canceled',
              subscriptionPeriodEndAt: null,
              subscriptionCancelAtPeriodEnd: false,
            },
          });
        }
        break;
      }
    }

    try {
      await prisma.backgroundJobRun.upsert({
        where: { jobName: 'stripe_webhook' },
        create: {
          jobName: 'stripe_webhook',
          lastFinishedAt: new Date(),
          status: 'ok',
          detail: { eventType: event.type, eventId: event.id },
        },
        update: {
          lastFinishedAt: new Date(),
          status: 'ok',
          detail: { eventType: event.type, eventId: event.id },
        },
      });
    } catch {
      /* non-fatal bookkeeping */
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Webhook processing failed: ${errorMessage}`);
    try {
      await prisma.webhookError.create({
        data: {
          eventType: event.type,
          stripeEventId: event.id,
          errorMessage,
          payload: { stripeCustomerId: stripeCustomerFromEvent(event) },
        },
      });
    } catch {
      /* ignore persistence failures */
    }
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};