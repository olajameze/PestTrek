import type { NextApiRequest, NextApiResponse } from 'next';
import { getSuperAdminCookieName, verifySuperAdminToken, clientIpFromRequest } from '../../../lib/superAdminAuth';
import { queryGrowthMetrics } from '../../../lib/superAdmin/queryGrowthMetrics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies[getSuperAdminCookieName()];
  if (!verifySuperAdminToken(token, { ip: clientIpFromRequest(req) })) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const metrics = await queryGrowthMetrics();
    return res.status(200).json(metrics);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('growth metrics failed', e);
    return res.status(500).json({ error: 'Unable to load growth metrics', details: msg });
  }
}
