import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../../lib/businessFeatures/businessContext';
import { getInvoice, type InvoiceLineItem } from '../../../../lib/invoicing/invoiceService';
import { buildInvoicePdf } from '../../../../lib/invoicing/invoicePdf';
import { parseEnterpriseSettings } from '../../../../lib/enterpriseFeatures';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const invoiceId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!invoiceId) return res.status(400).json({ error: 'Invoice id is required' });

    const invoice = await getInvoice(prisma, ctx.company.id, invoiceId);
    const branding = parseEnterpriseSettings(ctx.company.notificationPreferences).branding;
    const lineItems = (Array.isArray(invoice.lineItems) ? invoice.lineItems : []) as InvoiceLineItem[];
    const pdf = buildInvoicePdf({
      companyName: invoice.company.name ?? 'Invoice',
      companyAddress: invoice.company.address,
      companyEmail: invoice.company.email,
      companyPhone: invoice.company.phone,
      vatNumber: invoice.company.vatNumber,
      invoiceNumber: invoice.number,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      customerName: invoice.customer.name,
      customerEmail: invoice.customer.email,
      siteAddress: invoice.site
        ? `${invoice.site.address}${invoice.site.postcode ? `, ${invoice.site.postcode}` : ''}`
        : null,
      lineItems,
      subtotal: Number(invoice.subtotal),
      vatRate: Number(invoice.vatRate),
      vatAmount: Number(invoice.vatAmount),
      total: Number(invoice.total),
      primaryColor: branding.primaryColor,
      footerText: branding.footerText,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.number}.pdf"`);
    return res.status(200).send(pdf);
  });
}
