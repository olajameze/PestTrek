/** GBP subscription tiers — single source of truth for marketing display. */
export const MARKETING_PLAN_PRICES_GBP = {
  pro: 25,
  business: 50,
  enterprise: 100,
} as const;

export type MarketingPlanKey = keyof typeof MARKETING_PLAN_PRICES_GBP;

const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export function formatGbpPrice(amount: number): string {
  return gbpFormatter.format(amount);
}

export function formatGbpMonthly(amount: number): string {
  return `${formatGbpPrice(amount)}/month`;
}

export const MARKETING_STARTING_PRICE_LABEL = formatGbpMonthly(MARKETING_PLAN_PRICES_GBP.pro);
