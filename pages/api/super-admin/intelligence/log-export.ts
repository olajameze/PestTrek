import type { NextApiRequest, NextApiResponse } from 'next';
import { isSuperAdminRequest } from '../../../../lib/superAdminRequestGuard';
import { writeIntelligenceAudit } from '../../../../lib/intelligence/writeIntelligenceAudit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSuperAdminRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const format = typeof req.body?.format === 'string' ? req.body.format : 'unknown';
  const dateFrom = typeof req.body?.dateFrom === 'string' ? req.body.dateFrom : undefined;
  const dateTo = typeof req.body?.dateTo === 'string' ? req.body.dateTo : undefined;

  await writeIntelligenceAudit(`intelligence_export_${format}`, {
    dateFrom,
    dateTo,
  });

  return res.status(200).json({ ok: true });
}
