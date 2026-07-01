import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import { invoicesToXeroCsv, listInvoices } from '../../../lib/invoicing/invoiceService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const invoices = await listInvoices(prisma, ctx.company.id);
    const csv = invoicesToXeroCsv(invoices);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices-xero.csv"');
    return res.status(200).send(csv);
  });
}
