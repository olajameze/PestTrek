import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { NextApiRequest } from 'next';

const COOKIE_NAME = 'pesttrace_super_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type SessionPayload = {
  role: 'super_admin';
  exp: number;
  /** Session id — rotated on each login. */
  sid: string;
  /** Optional bind to client network (SHA-256 of IP). */
  ipHash?: string;
};

function getSecret(): string | null {
  const secret = process.env.SUPER_ADMIN_SESSION_SECRET;
  return secret && secret.trim().length >= 16 ? secret : null;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function hashClientIpForSession(ip: string): string {
  return createHash('sha256').update(`pesttrace-sa:${ip}`).digest('base64url').slice(0, 22);
}

export function createSuperAdminToken(ip?: string, nowMs = Date.now()): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const payload: SessionPayload = {
    role: 'super_admin',
    exp: nowMs + SESSION_TTL_MS,
    sid: randomBytes(12).toString('base64url'),
    ...(ip && process.env.SUPER_ADMIN_BIND_IP !== '0' ? { ipHash: hashClientIpForSession(ip) } : {}),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

export function verifySuperAdminToken(
  token: string | undefined,
  opts?: { ip?: string; nowMs?: number },
): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  const nowMs = opts?.nowMs ?? Date.now();
  const [body, providedSignature] = token.split('.');
  if (!body || !providedSignature) return false;

  const expectedSignature = sign(body, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.role !== 'super_admin' || typeof payload.exp !== 'number' || payload.exp <= nowMs) {
      return false;
    }
    if (payload.ipHash && opts?.ip && process.env.SUPER_ADMIN_BIND_IP !== '0') {
      if (payload.ipHash !== hashClientIpForSession(opts.ip)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clientIpFromRequest(req: NextApiRequest): string {
  const xf = req.headers['x-forwarded-for'];
  const raw =
    typeof xf === 'string'
      ? xf.split(',')[0]?.trim()
      : Array.isArray(xf)
        ? xf[0]?.trim()
        : '';
  return raw || req.socket.remoteAddress || 'unknown';
}

export function getSuperAdminCookieName(): string {
  return COOKIE_NAME;
}

export function buildSetSuperAdminCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000,
  )}${secure}`;
}

export function buildClearSuperAdminCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function isSuperAdminCredential(email: string, password: string): boolean {
  const expectedEmail = process.env.SUPER_ADMIN_EMAIL;
  const expectedPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;
  return email.trim().toLowerCase() === expectedEmail.trim().toLowerCase() && password === expectedPassword;
}
