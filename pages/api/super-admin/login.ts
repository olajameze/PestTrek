import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildSetSuperAdminCookie,
  clientIpFromRequest,
  createSuperAdminToken,
  isSuperAdminCredential,
} from '../../../lib/superAdminAuth';
import {
  checkSuperAdminLoginRateLimit,
  clientIpForRateLimit,
  recordSuperAdminLoginFailure,
} from '../../../lib/superAdmin/loginRateLimit';
import { writeAuditLog } from '../../../lib/audit/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIpForRateLimit(req);
  const rate = await checkSuperAdminLoginRateLimit(ip);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec ?? 3600));
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!isSuperAdminCredential(email, password)) {
    await recordSuperAdminLoginFailure(ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = createSuperAdminToken(clientIpFromRequest(req));
  if (!token) {
    return res.status(500).json({ error: 'Super admin auth is not configured on this environment' });
  }

  const requesterId = `super_admin:${(process.env.SUPER_ADMIN_EMAIL ?? 'operator').trim().toLowerCase()}`;
  await writeAuditLog({
    userId: requesterId,
    action: 'CREATE',
    tableName: 'super_admin',
    recordId: requesterId,
    newValues: { action: 'login_success' },
    ipAddress: ip,
  }).catch((e) => console.error('super_admin login audit', e));

  res.setHeader('Set-Cookie', buildSetSuperAdminCookie(token));
  return res.status(200).json({ ok: true });
}
