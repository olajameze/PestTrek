import { checkPlan } from './planGuard';

export type AccessSnapshot = {
  plan?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | Date | null;
  paymentGraceEndsAt?: string | Date | null;
  paymentFailedAt?: string | Date | null;
};

function parseDateMs(value: AccessSnapshot['trialEndsAt']): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

/** True when a paid subscription invoice failed and access must stay locked until Stripe confirms payment. */
export function hasOutstandingPaymentFailure(snapshot: AccessSnapshot): boolean {
  if (parseDateMs(snapshot.paymentFailedAt)) {
    return true;
  }

  const status = snapshot.subscriptionStatus
    ? String(snapshot.subscriptionStatus).toLowerCase()
    : '';
  const planNorm = snapshot.plan ? String(snapshot.plan).toLowerCase().trim() : '';
  const hasPaidTierName =
    planNorm !== '' && checkPlan(planNorm, ['pro', 'business', 'enterprise']);

  return hasPaidTierName && (status === 'past_due' || status === 'unpaid');
}

export function subscriptionAccessBlockedMessage(snapshot: AccessSnapshot): string {
  if (hasOutstandingPaymentFailure(snapshot)) {
    return 'Your last payment failed. Update your card in Stripe billing to restore access.';
  }
  return 'Trial expired. Upgrade required to continue using Pest Trace.';
}

export function hasSubscriptionAccess(snapshot: AccessSnapshot, nowMs = Date.now()): boolean {
  if (hasOutstandingPaymentFailure(snapshot)) {
    return false;
  }

  const status = snapshot.subscriptionStatus ? String(snapshot.subscriptionStatus).toLowerCase() : '';
  const planNorm = snapshot.plan ? String(snapshot.plan).toLowerCase().trim() : '';
  const hasPaidTierName =
    planNorm !== '' && checkPlan(planNorm, ['pro', 'business', 'enterprise']);

  const stripeSupportsPaidSku = status === 'active' || status === 'trialing';

  if (hasPaidTierName && stripeSupportsPaidSku) {
    return true;
  }

  if (status === 'active' || status === 'trialing') {
    return true;
  }

  const graceEndMs = parseDateMs(snapshot.paymentGraceEndsAt);
  return graceEndMs !== null && graceEndMs > nowMs;
}

/** True when trial is still active but signup checkout (Stripe subscription) is not complete. */
export function needsSignupCheckout(snapshot: AccessSnapshot, nowMs = Date.now()): boolean {
  const trialEndMs = parseDateMs(snapshot.trialEndsAt);
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
  if (hasOutstandingPaymentFailure(snapshot)) {
    return null;
  }

  const graceEndMs = parseDateMs(snapshot.paymentGraceEndsAt);
  if (graceEndMs === null || graceEndMs <= nowMs) {
    return null;
  }
  return Math.max(1, Math.ceil((graceEndMs - nowMs) / (1000 * 60 * 60 * 24)));
}
