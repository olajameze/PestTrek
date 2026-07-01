/**
 * Plan bullet lists for marketing (landing + upgrade).
 * Align with docs/TIER_MATRIX.md and lib/planLimits.ts technician caps.
 */

export const MARKETING_PLAN_FEATURES = {
  pro: [
    'Up to 3 technicians',
    'Digital logbook — jobs, photos, signatures, follow-ups, company compliance rules',
    'Operational dashboard — schedule, compliance, chemical log, alerts',
    'Reports page & technician certifications (included once you are on a paid plan)',
    'Self-serve billing via Stripe checkout & customer portal',
  ],
  business: [
    'Up to 10 technicians',
    'Everything in Pro',
    'Customer & site CRM — run your route from one place',
    'Smart Scheduling — calendar, drag-and-drop, recurring visits',
    'Job-complete email notifications (no SMS fees)',
    'Basic invoicing + Xero-ready CSV export',
    'Compliance alerts for missed recurring visits & follow-ups',
    'Audit pack ZIP with compliance score PDF',
    'Customer analytics — including customer lifetime value (CLV)',
  ],
  enterprise: [
    'Unlimited technicians',
    'Everything in Business',
    'Client portal — customers view visits & treatment history',
    'White-label PDFs — logo, colours, footer on reports & invoices',
    'Multi-site audit packs for commercial clients',
    'Retention & churn plus CSAT / NPS trends; log NPS on Reports',
    'Dedicated account manager details in Settings',
    'Enterprise security — IP allowlist, verified-email requirements',
  ],
} as const;

export type MarketingPaidTier = keyof typeof MARKETING_PLAN_FEATURES;

/** Short note under pricing grids; avoids repeating the full matrix. */
export const PRICING_TRIAL_FOOTNOTE =
  '7-day free trial on all plans. During the trial you can use the product with trial limits (e.g. up to 2 technicians). Business and Enterprise operational features unlock after you subscribe to those plans.';
