import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import { getInvoice, updateInvoiceStatus } from '../../../lib/invoicing/invoiceService';
import { logGovernanceEvent } from '../../../lib/audit/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    const invoiceId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!invoiceId) return res.status(400).json({ error: 'Invoice id is required' });

    if (req.method === 'GET') {
      const invoice = await getInvoice(prisma, ctx.company.id, invoiceId);
      return res.status(200).json({ invoice });
    }

    if (req.method === 'PATCH') {
      const { status } = req.body as { status?: 'draft' | 'sent' | 'paid' };
      if (!status) return res.status(400).json({ error: 'status is required' });
      const invoice = await updateInvoiceStatus(prisma, ctx.company.id, invoiceId, status);
      if (status === 'sent') {
        await logGovernanceEvent('invoice_sent', { companyId: ctx.company.id, invoiceId });
      }
      return res.status(200).json({ invoice });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  });
}
