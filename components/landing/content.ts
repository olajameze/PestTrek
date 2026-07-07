import { MARKETING_PLAN_FEATURES } from '../../lib/marketingPlanFeatures';
import { MARKETING_STARTING_PRICE_LABEL } from '../../lib/marketing/pricing';

export const heroCopy = {
  title: 'The job is finished. Your records should be too.',
  subtitle:
    'PestTrace is a compliance logbook built for pest control. Technicians log on site, you see everything in one place, and when someone asks for proof you pull a report instead of rebuilding a folder from photos.',
  priceHint: `Plans from ${MARKETING_STARTING_PRICE_LABEL}`,
  primaryCta: 'Try it free for 7 days',
  secondaryCta: 'See the product',
};

export const bottomCtaCopy = {
  title: 'Ready when the inspector calls.',
  subtitle:
    'Swap the paper logbook and the spreadsheet tabs for one system your team will actually use in the van.',
  primaryCta: 'Start your free trial',
  secondaryCta: 'Talk to us',
};

export const featureCards = [
  {
    title: 'Log jobs and proof in the field',
    body: 'Treatments, photos, signatures, follow ups, site notes. Technicians get a simple flow on any phone. You see the same record the moment it is saved.',
    visual: 'mobile-app-ui',
    screenshots: [
      {
        src: '/marketing/treatment-logbook.png',
        alt: 'PestTrace treatment logbook for field job records and compliance exports',
      },
    ],
  },
  {
    title: 'Certificates, reports, and audit evidence',
    body: 'Track qualification expiry next to job history. Filter what you need and export reports for clients or regulators without digging through folders.',
    visual: 'report-preview',
  },
  {
    title: 'One dashboard for the day to day',
    body: 'Scheduling, compliance gaps, chemical usage, and alerts in one view. Business and Enterprise add customer and retention analytics when you want revenue trends, not just job counts.',
    visual: 'dashboard-view',
    screenshots: [
      {
        src: '/marketing/customers-sites.png',
        alt: 'PestTrace customers and sites management screen',
      },
      {
        src: '/marketing/invoices.png',
        alt: 'PestTrace invoices screen with job billing and PDF exports',
      },
    ],
  },
];

export const howItWorksSteps = [
  {
    title: 'Set up the company',
    text: 'Owners configure the dashboard. Field staff sign in with a secure email code and get guided help on their first logbook visit.',
  },
  {
    title: 'Log on site',
    text: 'Technicians capture treatments, photos, signatures, and follow ups from any phone, online or offline.',
  },
  {
    title: 'Pull proof when you need it',
    text: 'Export professional reports and certification records for clients and regulators, including Rodenticide Stewardship evidence.',
  },
];

export const teamRoleHighlights = [
  {
    role: 'Business admin',
    audience: 'Owners & office managers',
    points: [
      'Full dashboard: technicians, billing, compliance settings, and PDF/CSV exports',
      'Invite technicians and see every job in one place',
      'Email and password sign in for account security',
    ],
    cta: { label: 'Start as business admin', href: '/auth/signup' },
  },
  {
    role: 'Technician',
    audience: 'Field operatives',
    points: [
      'Mobile logbook with photos, e-signatures, and room-level notes',
      'One time email code sign in, no shared company password on site',
      'Step by step guidance on your first digital job record',
    ],
    cta: { label: 'Technician sign-in', href: '/auth/signin?role=technician' },
  },
];

export const icpSegments = [
  {
    title: 'Solo operators & owner-operators',
    pains: [
      'Paper logbooks that vanish before an audit',
      'Evenings spent rebuilding records from photos and notes',
      'Certification expiry noticed too late',
    ],
    fits: 'Pro covers fast field logging, compliance exports, and light admin.',
    planHint: 'Pro plan',
    cta: { label: 'Start as a solo operator', href: '/auth/signup' },
  },
  {
    title: 'Growing teams & multi-site businesses',
    pains: [
      'No clear picture of what technicians logged today',
      'Scheduling gaps and missed follow ups',
      'Revenue data stuck in spreadsheets',
    ],
    fits: 'Business and Enterprise add scheduling, customer management, analytics, and audit packs.',
    planHint: 'Business & Enterprise',
    cta: { label: 'Scale your team', href: '/auth/signup' },
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

export const trustMicrocopy = [
  '7 day free trial',
  'Cancel from the app, no lock in',
  'Built for UK pest control compliance',
];

export const regulationUrgency = {
  title: 'Paper records are getting harder to defend',
  body: 'Rodenticide stewardship, client tenders, and regulatory audits all want the same thing: verifiable job history, treatment details, and technician proof.\n\nWhen records are missing, you lose time, credibility, and sometimes the contract itself.\n\nPestTrace keeps every job, certificate, and export together so you are ready when an audit lands, not rebuilding folders the night before.',
};

export const testimonials = [
  {
    quote:
      'We moved from paper logs to digital records in under a week. It saved us hours of admin and our clients notice the difference.',
    author: "Weathers' Pest Solutions",
    role: 'Pest control operator',
    company: "Weathers' Pest Solutions",
    logo: '/weathers-logo.png',
  },
];

export const landingFaqs = [
  {
    question: 'What is PestTrace pest control compliance software?',
    answer:
      'PestTrace is a web based compliance logbook for pest control companies in the UK and internationally. Owners manage teams and exports from a business dashboard; technicians record jobs, photos, and signatures in the field.',
  },
  {
    question: 'How do business admins and technicians sign in differently?',
    answer:
      'Business admins use email and password for the full company dashboard. Technicians invited by their company sign in with a one time code sent to their email. Safer for field staff, and no shared passwords.',
  },
  {
    question: 'Does PestTrace help with Rodenticide Stewardship and audits?',
    answer:
      'Yes. You can maintain structured job history, treatment details, follow ups, and export reports suitable for client proof and regulatory audits, including stewardship style record keeping.',
  },
  {
    question: 'What happens after my 7-day free trial?',
    answer: `You'll be prompted to add payment details before the trial ends. Plans start from ${MARKETING_STARTING_PRICE_LABEL} for Pro; cancel anytime from the dashboard.`,
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel from your billing settings in the app. There are no long term contracts.',
  },
  {
    question: 'Do technicians need to install an app?',
    answer:
      'No download required. PestTrace runs in the browser and can be installed as a PWA on phones for quick access on site.',
  },
];

export { impactCalculatorTeaser } from '../../lib/marketing/impactCalculatorCopy';
