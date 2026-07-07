# Stripe checkout and webhook — manual E2E (test mode)

Use this checklist to confirm upgrades update `Company.plan` and unlock gated APIs.

**Automated (no Stripe keys):**

- `npx playwright test tests/stripe-webhook.spec.ts` — webhook signature rejection
- `npx playwright test tests/checkout-trial.spec.ts` — `trial_end` alignment helper

## Prerequisites

1. `.env.local` with valid **test** keys:
   - `STRIPE_SECRET_KEY` (`sk_test_…`)
   - `STRIPE_WEBHOOK_SECRET` (`whsec_…` from Stripe CLI or Dashboard webhook)
   - `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_BUSINESS`, `STRIPE_PRICE_ID_ENTERPRISE` (monthly `price_…`)
   - `STRIPE_PRICE_ID_PRO_ANNUAL`, `STRIPE_PRICE_ID_BUSINESS_ANNUAL`, `STRIPE_PRICE_ID_ENTERPRISE_ANNUAL` (yearly `price_…`)
   - `DATABASE_URL`, `DIRECT_URL`, Supabase vars (see [`.env.example`](../.env.example))
2. Local app: `npm run dev` (default `http://localhost:3000`).

## Stripe Dashboard checklist (before live)

1. **Products → each plan price** must be **recurring** (`month` or `year`) with **no trial days** on the Price itself (trial is set at Checkout via `subscription_data.trial_end` from `Company.trialEndsAt`). A price-level trial stacks incorrectly with the app trial. Checkout sends `{ plan, interval: "month" | "year" }` and validates the Stripe price interval matches.
2. **Webhooks** endpoint must deliver at least:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
3. Production URL: `POST https://<your-domain>/api/webhooks/stripe`

## Forward webhooks to localhost

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the **webhook signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev` if you change it.

## Checkout E2E — active app free trial

Use an owner whose `Company` row has a **future** `trialEndsAt` (e.g. `2026-05-27`).

1. Sign in as that owner (verified email).
2. Open `/upgrade`, choose **Pro**, **Business**, or **Enterprise**.
3. Complete Stripe Checkout with a [test card](https://docs.stripe.com/testing) (e.g. `4242 4242 4242 4242`). Checkout collects the card (`payment_method_collection: always`).
4. In Stripe Dashboard → **Subscriptions**, confirm:
   - Status **`trialing`**
   - **`trial_end`** matches `Company.trialEndsAt` (Unix timestamp)
   - No paid invoice yet (first charge at trial end)
5. After redirect, confirm in the app:
   - `GET /api/subscription` returns the chosen **`plan`** and **`subscriptionStatus`** `active` (Stripe `trialing` is mapped for app access)
   - Gated APIs (e.g. `GET /api/reports`) do not return trial-expired 403
6. Optional: advance the test clock in Stripe Dashboard to **`trial_end`** → confirm **`invoice.paid`** webhook and subscription becomes **`active`**.

Implementation: [`pages/api/create-checkout-session.ts`](../pages/api/create-checkout-session.ts), [`lib/stripe/checkoutTrial.ts`](../lib/stripe/checkoutTrial.ts), [`pages/api/webhooks/stripe.ts`](../pages/api/webhooks/stripe.ts).

## Checkout E2E — expired app trial

1. Use a company with `trialEndsAt` in the past (or null).
2. Complete Checkout → subscription should be **`active`** immediately and first invoice paid.

## Gated feature smoke (optional)

| After purchase | Quick check |
|----------------|-------------|
| Pro+ | Open `/reports` or call `GET /api/reports` with session — should not return trial-expired 403. |
| Business+ | Dashboard: “Customer & retention analytics” should show CLV-related content. |
| Enterprise | Reports **Enterprise performance / NPS** section — `POST /api/enterprise/nps` should not return 403 “Enterprise plan required”. |

## Subscription lifecycle

- Use Stripe Customer Portal (`/api/create-portal-session`) to cancel; webhook `customer.subscription.deleted` sets `subscriptionStatus` to `canceled`. Re-verify app behavior for downgraded users if you change cancellation handling.
- Failed post-trial charge: `invoice.payment_failed` sets payment grace; dashboard shows overdue banner via `paymentGraceEndsAt`.

## Existing trial users (e.g. trial ends 27 May 2026)

- **No change** until they open Checkout.
- After deploy, if they upgrade **before** trial end: card saved now, first charge on their existing `trialEndsAt`.
- If they never upgrade: app trial expiry behavior is unchanged.

## CI without Stripe

Playwright tests cover webhook signature rejection and checkout trial helper logic without live Stripe API calls.
