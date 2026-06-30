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
    'Smart Scheduling — calendar, drag-and-drop, technician assignment, recurring visits',
    'Customer analytics on the dashboard — including customer lifetime value (CLV)',
    'Richer business insights on Reports — performance, routes, and revenue-oriented summaries',
  ],
  enterprise: [
    'Unlimited technicians',
    'Everything in Business',
    'Smart Scheduling — full calendar module with team workload and in-app job alerts',
    'Retention & churn plus CSAT / NPS trends; log NPS on Reports',
    'Dedicated account manager details in Settings',
    'Enterprise security options — IP allowlist, verified-email requirements for sensitive actions',
  ],
} as const;

export type MarketingPaidTier = keyof typeof MARKETING_PLAN_FEATURES;

/** Short note under pricing grids; avoids repeating the full matrix. */
export const PRICING_TRIAL_FOOTNOTE =
  '7-day free trial on all plans. During the trial you can use the product with trial limits (e.g. up to 2 technicians). Some Enterprise-style dashboard analytics may show as a preview; after the trial, features follow the plan you subscribe to.';
