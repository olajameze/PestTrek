import { expect, test } from '@playwright/test';
import {
  hasOutstandingPaymentFailure,
  hasSubscriptionAccess,
  needsSignupCheckout,
} from '../lib/subscriptionAccess';
import { formatTrialChargeDate } from '../lib/stripe/signupCheckout';

const futureTrialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastTrialEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const futureGraceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const pastPaymentFailedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();

test.describe('signup checkout access', () => {
  test('denies access for active trial without Stripe subscription', () => {
    expect(
      hasSubscriptionAccess({
        plan: 'trial',
        subscriptionStatus: 'trial',
        trialEndsAt: futureTrialEnd,
      }),
    ).toBe(false);
  });

  test('grants access after signup checkout with Pro subscription', () => {
    expect(
      hasSubscriptionAccess({
        plan: 'pro',
        subscriptionStatus: 'active',
        trialEndsAt: futureTrialEnd,
      }),
    ).toBe(true);
  });

  test('needsSignupCheckout when trial active but checkout incomplete', () => {
    expect(
      needsSignupCheckout({
        plan: 'trial',
        subscriptionStatus: 'trial',
        trialEndsAt: futureTrialEnd,
      }),
    ).toBe(true);
  });

  test('needsSignupCheckout is false after checkout completes', () => {
    expect(
      needsSignupCheckout({
        plan: 'pro',
        subscriptionStatus: 'active',
        trialEndsAt: futureTrialEnd,
      }),
    ).toBe(false);
  });

  test('needsSignupCheckout is false when trial expired', () => {
    expect(
      needsSignupCheckout({
        plan: 'trial',
        subscriptionStatus: 'trial',
        trialEndsAt: pastTrialEnd,
      }),
    ).toBe(false);
  });

  test('payment grace still grants access without signup checkout', () => {
    expect(
      hasSubscriptionAccess({
        plan: 'trial',
        subscriptionStatus: 'canceled',
        trialEndsAt: pastTrialEnd,
        paymentGraceEndsAt: futureGraceEnd,
      }),
    ).toBe(true);
  });

  test('blocks access immediately when paymentFailedAt is set', () => {
    expect(
      hasSubscriptionAccess({
        plan: 'pro',
        subscriptionStatus: 'past_due',
        paymentFailedAt: pastPaymentFailedAt,
        paymentGraceEndsAt: futureGraceEnd,
      }),
    ).toBe(false);
    expect(
      hasOutstandingPaymentFailure({
        plan: 'pro',
        subscriptionStatus: 'past_due',
        paymentFailedAt: pastPaymentFailedAt,
      }),
    ).toBe(true);
  });

  test('blocks access for past_due paid subscriptions even without paymentFailedAt flag', () => {
    expect(
      hasSubscriptionAccess({
        plan: 'pro',
        subscriptionStatus: 'past_due',
      }),
    ).toBe(false);
  });

  test('formatTrialChargeDate returns en-GB label', () => {
    expect(formatTrialChargeDate('2026-06-14T00:00:00.000Z')).toMatch(/14 June 2026/);
  });
});
