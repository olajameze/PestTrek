import { MARKETING_PLAN_FEATURES } from '../../lib/marketingPlanFeatures';
import { MARKETING_PLAN_PRICES_GBP } from '../../lib/marketing/pricing';
import { MARKETING_STARTING_PRICE_LABEL } from '../../lib/marketing/pricing';

export const heroCopy = {
  eyebrow: 'Field logbook for pest control. UK, EU, US, and beyond.',
  title: 'The job is finished. Your records should be too.',
  subtitle:
    'PestTrace is a compliance logbook built for pest control. Technicians log on site, you see everything in one place, and when someone asks for proof you pull a report instead of rebuilding a folder from photos.',
  geographicLine:
    'Dated treatment records, product details, photos, signatures, and technician qualifications in one export, not scattered across WhatsApp, paper pads, and spreadsheet tabs.',
  priceHint: `Plans from ${MARKETING_STARTING_PRICE_LABEL}`,
  primaryCta: 'Try it free for 7 days',
  secondaryCta: 'See the product',
};

export const bottomCtaCopy = {
  title: 'Pull the export tonight, not rebuild the folder.',
  subtitle:
    'Swap the paper logbook and the spreadsheet tabs for one system your team will use in the van.',
  primaryCta: 'Start your free trial',
  secondaryCta: 'Talk to us',
};

export const auditScenariosCopy = {
  title: 'When someone asks for proof',
  intro:
    'Different clients ask for different folders. PestTrace records the job once in the field, then you filter and export what that request needs.',
  disclaimer:
    'PestTrace is not affiliated with BPCA, CRRU, HSE, EPA, BRCGS, SALSA, or certification bodies. You remain responsible for your local rules, product labels, and professional judgement.',
  scenarios: [
    {
      title: 'Council or commercial tender',
      whoAsks: 'Procurement / facilities',
      standard: 'Contract tender & site history',
      theyWant: 'Treatment history for one address over the last 12 months.',
      youExport:
        'Filtered PDF or CSV: date, address, treatment, technician, signature flag, photo count.',
    },
    {
      title: 'Food site client audit',
      whoAsks: 'QA manager on site',
      standard: 'BRCGS / SALSA / ISO 22000 visit evidence',
      theyWant: 'Visit reports with photos, recommendations, and follow-up dates.',
      youExport: 'Job PDF with treatment notes and images; Business+ audit pack ZIP for a date range.',
    },
    {
      title: 'UK rodenticide records',
      whoAsks: 'Internal QA or insurer',
      standard: 'CRRU / UK Rodenticide Stewardship',
      theyWant: 'Bait use, site context, and follow-ups tied to each visit.',
      youExport:
        'Bait station rows, product used, treatment notes, follow-up date, signed job record.',
    },
    {
      title: 'BPCA membership check',
      whoAsks: 'Assessor or senior technician',
      standard: 'BPCA Codes of Best Practice',
      theyWant: 'Consistent treatment records and current qualifications on file.',
      youExport:
        'Per-job PDF/CSV plus qualifications.json in the audit pack with expiry dates.',
    },
    {
      title: 'US application history',
      whoAsks: 'State inspector or commercial client',
      standard: 'FIFRA application records',
      theyWant: 'Product, rate, target pest, applicator, and date per treatment.',
      youExport: 'Searchable job history and CSV export (expectations vary by state; keep records at least two years).',
    },
    {
      title: 'EU operator data request',
      whoAsks: 'Client DPO or contract manager',
      standard: 'GDPR traceability',
      theyWant: 'Who accessed job data and a portable export.',
      youExport:
        'Role-based access and exportable job files. PestTrace is not a data-processing agreement. Use your own DPA where required.',
    },
  ],
};

export const jobRecordFieldsCopy = {
  title: 'What each job record includes',
  intro: 'These are the fields in the app today. The same data your office would chase across paper and photos.',
  caption: 'See a live example on the demo dashboard.',
};

export const internationalCopy = {
  title: 'Not UK-only',
  body:
    'PestTrace is used by pest control operators in the UK, Ireland, Europe, North America, and other markets. Date formats, currency, and compliance reminders adapt to your region. UK teams often need CRRU-style rodenticide notes and COSHH chemical records. US teams often need FIFRA-aligned application history. Food-sector clients commonly ask for BRCGS or SALSA visit evidence. The logbook structure stays the same. You set what “complete” means in company settings.',
  regions: [
    'Browser + PWA on any phone',
    'GBP, USD, EUR billing',
    'Offline logbook sync',
    '7-day trial on every plan',
  ],
};

