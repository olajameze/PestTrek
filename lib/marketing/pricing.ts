/** GBP subscription tiers — single source of truth for marketing display. */
export const MARKETING_PLAN_PRICES_GBP = {
  pro: 25,
  business: 50,
  enterprise: 100,
} as const;

export const MARKETING_PLAN_ANNUAL_PRICES_GBP = {
  pro: 150,
  business: 350,
  enterprise: 600,
} as const;

export type MarketingPlanKey = keyof typeof MARKETING_PLAN_PRICES_GBP;
export type BillingInterval = 'month' | 'year';

const PLAN_ORDER: MarketingPlanKey[] = ['pro', 'business', 'enterprise'];

export function marketingPlanKeys(): MarketingPlanKey[] {
  return [...PLAN_ORDER];
}

const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

/** Whole-pound display (monthly list prices, savings, etc.). */
export function formatGbpPrice(amount: number): string {
  return gbpFormatter.format(amount);
}

function formatGbpPriceWithPence(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = !Number.isInteger(rounded);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatGbpMonthly(amount: number): string {
  return `${formatGbpPrice(amount)}/month`;
}

export function formatGbpYearly(amount: number): string {
  return `${formatGbpPrice(amount)}/year`;
}

export function getMarketingPlanPriceGbp(plan: MarketingPlanKey, interval: BillingInterval): number {
  return interval === 'year' ? MARKETING_PLAN_ANNUAL_PRICES_GBP[plan] : MARKETING_PLAN_PRICES_GBP[plan];
}

export function annualPlanSavingsGbp(plan: MarketingPlanKey): number {
  return MARKETING_PLAN_PRICES_GBP[plan] * 12 - MARKETING_PLAN_ANNUAL_PRICES_GBP[plan];
}

export function annualEffectiveMonthlyGbp(plan: MarketingPlanKey): number {
  return MARKETING_PLAN_ANNUAL_PRICES_GBP[plan] / 12;
}

export function formatAnnualEffectiveMonthly(plan: MarketingPlanKey): string {
  return `${formatGbpPriceWithPence(annualEffectiveMonthlyGbp(plan))}/month`;
}

export const MARKETING_STARTING_PRICE_LABEL = formatGbpMonthly(MARKETING_PLAN_PRICES_GBP.pro);
