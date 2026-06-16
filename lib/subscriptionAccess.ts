import { checkPlan } from './planGuard';

export type AccessSnapshot = {
  plan?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | Date | null;
  paymentGraceEndsAt?: string | Date | null;
};

function parseTrialEnd(value: AccessSnapshot['trialEndsAt']): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function hasSubscriptionAccess(snapshot: AccessSnapshot, nowMs = Date.now()): boolean {
  const status = snapshot.subscriptionStatus ? String(snapshot.subscriptionStatus).toLowerCase() : '';
  const planNorm = snapshot.plan ? String(snapshot.plan).toLowerCase().trim() : '';
  const hasPaidTierName =
    planNorm !== '' && checkPlan(planNorm, ['pro', 'business', 'enterprise']);

  // Stripe billing states that retain product access pending payment / webhook grace flows.
  const stripeSupportsPaidSku =
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'unpaid';

  if (hasPaidTierName && stripeSupportsPaidSku) {
    return true;
  }

  // Active/trialing even if plan slug drifted
  if (status === 'active' || status === 'trialing') {
    return true;
  }

  const graceEndMs = parseTrialEnd(snapshot.paymentGraceEndsAt);
  return graceEndMs !== null && graceEndMs > nowMs;
}

/** True when trial is still active but signup checkout (Stripe subscription) is not complete. */
export function needsSignupCheckout(snapshot: AccessSnapshot, nowMs = Date.now()): boolean {
  const trialEndMs = parseTrialEnd(snapshot.trialEndsAt);
  if (trialEndMs === null || trialEndMs <= nowMs) {
    return false;
  }
  return !hasSubscriptionAccess(snapshot, nowMs);
}

/** Billing badge: paid tier when Stripe shows an active-ish billing lifecycle. */
export function formatOwnerBillingPlanLabel(
  snapshot: Pick<AccessSnapshot, 'plan' | 'subscriptionStatus'>,
): string {
  const plan = String(snapshot.plan ?? 'trial').toLowerCase().trim();
  const status = snapshot.subscriptionStatus
    ? String(snapshot.subscriptionStatus).toLowerCase().trim()
    : '';

  const isPaidTier = checkPlan(plan, ['pro', 'business', 'enterprise']);
  const showsPaidStripeLabel =
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'unpaid';

  if (showsPaidStripeLabel && isPaidTier) {
    return plan;
  }

  if (isPaidTier && !showsPaidStripeLabel) {
    return 'free trial';
  }

  if (plan === 'free') {
    return 'free';
  }

  return 'free trial';
}

/** Stripe portal: manage / cancel — not limited to legacy `subscriptionStatus === 'active'`. */
export function ownerCanManagePaidPlanInStripe(snapshot: {
  plan?: string | null;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string | null;
}): boolean {
  if (!snapshot.stripeCustomerId?.trim()) return false;
  const planNorm = String(snapshot.plan ?? '').toLowerCase().trim();
  if (!checkPlan(planNorm, ['pro', 'business', 'enterprise'])) return false;
  const s = snapshot.subscriptionStatus
    ? String(snapshot.subscriptionStatus).toLowerCase().trim()
    : '';
  const ended = new Set(['canceled', 'cancelled', 'incomplete_expired']);
  return !ended.has(s);
}

export function getGraceDaysLeft(snapshot: AccessSnapshot, nowMs = Date.now()): number | null {
  const graceEndMs = parseTrialEnd(snapshot.paymentGraceEndsAt);
  if (graceEndMs === null || graceEndMs <= nowMs) {
    return null;
  }
  return Math.max(1, Math.ceil((graceEndMs - nowMs) / (1000 * 60 * 60 * 24)));
}

