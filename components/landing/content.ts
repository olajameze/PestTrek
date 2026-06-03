import { MARKETING_PLAN_FEATURES } from '../../lib/marketingPlanFeatures';

/** Three product stories — each visual once (no duplicate mockups). */
export const featureCards = [
  {
    title: 'Log jobs and proof in the field',
    body: 'Capture treatments, photos, e-signatures, follow-ups, and site notes from any device. Technicians use a streamlined flow; owners see the same record instantly.',
    visual: 'mobile-app-ui',
  },
  {
    title: 'Certificates, reports, and audit evidence',
    body: 'Track qualification expiry alongside job history. Filter and export professional reports so you can answer clients or regulators without rebuilding folders.',
    visual: 'report-preview',
  },
  {
    title: 'One dashboard for operations — and growth on higher tiers',
    body: 'Schedule, compliance gaps, chemical usage, and alerts in one place. Business and Enterprise add customer and retention analytics so you see revenue trends, not only job counts.',
    visual: 'dashboard-view',
  },
];

export const howItWorksSteps = [
  {
    title: 'Onboard owners and technicians',
    text: 'Business admins set up the company dashboard; field staff get secure email-code sign-in and guided help on their first logbook visit.',
  },
  {
    title: 'Log jobs on-site',
    text: 'Technicians capture treatments, photos, signatures, and follow-ups from any phone — online or offline.',
  },
  {
    title: 'Stay audit-ready',
    text: 'Export professional reports and certification records for clients and regulators, including Rodenticide Stewardship evidence.',
  },
];

/** Shown on the landing page — product benefits (not a dev changelog). */
export const teamRoleHighlights = [
  {
    role: 'Business admin',
    audience: 'Owners & office managers',
    points: [
      'Full dashboard: technicians, billing, compliance settings, and PDF/CSV exports',
      'Invite technicians and see every job in one place',
      'Email + password sign-in built for account security',
    ],
    cta: { label: 'Start as business admin', href: '/auth/signup' },
  },
  {
    role: 'Technician',
    audience: 'Field operatives',
    points: [
      'Mobile logbook with photos, e-signatures, and room-level notes',
      'Secure one-time email code — no shared company password on site',
      'Step-by-step guidance when starting your first digital job record',
    ],
    cta: { label: 'Technician sign-in', href: '/auth/signin?role=technician' },
  },
];

export const pricingPlans = [
  {
    name: '🟢 Pro',
    bestFor: 'Startups & owner-operators scaling beyond a handful of jobs',
    price: '25',
    cadence: '/month',
    features: [...MARKETING_PLAN_FEATURES.pro],
    cta: 'Start Free Trial',
    href: '/auth/signup',
    isPopular: false,
  },
  {
    name: '🟢 Business',
    bestFor: 'Growing teams that need revenue and performance visibility',
    price: '50',
    cadence: '/month',
    features: [...MARKETING_PLAN_FEATURES.business],
    cta: 'Start Free Trial',
    href: '/auth/signup',
    isPopular: true,
  },
  {
    name: '🔵 Enterprise',
    bestFor: 'Larger fleets, multi-site, and stricter governance',
    price: '100',
    cadence: '/month',
    features: [...MARKETING_PLAN_FEATURES.enterprise],
    cta: 'Start Free Trial',
    href: '/auth/signup',
    isPopular: false,
  },
];

/** Shown under hero CTA — avoid repeating the same line again in the hero paragraph. */
export const trustMicrocopy = [
  '7-day free trial',
  'Cancel from the app — no long-term contract',
  'Built for pest control businesses worldwide',
];

export const regulationUrgency = {
  title: 'New compliance standards are changing pest control',
  body: 'With increasing regulatory requirements, pest control businesses are expected to maintain accurate, verifiable records for every job.\n\nPaper logs, spreadsheets, and scattered records are no longer enough.\n\nPestTrace helps you stay compliant, organised, and ready for audits — without the stress.',
};

export const testimonials = [
  {
    quote:
      "PestTrace helped us move from paper logs to fully digital, audit-ready records in under a week. It's saved us hours of admin and made our business far more professional to clients.",
    author: "Weathers' Pest Solutions",
    role: 'Customer Testimonial',
    company: "Weathers' Pest Solutions",
    logo: '/weathers-logo.png',
  },
];

export const landingFaqs = [
  {
    question: 'What is PestTrace pest control compliance software?',
    answer:
      'PestTrace is a web-based compliance logbook for pest control companies in the UK and internationally. Owners manage teams and exports from a business dashboard; technicians record jobs, photos, and signatures in the field.',
  },
  {
    question: 'How do business admins and technicians sign in differently?',
    answer:
      'Business admins use email and password for the full company dashboard. Technicians invited by their company sign in with a one-time code sent to their email — safer for field staff and no shared passwords.',
  },
  {
    question: 'Does PestTrace help with Rodenticide Stewardship and audits?',
    answer:
      'Yes. You can maintain structured job history, treatment details, follow-ups, and export reports suitable for client proof and regulatory audits, including stewardship-style record keeping.',
  },
  {
    question: 'What happens after my 7-day free trial?',
    answer:
      "You'll be prompted to add payment details before the trial ends. Plans start from £25/month for Pro; cancel anytime from the dashboard.",
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel from your billing settings in the app. There are no long-term contracts.',
  },
  {
    question: 'Do technicians need to install an app?',
    answer:
      'No download required. PestTrace runs in the browser and can be installed as a PWA on phones for quick access on site.',
  },
];