export const auditPackTeaserCopy = {
  title: 'What goes into an audit pack?',
  body:
    'Business and Enterprise plans export a ZIP for a date range: jobs.csv, jobs.json, photos-manifest.json, qualifications.json, report-summary.pdf, and up to 100 signature PNGs. Enterprise adds per-site folders for multi-site commercial clients.',
  cta: 'Full field list in the compliance guide',
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
    price: String(MARKETING_PLAN_PRICES_GBP.pro),
    cadence: '/month',
    features: [...MARKETING_PLAN_FEATURES.pro],
    cta: 'Start Free Trial',
    href: '/auth/signup',
    isPopular: false,
  },
  {
    name: '🟢 Business',
    bestFor: 'Growing teams that need revenue and performance visibility',
    price: String(MARKETING_PLAN_PRICES_GBP.business),
    cadence: '/month',
    features: [...MARKETING_PLAN_FEATURES.business],
    cta: 'Start Free Trial',
    href: '/auth/signup',
    isPopular: true,
  },
  {
    name: '🔵 Enterprise',
    bestFor: 'Larger fleets, multi-site, and stricter governance',
    price: String(MARKETING_PLAN_PRICES_GBP.enterprise),
    cadence: '/month',
    features: [...MARKETING_PLAN_FEATURES.enterprise],
    cta: 'Start Free Trial',
    href: '/auth/signup',
    isPopular: false,
  },
];

export const trustMicrocopy = [
  '7-day free trial',
  'Cancel from billing settings',
  'Works in the browser, no app store',
  'GBP, USD, EUR billing',
];

export const regulationUrgency = {
  eyebrow: 'What auditors and clients check',
  title: 'Missing signatures, expired certs, and gaps in treatment history',
  body: 'Most audit problems are not exotic. They are jobs without a signature, qualifications that expired last month, or follow-ups that never got logged.\n\nPestTrace flags those gaps in the dashboard before you export. Your compliance health score weights missing signatures, expired qualifications, open compliance issues, and overdue follow-ups based on rules you set.',
};

export const socialProofHeading = 'Early adopter';

export const testimonials = [
  {
    quote:
      'We moved from paper logs to PDF exports in under a week. Treatment records and signatures are on one job instead of a pad in the van and photos on my phone.',
    author: "Weathers' Pest Solutions",
    role: 'Pest control operator',
    company: "Weathers' Pest Solutions",
    logo: '/weathers-logo.png',
  },
];

export const landingFaqs = [
  {
    question: 'Is PestTrace UK-only?',
    answer:
      'No. PestTrace is a web-based logbook for pest control companies in the UK, Ireland, Europe, North America, and other markets. Date formats, currency, and regional compliance reminders adapt to your settings. UK operators often use it for CRRU-style rodenticide records and COSHH chemical notes; US operators for FIFRA application history; food-sector clients for BRCGS or SALSA visit evidence.',
  },
  {
    question: 'What is PestTrace?',
    answer:
      'A compliance logbook for pest control. Owners manage teams and exports from a dashboard; technicians record jobs, photos, and signatures in the field. Runs in the browser with optional PWA install for offline use.',
  },
  {
    question: 'What standards does PestTrace support?',
    answer:
      'PestTrace captures structured job records you can export for client and regulatory requests, including BPCA treatment records, CRRU/UK Rodenticide Stewardship-style bait logs, COSHH chemical fields, BRCGS/SALSA visit evidence, and FIFRA application history. PestTrace is not affiliated with or endorsed by those bodies. You remain responsible for meeting your local rules.',
  },
  {
    question: 'What is in the audit pack ZIP?',
    answer:
      'On Business and Enterprise plans, export a ZIP for a date range containing: jobs.csv and jobs.json (date, client, address, treatment, status, signature flag, photo count, technician names), photos-manifest.json, qualifications.json (certification files and expiry dates), report-summary.pdf (compliance score and gaps), and up to 100 signature PNGs. Enterprise adds per-site folders and a multi-site index PDF.',
  },
  {
    question: 'How do business admins and technicians sign in?',
    answer:
      'Business admins use email and password. Technicians invited by their company sign in with a one-time code sent to their email. No shared company password on site.',
  },
  {
    question: 'What happens after the 7-day free trial?',
    answer: `You add payment details before the trial ends. Plans start from ${MARKETING_STARTING_PRICE_LABEL} for Pro. Cancel anytime from billing settings. No long-term contract.`,
  },
  {
    question: 'Do technicians need to install an app?',
    answer:
      'No app store download. PestTrace runs in the browser and can be installed as a PWA on phones for quicker access and offline logbook sync.',
  },
];

export { impactCalculatorTeaser } from '../../lib/marketing/impactCalculatorCopy';
