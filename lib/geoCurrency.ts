import type { IncomingHttpHeaders } from 'node:http';
import { pricingPlans } from '../components/landing/content';
import { formatGbpPrice } from './marketing/pricing';

/** Serializable props for the landing page pricing block (Pages Router). */
export type LandingPricingProps = {
  /** Primary display — always GBP. */
  pricingGbpLabels: string[];
  /** Secondary approx local amount per tier; null for UK/GBP visitors. */
  pricingApproxLabels: (string | null)[];
  pricingCurrency: string;
  pricingCountry: string;
  /** Extra footnote when showing converted amounts (non-GBP). */
  pricingFxNote: string | null;
};

/**
 * Approximate FX: units of {@link currency} per **1 GBP** (marketing display only).
 * Update occasionally; subscription billing stays GBP in Stripe unless you add multi-currency prices.
 */
const GBP_TO_CURRENCY: Record<string, number> = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.17,
  AUD: 1.93,
  CAD: 1.72,
  NZD: 2.08,
  CHF: 1.13,
  SEK: 13.5,
  NOK: 13.8,
  DKK: 8.75,
  PLN: 5.05,
  INR: 106,
  JPY: 192,
  SGD: 1.71,
  HKD: 9.92,
  MXN: 21.5,
  BRL: 7.05,
  ZAR: 23.8,
};

/** ISO 3166-1 alpha-2 → ISO 4217 for common regions. Unlisted → GBP (product default). */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GB: 'GBP',
  GG: 'GBP',
  JE: 'GBP',
  IM: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  IN: 'INR',
  JP: 'JPY',
  SG: 'SGD',
  HK: 'HKD',
  MX: 'MXN',
  BR: 'BRL',
  ZA: 'ZAR',
  AT: 'EUR',
  BE: 'EUR',
  CY: 'EUR',
  EE: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  GR: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  LV: 'EUR',
  LT: 'EUR',
  LU: 'EUR',
  MT: 'EUR',
  NL: 'EUR',
  PT: 'EUR',
  SK: 'EUR',
  SI: 'EUR',
  ES: 'EUR',
  HR: 'EUR',
};

function localeForCurrency(currency: string): string {
  switch (currency) {
    case 'GBP':
      return 'en-GB';
    case 'EUR':
      return 'de-DE';
    case 'SEK':
    case 'NOK':
    case 'DKK':
      return 'sv-SE';
    case 'PLN':
      return 'pl-PL';
    case 'INR':
      return 'en-IN';
    case 'JPY':
      return 'ja-JP';
    case 'BRL':
      return 'pt-BR';
    default:
      return 'en-US';
  }
}

export function currencyFromCountry(countryCode: string): string {
  const cc = countryCode.trim().toUpperCase();
  if (!cc || cc === 'ZZ') return 'GBP';
  return COUNTRY_TO_CURRENCY[cc] ?? 'GBP';
}

function formatMonthlyAmount(gbpAmount: number, currency: string): string {
  const rate = GBP_TO_CURRENCY[currency] ?? GBP_TO_CURRENCY.GBP;
  const converted = gbpAmount * rate;
  const rounded = Number.isFinite(converted) ? Math.round(converted) : gbpAmount;
  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(rounded);
}

function vercelCountry(headers: IncomingHttpHeaders): string {
  const raw = headers['x-vercel-ip-country'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' ? v.trim().toUpperCase() : '';
}

function formatApproxLocalLine(gbpAmount: number, currency: string): string {
  const converted = formatMonthlyAmount(gbpAmount, currency);
  return `approx ${converted} ${currency}`;
}

/**
 * Builds formatted monthly price strings for each landing tier.
 * GBP is always primary; non-UK visitors get a secondary approx local line.
 */
export function buildLandingPricingFromRequest(headers: IncomingHttpHeaders): LandingPricingProps {
  const country = vercelCountry(headers);
  const pricingCurrency = currencyFromCountry(country);
  const gbpAmounts = pricingPlans.map((p) => Number.parseFloat(p.price) || 0);
  const pricingGbpLabels = gbpAmounts.map((gbp) => formatGbpPrice(gbp));
  const pricingApproxLabels =
    pricingCurrency === 'GBP'
      ? gbpAmounts.map(() => null)
      : gbpAmounts.map((gbp) => formatApproxLocalLine(gbp, pricingCurrency));

  const pricingFxNote =
    pricingCurrency === 'GBP'
      ? null
      : 'Approximate local amounts shown for reference. Subscriptions are billed in GBP through Stripe.';

  return {
    pricingGbpLabels,
    pricingApproxLabels,
    pricingCurrency,
    pricingCountry: country,
    pricingFxNote,
  };
}
