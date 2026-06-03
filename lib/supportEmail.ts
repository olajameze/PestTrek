/** Shared default when env vars are unset (keep in sync with lib/email.ts). */
export const DEFAULT_SUPPORT_EMAIL = 'compliance@pesttrace.com';

export function getServerSupportEmail(): string {
  return process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
}

/**
 * Use in browser-only UI. Prefer `NEXT_PUBLIC_SUPPORT_EMAIL` in `.env` (or set `SUPPORT_EMAIL` only;
 * `next.config.js` maps it for the client bundle when the public var is unset).
 */
export function getClientSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
}
