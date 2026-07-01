import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import { listOpenComplianceAlerts } from '../../../lib/compliance/recurringVisitAlerts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const alerts = await listOpenComplianceAlerts(prisma, ctx.company.id);
    return res.status(200).json({ alerts });
  });
}
