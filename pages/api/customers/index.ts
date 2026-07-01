import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import {
  createCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from '../../../lib/crm/customerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;

    if (req.method === 'GET') {
      const includeArchived = req.query.includeArchived === '1';
      const customers = await listCustomers(prisma, companyId, includeArchived);
      return res.status(200).json({ customers });
    }

    if (req.method === 'POST') {
      const body = req.body as {
        name?: string;
        email?: string;
        phone?: string;
        notes?: string;
      };
      if (!body.name?.trim()) return res.status(400).json({ error: 'name is required' });
      const customer = await createCustomer(prisma, companyId, {
        name: body.name,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
      });
      return res.status(201).json({ customer });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  });
}
