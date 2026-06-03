# Email production setup (Resend + Vercel + Supabase)

## Status checklist

| Step | Status |
|------|--------|
| Resend domain `pesttrace.com` verified (SPF/DKIM) | Run `node scripts/resend-domain-setup.mjs` — should report **verified** |
| Vercel production env vars | Set on project **pest-trek** (see below) |
| Vercel preview/development `RESEND_FROM_EMAIL` | `onboarding@resend.dev` for sandbox sending |
| Supabase Auth custom SMTP (OTP emails) | **Manual** in Supabase Dashboard (see §3) |

---

## 1. Resend domain (pesttrace.com)

Domain verification is managed in [Resend → Domains](https://resend.com/domains).

From this repo:

```bash
node scripts/resend-domain-setup.mjs
```

Requires `RESEND_API_KEY` in `.env.local`. The script lists DNS records, triggers verification, and prints status.

**Verified records (eu-west-1):**

- `TXT` `resend._domainkey` — DKIM
- `MX` `send` → `feedback-smtp.eu-west-1.amazonses.com`
- `TXT` `send` — SPF (`v=spf1 include:amazonses.com ~all`)

After verification, production may send from `alerts@pesttrace.com` and `compliance@pesttrace.com`.

---

## 2. Vercel environment variables (pest-trek)

Configured via Vercel CLI on project **pest-trek**:

| Variable | Production | Preview / Development |
|----------|------------|------------------------|
| `RESEND_FROM_EMAIL` | `alerts@pesttrace.com` | `onboarding@resend.dev` |
| `SUPPORT_EMAIL` | `compliance@pesttrace.com` | (optional: same or sandbox) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `compliance@pesttrace.com` | |
| `NEW_SIGNUP_NOTIFY_EMAIL` | `pesttrace@gmail.com` | |

**Redeploy** production after env changes so new values apply:

```bash
npx vercel --prod
```

Or trigger a deploy from the Vercel dashboard.

**Local `.env.local` (development):**

```env
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Keep production-style addresses only on Vercel production, not in local files, until you are testing domain send locally.

---

## 3. Supabase Auth SMTP (OTP / magic links)

App transactional mail uses `RESEND_FROM_EMAIL` in [`lib/email.ts`](../lib/email.ts).

**OTP and auth emails** use **Supabase Auth SMTP**, not the Next.js app. Configure once per Supabase project:

### Option A — Resend integration (recommended)

1. [Resend → Integrations → Supabase](https://resend.com/settings/integrations)
2. Connect your Supabase project and verified domain `pesttrace.com`
3. Sender example: `alerts@pesttrace.com` or `noreply@pesttrace.com`
4. Confirm in **Supabase Dashboard → Authentication → Email** that custom SMTP is enabled

### Option B — Manual SMTP

**Supabase Dashboard → Authentication → Email → SMTP Settings**

| Field | Value |
|-------|--------|
| Enable custom SMTP | On |
| Host | `smtp.resend.com` (no trailing spaces) |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key (`re_...`) |
| Sender email | `alerts@pesttrace.com` (must be on verified domain) |
| Sender name | `Pest Trace` |

Docs: [Send emails using Supabase with SMTP](https://resend.com/docs/send-with-supabase-smtp)

### After saving

- Send a test OTP from `/auth/signin` or admin signup
- Check **Supabase → Authentication → Logs** for delivery errors
- Check **Resend → Logs** for SMTP-sent auth mail

---

## 4. Troubleshooting

- **Resend “domain not verified”** — re-run `node scripts/resend-domain-setup.mjs` and confirm DNS at your registrar.
- **OTP not arriving** — Supabase SMTP is separate from Vercel `RESEND_FROM_EMAIL`; fix §3 first.
- **Preview deploys fail to send** — preview uses `onboarding@resend.dev`; only sends to your Resend account’s allowed test addresses unless domain is verified.
- **Signup alerts not received** — confirm `NEW_SIGNUP_NOTIFY_EMAIL=pesttrace@gmail.com` on production and check Resend logs.
