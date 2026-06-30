# Pest Trace — plans and features (code-aligned)

This matrix reflects **what the codebase enforces today** (API routes + dashboard UI). Marketing copy on `/upgrade` may differ slightly; treat this file as the source of truth for engineering and support.

| Capability | Trial | Pro | Business | Enterprise |
|------------|:-----:|:---:|:----------:|:----------:|
| Core logbook (entries, photos, signatures per company rules) | Yes (while trial active) | Yes | Yes | Yes |
| Dashboard operational widgets (schedule, compliance, chemical log, alerts) | Yes | Yes | Yes | Yes |
| **Dashboard customer analytics** (CLV card) | **Yes** (Enterprise preview while trial active) | No | Yes | Yes |
| **Retention & Churn** + **CSAT / NPS** cards | **Yes** (Enterprise preview while trial active) | No | No | Yes |
| **PDF / reports** (`/api/reports`, `/reports`) | During trial only | Yes | Yes | Yes |
| **Technician certifications** (premium upload / view APIs) | During trial only | Yes | Yes | Yes |
| **Technician seats** | Max **2** technicians | Unlimited | Unlimited | Unlimited |
| **Smart Scheduling** (`/scheduling`, calendar module) | No | No | Yes | Yes |
| **Stripe self-serve checkout** (`/upgrade`) | — | Yes | Yes | Yes |

## Plan strings in the database

`Company.plan` in Prisma is typically: `trial`, `pro`, `business`, `enterprise`, or `free` (see webhook validation in [`pages/api/webhooks/stripe.ts`](../pages/api/webhooks/stripe.ts)). `subscriptionStatus` is updated from Stripe (e.g. `active`, `canceled`, `trialing`).

## Where gating is implemented

- **Reports:** [`pages/api/reports.ts`](../pages/api/reports.ts) — Pro+ or active subscription / trial window.
- **Certifications (premium):** [`pages/api/technicians/[id]/certifications.ts`](../pages/api/technicians/[id]/certifications.ts).
- **Technician limit:** [`pages/api/technicians.ts`](../pages/api/technicians.ts) — `plan === 'trial'` → max 2.
- **Enterprise NPS:** [`pages/api/enterprise/nps.ts`](../pages/api/enterprise/nps.ts) — Enterprise plan or active trial preview.
- **Smart Scheduling:** [`lib/scheduling/planAccess.ts`](../lib/scheduling/planAccess.ts) + [`pages/api/scheduling/*`](../pages/api/scheduling/) — Business and Enterprise only; UI at [`pages/scheduling.tsx`](../pages/scheduling.tsx).
- **Dashboard insights payload:** [`pages/api/dashboard-insights.ts`](../pages/api/dashboard-insights.ts) passes `plan` into analytics builders; **hiding** Business vs Enterprise-only cards is done in the UI: [`components/dashboard/DashboardEnhancements.tsx`](../components/dashboard/DashboardEnhancements.tsx) + [`lib/auth/plan.ts`](../lib/auth/plan.ts). Trial accounts also use [`lib/trialEnterprisePreview.ts`](../lib/trialEnterprisePreview.ts) for Enterprise-tier preview (e.g. chemical log depth).

## Notes

- **Pro** does not unlock the “Customer & retention analytics” subsection that Business unlocks (CLV); Enterprise adds retention and CSAT cards. **`Company.plan === 'trial'`** with a **future `trialEndsAt`** gets an **Enterprise preview** of those dashboard cards and related APIs (e.g. NPS logging); after the trial ends, gating follows the subscribed plan. See [`docs/PLAN_GATING.md`](PLAN_GATING.md).
- **`profiles.plan` (Supabase)** is documented for future RBAC; live gating uses **`Company.plan`** from Prisma after Stripe webhooks. See [`docs/SUPABASE_SCHEMA.md`](SUPABASE_SCHEMA.md).
