import { parseApiBody } from '../api/parseApiBody';

export type SignupCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Starts mandatory Pro checkout during owner signup (card saved, billing deferred to trial end). */
export async function startSignupCheckout(token: string): Promise<SignupCheckoutResult> {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan: 'pro', context: 'signup' }),
  });
  const data = await parseApiBody(res, 'Checkout failed.');
  const checkoutUrl = typeof data.url === 'string' ? data.url : undefined;
  const checkoutErr = typeof data.error === 'string' ? data.error : undefined;
  if (res.ok && checkoutUrl) {
    return { ok: true, url: checkoutUrl };
  }
  return { ok: false, error: checkoutErr || 'Unable to start checkout. Please try again.' };
}

export function formatTrialChargeDate(trialEndsAt: string | Date | null | undefined): string | null {
  if (!trialEndsAt) return null;
  const parsed = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
