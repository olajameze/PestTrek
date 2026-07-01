import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import { createSite } from '../../../lib/crm/customerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;

    if (req.method === 'POST') {
      const body = req.body as {
        customerId?: string;
        label?: string;
        address?: string;
        postcode?: string;
        accessNotes?: string;
        propertyType?: string;
      };
      if (!body.customerId) return res.status(400).json({ error: 'customerId is required' });
      const site = await createSite(prisma, companyId, {
        customerId: body.customerId,
        label: body.label,
        address: body.address ?? '',
        postcode: body.postcode,
        accessNotes: body.accessNotes,
        propertyType: body.propertyType,
      });
      return res.status(201).json({ site });
    }

    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  });
}
