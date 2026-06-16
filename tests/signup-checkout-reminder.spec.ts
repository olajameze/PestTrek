import { expect, test } from '@playwright/test';
import {
  isEligibleForSignupCheckoutReminder,
  parseSignupCheckoutReminderSentAt,
  SIGNUP_CHECKOUT_REMINDER_MIN_AGE_MS,
  withSignupCheckoutReminderSent,
} from '../lib/signupCheckoutReminder';

const futureTrialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const nowMs = Date.now();

function candidate(overrides: Partial<Parameters<typeof isEligibleForSignupCheckoutReminder>[0]> = {}) {
  return {
    email: 'owner@example.com',
    createdAt: new Date(nowMs - SIGNUP_CHECKOUT_REMINDER_MIN_AGE_MS - 60_000),
    trialEndsAt: futureTrialEnd,
    plan: 'trial',
    subscriptionStatus: 'trial',
    notificationPreferences: null,
    ...overrides,
  };
}

test.describe('signup checkout reminder eligibility', () => {
  test('eligible when trial active, checkout incomplete, and account older than 24h', () => {
    expect(isEligibleForSignupCheckoutReminder(candidate(), nowMs)).toBe(true);
  });

  test('not eligible when company created within 24 hours', () => {
    expect(
      isEligibleForSignupCheckoutReminder(
        candidate({ createdAt: new Date(nowMs - 60 * 60 * 1000) }),
        nowMs,
      ),
    ).toBe(false);
  });

  test('not eligible when reminder already sent', () => {
    expect(
      isEligibleForSignupCheckoutReminder(
        candidate({
          notificationPreferences: withSignupCheckoutReminderSent(null, new Date().toISOString()),
        }),
        nowMs,
      ),
    ).toBe(false);
  });

  test('not eligible when signup checkout completed', () => {
    expect(
      isEligibleForSignupCheckoutReminder(
        candidate({ plan: 'pro', subscriptionStatus: 'active' }),
        nowMs,
      ),
    ).toBe(false);
  });

  test('not eligible when trial expired', () => {
    expect(
      isEligibleForSignupCheckoutReminder(
        candidate({ trialEndsAt: new Date(nowMs - 60_000) }),
        nowMs,
      ),
    ).toBe(false);
  });

  test('parseSignupCheckoutReminderSentAt reads stored timestamp', () => {
    const at = '2026-06-01T09:00:00.000Z';
    expect(parseSignupCheckoutReminderSentAt(withSignupCheckoutReminderSent({}, at))).toBe(at);
  });
});
