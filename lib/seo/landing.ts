import { landingFaqs, pricingPlans } from '../../components/landing/content';
import { MARKETING_STARTING_PRICE_LABEL } from '../marketing/pricing';

/** Canonical marketing origin — keep in sync with Vercel NEXT_PUBLIC_SITE_URL. */
export const MARKETING_SITE_ORIGIN = 'https://www.pesttrace.com';

export const LANDING_PAGE_TITLE =
  'PestTrace – Pest Control Logbook & Compliance Records | Field Jobs to Audit Exports';

export const LANDING_META_DESCRIPTION =
  `Pest control logbook for technicians and owners. Record treatments, photos, signatures, and qualifications on site. Export PDF reports and audit packs for client and regulatory requests. 7-day free trial from ${MARKETING_STARTING_PRICE_LABEL}.`;

export const LANDING_KEYWORDS = [
  'pest control compliance software',
  'pest control logbook',
  'pest control treatment records',
  'pest control audit pack',
  'rodenticide record keeping',
  'FIFRA application records',
  'BPCA treatment records',
  'technician pest control app',
  'pest control business software',
].join(', ');

export function buildLandingJsonLd(): object[] {
  const origin = MARKETING_SITE_ORIGIN;

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PestTrace',
    url: origin,
    logo: `${origin}/pest-trace.png`,
    sameAs: [
      'https://www.linkedin.com/company/pesttrace/',
      'https://www.facebook.com/share/1LGktsR83z/',
    ],
  };

  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PestTrace',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: pricingPlans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name.replace(/[^\w\s]/g, '').trim(),
      price: plan.price,
      priceCurrency: 'GBP',
      description: plan.bestFor,
    })),
    description: LANDING_META_DESCRIPTION,
    url: origin,
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: landingFaqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return [organization, software, faqPage];
}
