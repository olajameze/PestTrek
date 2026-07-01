import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import {
  createInvoiceFromLogbookEntry,
  listInvoices,
} from '../../../lib/invoicing/invoiceService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;

    if (req.method === 'GET') {
      const invoices = await listInvoices(prisma, companyId);
      return res.status(200).json({ invoices });
    }

    if (req.method === 'POST') {
      const { logbookEntryId } = req.body as { logbookEntryId?: string };
      if (!logbookEntryId) return res.status(400).json({ error: 'logbookEntryId is required' });
      const invoice = await createInvoiceFromLogbookEntry(prisma, companyId, logbookEntryId);
      return res.status(201).json({ invoice });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  });
}
