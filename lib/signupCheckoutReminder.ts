import { needsSignupCheckout, type AccessSnapshot } from './subscriptionAccess';

export const SIGNUP_CHECKOUT_REMINDER_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type SignupCheckoutReminderCandidate = {
  email: string;
  createdAt: Date | null;
  trialEndsAt: Date | null;
  plan: string | null;
  subscriptionStatus: string | null;
  notificationPreferences: unknown;
};

export function parseSignupCheckoutReminderSentAt(notificationPreferences: unknown): string | null {
  if (
    !notificationPreferences ||
    typeof notificationPreferences !== 'object' ||
    Array.isArray(notificationPreferences)
  ) {
    return null;
  }
  const value = (notificationPreferences as Record<string, unknown>).signupCheckoutReminderSentAt;
  return typeof value === 'string' ? value : null;
}

export function withSignupCheckoutReminderSent(
  notificationPreferences: unknown,
  at: string,
): Record<string, unknown> {
  const base =
    notificationPreferences &&
    typeof notificationPreferences === 'object' &&
    !Array.isArray(notificationPreferences)
      ? (notificationPreferences as Record<string, unknown>)
      : {};
  return { ...base, signupCheckoutReminderSentAt: at };
}

export function isEligibleForSignupCheckoutReminder(
  company: SignupCheckoutReminderCandidate,
  nowMs = Date.now(),
): boolean {
  if (!company.email?.trim()) return false;
  if (parseSignupCheckoutReminderSentAt(company.notificationPreferences)) return false;

  const createdAtMs = company.createdAt?.getTime();
  if (!createdAtMs || nowMs - createdAtMs < SIGNUP_CHECKOUT_REMINDER_MIN_AGE_MS) {
    return false;
  }

  const snapshot: AccessSnapshot = {
    plan: company.plan,
    subscriptionStatus: company.subscriptionStatus,
    trialEndsAt: company.trialEndsAt,
  };

  return needsSignupCheckout(snapshot, nowMs);
}
