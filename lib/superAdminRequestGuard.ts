import type { NextApiRequest } from 'next';
import { clientIpFromRequest, getSuperAdminCookieName, verifySuperAdminToken } from './superAdminAuth';

export function isSuperAdminRequest(req: NextApiRequest): boolean {
  const token = req.cookies[getSuperAdminCookieName()];
  return verifySuperAdminToken(token, { ip: clientIpFromRequest(req) });
}
