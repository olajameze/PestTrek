import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import {
  clientIpFromRequest,
  getSuperAdminCookieName,
  verifySuperAdminToken,
} from '../../../lib/superAdminAuth';
import { billingRowsByNormalizedEmail, mergeUserBilling } from '../../../lib/superAdmin/billingForUserEmails';
import type { UserBillingRow } from '../../../lib/superAdmin/billingForUserEmails';
import { countUserRoleStats } from '../../../lib/superAdmin/countUserRoleStats';
import { listAuthUsersForAdmin } from '../../../lib/superAdmin/listAuthUsersForAdmin';

type BaseUser = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  role: string;
  bannedUntil: string | null;
  isProtected: boolean;
};

type SafeUser = BaseUser & UserBillingRow;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies[getSuperAdminCookieName()];
  if (!verifySuperAdminToken(token, { ip: clientIpFromRequest(req) })) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client not configured' });
  }

  const requestedPage = Number(req.query.page ?? 1);
  const requestedPerPage = Number(req.query.perPage ?? 50);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const perPage =
    Number.isFinite(requestedPerPage) && requestedPerPage > 0
      ? Math.min(200, Math.floor(requestedPerPage))
      : 50;

  const emailSearch =
    typeof req.query.email === 'string' && req.query.email.trim() ? req.query.email.trim() : undefined;

  const includeStats = req.query.stats === '1' || req.query.stats === 'true';

  try {
    const [listed, roleStats] = await Promise.all([
      listAuthUsersForAdmin(admin, { page, perPage, emailSearch }),
      includeStats ? countUserRoleStats(admin) : Promise.resolve(null),
    ]);

    const protectedEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
    const baseUsers: BaseUser[] = listed.users.map((u) => ({
      ...u,
      isProtected: protectedEmail.length > 0 && u.email.trim().toLowerCase() === protectedEmail,
    }));

    const billingMap = await billingRowsByNormalizedEmail(baseUsers.map((u) => u.email));
    const users: SafeUser[] = baseUsers.map((u) => mergeUserBilling(u, billingMap));

    return res.status(200).json({
      users,
      page: listed.page,
      perPage: listed.perPage,
      total: listed.total,
      searchActive: listed.searchActive,
      ...(roleStats ? { roleStats } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
