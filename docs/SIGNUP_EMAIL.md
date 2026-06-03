# Signup / welcome email (Resend)

## Current behaviour

After **business** signup, the client calls `POST /api/auth/welcome` (`pages/api/auth/welcome.ts`), which:

1. Records the lead in `signupMarketingLead`
2. Sends `sendWelcomeEmail` to the new user
3. Sends `sendNewSignupNotification` to the operator inbox (`NEW_SIGNUP_NOTIFY_EMAIL`, default `pesttrace@gmail.com`)

After **technician** signup, `POST /api/auth/technician-signup` creates the auth user and sends the same operator notification (non-blocking if it fails).

All app-sent mail uses **Resend** via `lib/email.ts` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`).

## Environment variables

| Variable | Role |
|----------|------|
| `RESEND_API_KEY` | Server-side Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `alerts@pesttrace.com` |
| `SUPPORT_EMAIL` | Reply-to / support contact in templates, e.g. `compliance@pesttrace.com` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Browser mailto links |
| `NEW_SIGNUP_NOTIFY_EMAIL` | Where internal signup alerts are delivered (default `pesttrace@gmail.com`) |

## Supabase Auth SMTP

OTP / magic link delivery uses **Supabase SMTP**, not `RESEND_FROM_EMAIL`. See **[EMAIL_PRODUCTION_SETUP.md](./EMAIL_PRODUCTION_SETUP.md)** for SMTP host/port and dashboard steps. Run `node scripts/print-supabase-smtp-checklist.mjs` for a copy-paste checklist.

## Resend domain setup (production)

1. Add and verify `pesttrace.com` in the Resend dashboard (SPF/DKIM).
2. Set Vercel env: `RESEND_FROM_EMAIL=alerts@pesttrace.com`, `SUPPORT_EMAIL=compliance@pesttrace.com`, `NEW_SIGNUP_NOTIFY_EMAIL=pesttrace@gmail.com`.
3. Configure Supabase Auth SMTP to the same verified domain.
