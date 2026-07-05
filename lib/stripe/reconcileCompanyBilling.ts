import Stripe from 'stripe';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { stripeSubscriptionBillingSnapshot } from './subscriptionBilling';

const API_VERSION = '2024-06-20' as const;
const GRACE_PERIOD_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildGraceEnd(fromDate: Date) {
  return new Date(fromDate.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
}

const PAYING_SUB_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
]);

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  const isValidPrefix = key?.startsWith('sk_') || key?.startsWith('rk_');
  if (
    !key ||
    key.trim().length === 0 ||
    !isValidPrefix ||
    key === 'sk_test_...' ||
    key.includes('your-secret-key')
  ) {
    return null;
  }
  return new Stripe(key, { apiVersion: API_VERSION });
}

/** Align with webhooks / UI: Stripe `trialing` is treated as paid. */
export function subscriptionStatusForDb(stripeStatus: string): string {
  const s = String(stripeStatus).toLowerCase();
  if (s === 'active' || s === 'trialing') return 'active';
  return s;
}

/**
 * Writes latest subscription state from Stripe into Company (fixes missed webhooks / test mode).
 */
export async function reconcileCompanyBillingFromStripe(companyId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { stripeCustomerId: true, plan: true, paymentFailedAt: true, paymentGraceEndsAt: true },
  });

  const customerId = company?.stripeCustomerId?.trim();
  if (!customerId) return;

  let subs: Stripe.Response<Stripe.ApiList<Stripe.Subscription>>;
  try {
    subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 25,
    });
  } catch {
    return;
  }

  const sub = subs.data.find((s) => PAYING_SUB_STATUSES.has(s.status));
  if (!sub) {
    const row = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionStatus: true },
    });
    const st = (row?.subscriptionStatus ?? '').toLowerCase();
    if (st === 'active' || st === 'trialing' || st === 'past_due' || st === 'unpaid') {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          subscriptionStatus: 'canceled',
          subscriptionPeriodEndAt: null,
          subscriptionCancelAtPeriodEnd: false,
        },
      });
    }
    return;
  }

  const dbStatus = subscriptionStatusForDb(sub.status);
  const validPlans = ['pro', 'business', 'enterprise'] as const;
  const fromMeta = validPlans.find((p) => p === sub.metadata?.plan);
  const current = String(company?.plan ?? '').toLowerCase().trim();
  const fromExisting = validPlans.find((p) => p === current);
  const resolvedPlan = fromMeta ?? fromExisting;

  const snap = stripeSubscriptionBillingSnapshot(sub);
  const now = new Date();
  const delinquent = dbStatus === 'past_due' || dbStatus === 'unpaid';

  const data: Prisma.CompanyUpdateInput = {
    subscriptionStatus: dbStatus,
    subscriptionPeriodEndAt: snap.periodEnd,
    subscriptionCancelAtPeriodEnd: snap.cancelAtPeriodEnd,
    trialEndsAt: null,
    ...(resolvedPlan ? { plan: resolvedPlan } : {}),
    ...(dbStatus === 'active'
      ? {
          paymentFailedAt: null,
          paymentGraceEndsAt: null,
          nonPaymentCanceledAt: null,
        }
      : delinquent
        ? {
            paymentFailedAt: company?.paymentFailedAt ?? now,
            paymentGraceEndsAt: company?.paymentGraceEndsAt ?? buildGraceEnd(now),
          }
        : {}),
  };

  await prisma.company.update({
    where: { id: companyId },
    data,
  });
}
