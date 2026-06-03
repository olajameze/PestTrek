import { createHash } from 'crypto';
import type { NextApiRequest } from 'next';
import { prisma } from '../prisma';

const FAIL_ACTION = 'super_admin_login_fail';
const MAX_FAILS_PER_HOUR = 8;
const WINDOW_MS = 60 * 60 * 1000;

export function clientIpForRateLimit(req: NextApiRequest): string {
  const xf = req.headers['x-forwarded-for'];
  const raw =
    typeof xf === 'string'
      ? xf.split(',')[0]?.trim()
      : Array.isArray(xf)
        ? xf[0]?.trim()
        : '';
  return raw || req.socket.remoteAddress || 'unknown';
}

function ipHash(ip: string): string {
  return createHash('sha256').update(`super-admin-login:${ip}`).digest('hex').slice(0, 32);
}

export async function recordSuperAdminLoginFailure(ip: string): Promise<void> {
  try {
    await prisma.intelligenceAuditLog.create({
      data: {
        action: FAIL_ACTION,
        detail: { ipHash: ipHash(ip), at: new Date().toISOString() },
      },
    });
  } catch (e) {
    console.error('super_admin login fail audit', e);
  }
}

export async function checkSuperAdminLoginRateLimit(
  ip: string,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const since = new Date(Date.now() - WINDOW_MS);
  const hash = ipHash(ip);
  try {
    const recent = await prisma.intelligenceAuditLog.findMany({
      where: { action: FAIL_ACTION, createdAt: { gte: since } },
      select: { detail: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const fails = recent.filter((r) => {
      const d = r.detail as { ipHash?: string } | null;
      return d?.ipHash === hash;
    }).length;
    if (fails >= MAX_FAILS_PER_HOUR) {
      return { allowed: false, retryAfterSec: 3600 };
    }
    return { allowed: true };
  } catch (e) {
    console.error('super_admin login rate limit check', e);
    return { allowed: true };
  }
}
