# Pest Trace — plans and features (code-aligned)

This matrix reflects **what the codebase enforces today** (API routes + dashboard UI).

| Capability | Trial | Pro | Business | Enterprise |
|------------|:-----:|:---:|:----------:|:----------:|
| Core logbook (entries, photos, signatures per company rules) | Yes (while trial active) | Yes | Yes | Yes |
| Dashboard operational widgets (schedule, compliance, chemical log, alerts) | Yes | Yes | Yes | Yes |
| **Customer & site CRM** (`/customers`, `/api/customers`) | No | No | Yes | Yes |
| **Invoicing + CSV export** (`/invoices`, Xero-ready CSV) | No | No | Yes | Yes |
| **Job-complete email** (owner + optional customer via Resend) | No | No | Yes | Yes |
| **Recurring visit compliance alerts** (cron + dashboard widget) | No | No | Yes | Yes |
| **Audit pack ZIP + compliance score PDF** (`/api/export/audit-pack`) | No | No | Yes | Yes |
| **Smart Scheduling** (`/scheduling`) | No | No | Yes | Yes |
| **Dashboard customer analytics** (CLV card) | Preview on trial | No | Yes | Yes |
| **Retention & Churn** + **CSAT / NPS** | Preview on trial | No | No | Yes |
| **Client portal** (token + signed links) | No | No | No | Yes |
| **White-label PDF branding** | No | No | No | Yes |
| **Multi-site / customer audit pack filters** | No | No | Single site | Multi-site |
| PDF / reports (`/reports`) | During trial | Yes | Yes | Yes |
| Technician certifications | During trial | Yes | Yes | Yes |
| Technician seats | Max **2** | Max **3** | Max **10** | Unlimited |
| Stripe self-serve checkout | — | Yes | Yes | Yes |

## Where gating is implemented

- **Business features:** [`lib/businessFeatures/planAccess.ts`](../lib/businessFeatures/planAccess.ts) + [`lib/businessFeatures/businessContext.ts`](../lib/businessFeatures/businessContext.ts)
- **Enterprise portal:** [`lib/portal/portalService.ts`](../lib/portal/portalService.ts)
- **Smart Scheduling:** [`lib/scheduling/planAccess.ts`](../lib/scheduling/planAccess.ts)
- **Audit pack:** [`pages/api/export/audit-pack.ts`](../pages/api/export/audit-pack.ts)
- **Compliance cron:** [`pages/api/cron/compliance-alerts.ts`](../pages/api/cron/compliance-alerts.ts)
