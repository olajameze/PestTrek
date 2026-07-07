export type StripePlan = 'pro' | 'business' | 'enterprise';
export type BillingInterval = 'month' | 'year';

const MONTHLY_PRICE_IDS: Record<StripePlan, string> = {
  pro: process.env.STRIPE_PRICE_ID_PRO || '',
  business: process.env.STRIPE_PRICE_ID_BUSINESS || '',
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
};

const ANNUAL_PRICE_IDS: Record<StripePlan, string> = {
  pro: process.env.STRIPE_PRICE_ID_PRO_ANNUAL || '',
  business: process.env.STRIPE_PRICE_ID_BUSINESS_ANNUAL || '',
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE_ANNUAL || '',
};

export function parseBillingInterval(value: unknown): BillingInterval {
  return value === 'year' ? 'year' : 'month';
}

export function resolveStripePriceId(plan: StripePlan, interval: BillingInterval): string {
  const priceId = interval === 'year' ? ANNUAL_PRICE_IDS[plan] : MONTHLY_PRICE_IDS[plan];
  return priceId.trim();
}

export function isConfiguredStripePriceId(priceId: string): boolean {
  return Boolean(priceId && priceId.startsWith('price_'));
}
