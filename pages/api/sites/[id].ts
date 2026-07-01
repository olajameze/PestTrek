import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import { updateSite } from '../../../lib/crm/customerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;
    const siteId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!siteId) return res.status(400).json({ error: 'Site id is required' });

    if (req.method === 'PATCH') {
      const body = req.body as {
        label?: string;
        address?: string;
        postcode?: string;
        accessNotes?: string;
        propertyType?: string;
        archived?: boolean;
      };
      const site = await updateSite(prisma, companyId, siteId, body);
      return res.status(200).json({ site });
    }

    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  });
}
