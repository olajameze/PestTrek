import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_SECRET =
  process.env.PORTAL_LINK_SECRET ||
  process.env.SUPER_ADMIN_SESSION_SECRET ||
  process.env.INTELLIGENCE_SOURCE_SECRET ||
  'dev-portal-link-secret-change-me';

export function createSignedPortalLink(customerId: string, companyId: string, ttlDays = 30): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 3600;
  const payload = `${customerId}:${companyId}:${exp}`;
  const sig = createHmac('sha256', DEFAULT_SECRET).update(payload).digest('base64url');
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/portal/access?customerId=${encodeURIComponent(customerId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
}

export function verifySignedPortalLink(
  customerId: string,
  exp: number,
  sig: string,
  companyId: string,
): boolean {
  if (!customerId || !sig || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${customerId}:${companyId}:${exp}`;
  const expected = createHmac('sha256', DEFAULT_SECRET).update(payload).digest('base64url');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return expected === sig;
  }
}
