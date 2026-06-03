import type { NextApiRequest, NextApiResponse } from 'next';
import { clientIpFromRequest, getSuperAdminCookieName, verifySuperAdminToken } from '../../../lib/superAdminAuth';
import {
  previewExpiredTrialUpgradeCampaign,
  runExpiredTrialUpgradeCampaign,
} from '../../../lib/trial/sendExpiredTrialUpgradeCampaign';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies[getSuperAdminCookieName()];
  if (!verifySuperAdminToken(token, { ip: clientIpFromRequest(req) })) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { pending, alreadySent } = await previewExpiredTrialUpgradeCampaign();
      return res.status(200).json({
        pendingCount: pending.length,
        alreadySentCount: alreadySent,
        pending: pending.slice(0, 50).map((r) => ({
          email: r.email,
          companyName: r.companyName,
          trialEndedAt: r.trialEndedAt,
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ error: 'Preview failed', details: msg });
    }
  }

  if (req.method === 'POST') {
    const dryRun = req.body?.dryRun === true;
    const force = req.body?.force === true;
    try {
      const result = await runExpiredTrialUpgradeCampaign({ dryRun, force });
      return res.status(200).json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ error: 'Campaign failed', details: msg });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
