import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { normalizeAuthEmail } from '../../lib/auth/userSession';
import { technicianEmailWhere } from '../../lib/auth/technicianGate';
import { listStripePortalReturnUrlCandidates } from '../../lib/siteOrigin';

function stripeReturnHostLog(returnUrl: string): string {
  try {
    return new URL(returnUrl).hostname || '(bad-url)';
  } catch {
    return '(bad-url)';
  }
}

function parseStripePortalError(error: unknown): {
  message: string;
  code?: string;
  type?: string;
  param?: string;
} {
  if (typeof error === 'object' && error !== null) {
    const o = error as Record<string, unknown>;
    const message = typeof o.message === 'string' ? o.message : 'Stripe request failed';
    const code = typeof o.code === 'string' ? o.code : undefined;
    const type = typeof o.type === 'string' ? o.type : undefined;
    let param = typeof o.param === 'string' ? o.param : undefined;
    if (!param && o.raw && typeof o.raw === 'object' && o.raw !== null) {
      const raw = (o.raw as Record<string, unknown>).param;
      if (typeof raw === 'string') param = raw;
    }
    return { message, code, type, param };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

function isStripePortalReturnUrlRejection(error: unknown): boolean {
  const p = parseStripePortalError(error);
  const blob = `${p.message} ${p.code ?? ''} ${p.param ?? ''}`.toLowerCase();
  return /not a valid url|invalid url|url_invalid|\breturn_url\b/.test(blob);
}

function portalFailureHint(parsed: { message: string; code?: string }): string | undefined {
  const blob = `${parsed.message} ${parsed.code ?? ''}`.toLowerCase();
  if (blob.includes('not a valid url') || blob.includes('return_url') || parsed.code === 'url_invalid') {
    return 'Allow your dashboard domain in Stripe → Settings → Billing → Customer portal. For Vercel previews use a wildcard like https://*.vercel.app, or set STRIPE_PORTAL_RETURN_URL to your production https://…/dashboard?tab=settings.';
  }
  if (
    parsed.code === 'resource_missing' ||
    (blob.includes('configuration') && blob.includes('portal')) ||
    blob.includes('default customer portal configuration')
  ) {
    return 'Activate Customer portal in Stripe Dashboard (Billing → Customer portal) and save a configuration, or set STRIPE_BILLING_PORTAL_CONFIGURATION_ID to a bpc_… id from the API/Dashboard.';
  }
  if (blob.includes('no such customer')) {
    return 'This Stripe customer id is not in the same mode as STRIPE_SECRET_KEY (test vs live).';
  }
  return undefined;
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
    throw new Error(
      'Stripe Secret Key is missing or using a placeholder value. Please update STRIPE_SECRET_KEY in .env.local with your actual key starting with sk_test_',
    );
  }
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

const PORTAL_CANCEL_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stripe = (() => {
    try {
      return getStripe();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Stripe initialization failed: ${message}`);
      return null;
    }
  })();
  if (!stripe) return res.status(500).json({ error: 'Payment service configuration error.' });

  const authEmail = normalizeAuthEmail(user.email);
  const company = await prisma.company.findUnique({
    where: { email: authEmail },
  });

  if (!company) {
    const technician = await prisma.technician.findFirst({
      where: technicianEmailWhere(authEmail),
      select: { id: true },
    });
    if (technician) {
      return res.status(403).json({
        error: 'Technician accounts cannot access billing portal.',
        code: 'ROLE_TECHNICIAN',
      });
    }
  }

  if (!company?.stripeCustomerId) {
    return res.status(400).json({ error: 'No Stripe customer configured for this account.' });
  }

  const returnUrlCandidates = listStripePortalReturnUrlCandidates(req);
  if (!returnUrlCandidates.length) {
    logger.error('Billing portal: no return URLs could be resolved — set NEXT_PUBLIC_APP_URL');
    return res.status(500).json({
      error:
        'Billing redirects are misconfigured. Set NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL or STRIPE_PORTAL_RETURN_URL.',
    });
  }

  const intentRaw =
    typeof req.body?.intent === 'string'
      ? req.body.intent
      : typeof req.body?.flow === 'string'
        ? req.body.flow
        : '';
  const intentLower = intentRaw.toLowerCase();
  const intent =
    intentLower === 'cancel' || intentLower === 'subscription_cancel'
      ? 'cancel'
      : intentLower === 'payment_update' ||
          intentLower === 'payment_method_update' ||
          intentLower === 'update_payment'
        ? 'payment_update'
        : 'manage';

  const configurationId = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim();

  /** Try each plausible return_url then, on Stripe URL rejection, Stripe default config (omit bpc_). */
  const customerId = company.stripeCustomerId.trim();
  let lastError: unknown;
  let attemptedReturnHostname = '';

  try {
    let cancelSubscriptionId: string | undefined;
    if (intent === 'cancel') {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 30,
      });
      const target = list.data.find((s) => PORTAL_CANCEL_STATUSES.has(s.status));
      if (!target) {
        return res.status(400).json({
          error:
            'No cancellable subscription found on this account. Try “Manage subscription”, or contact support.',
        });
      }
      cancelSubscriptionId = target.id;
    }

    const configVariants: boolean[] = configurationId ? [true, false] : [false];

    if (intent === 'payment_update') {
      for (const returnUrl of returnUrlCandidates) {
        attemptedReturnHostname = stripeReturnHostLog(returnUrl);
        for (const withConfig of configVariants) {
          try {
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: returnUrl,
              ...(withConfig && configurationId ? { configuration: configurationId } : {}),
              flow_data: {
                type: 'payment_method_update',
              },
            });
            return res.status(200).json({ url: portalSession.url });
          } catch (flowErr) {
            lastError = flowErr;
            const parsedFlow = parseStripePortalError(flowErr);
            if (isStripePortalReturnUrlRejection(flowErr)) {
              logger.warn(
                `Stripe portal payment-update URL reject (retry): ${parsedFlow.message} stripeParam=${parsedFlow.param ?? ''} use_bpc=${withConfig} return_host=${attemptedReturnHostname}`,
              );
              continue;
            }
            logger.warn(
              `Stripe portal payment-update deep-link failed, trying default portal: ${parsedFlow.message} code=${parsedFlow.code ?? ''} return_host=${attemptedReturnHostname}`,
            );
            break;
          }
        }
      }
    }

    for (const returnUrl of returnUrlCandidates) {
      attemptedReturnHostname = stripeReturnHostLog(returnUrl);

      if (intent === 'cancel' && cancelSubscriptionId) {
        for (const withConfig of configVariants) {
          try {
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: returnUrl,
              ...(withConfig && configurationId ? { configuration: configurationId } : {}),
              flow_data: {
                type: 'subscription_cancel',
                subscription_cancel: {
                  subscription: cancelSubscriptionId,
                },
              },
            });
            return res.status(200).json({ url: portalSession.url });
          } catch (flowErr) {
            lastError = flowErr;
            const parsedFlow = parseStripePortalError(flowErr);
            if (isStripePortalReturnUrlRejection(flowErr)) {
              logger.warn(
                `Stripe portal cancel-flow URL reject (retry): ${parsedFlow.message} stripeParam=${parsedFlow.param ?? ''} use_bpc=${withConfig} return_host=${attemptedReturnHostname}`,
              );
              continue;
            }
            logger.warn(
              `Stripe portal cancel deep-link failed, trying default portal: ${parsedFlow.message} code=${parsedFlow.code ?? ''} return_host=${attemptedReturnHostname}`,
            );
            break;
          }
        }
      }

      for (const withConfig of configVariants) {
        try {
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
            ...(withConfig && configurationId ? { configuration: configurationId } : {}),
          });
          return res.status(200).json({ url: portalSession.url });
        } catch (err) {
          lastError = err;
          const parsed = parseStripePortalError(err);
          if (isStripePortalReturnUrlRejection(err)) {
            logger.warn(
              `Stripe billing portal URL reject (retry): ${parsed.message} stripeParam=${parsed.param ?? ''} use_bpc=${withConfig} return_host=${attemptedReturnHostname}`,
            );
            continue;
          }
          logger.error(
            `Stripe billingPortal.sessions.create failed: ${parsed.message} code=${parsed.code ?? ''} type=${parsed.type ?? ''} param=${parsed.param ?? ''} return_host=${attemptedReturnHostname}`,
          );
          const hint = portalFailureHint(parsed);
          return res.status(500).json({
            error: parsed.message,
            ...(parsed.code ? { stripeCode: parsed.code } : {}),
            ...(parsed.param ? { stripeParam: parsed.param } : {}),
            ...(hint ? { hint } : {}),
          });
        }
      }
    }

    const parsed = parseStripePortalError(
      lastError ?? new Error('Billing portal could not start — Stripe rejected every return URL.'),
    );
    logger.error(
      `Stripe billing portal exhausted return_url candidates: ${parsed.message} code=${parsed.code ?? ''} param=${parsed.param ?? ''} last_return_host=${attemptedReturnHostname}`,
    );
    const hint = portalFailureHint(parsed);
    return res.status(500).json({
      error: parsed.message,
      ...(parsed.code ? { stripeCode: parsed.code } : {}),
      ...(parsed.param ? { stripeParam: parsed.param } : {}),
      ...(hint ? { hint } : {}),
      attemptedReturnHosts: returnUrlCandidates.map((u) => stripeReturnHostLog(u)),
    });
  } catch (error) {
    const parsed = parseStripePortalError(error);
    logger.error(
      `Billing portal unexpected failure: ${parsed.message} code=${parsed.code ?? ''} type=${parsed.type ?? ''} param=${parsed.param ?? ''}`,
    );
    const hint = portalFailureHint(parsed);
    return res.status(500).json({
      error: parsed.message,
      ...(parsed.code ? { stripeCode: parsed.code } : {}),
      ...(parsed.param ? { stripeParam: parsed.param } : {}),
      ...(hint ? { hint } : {}),
    });
  }
}
