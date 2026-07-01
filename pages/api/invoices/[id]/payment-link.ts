import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { prisma } from '../../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../../lib/businessFeatures/businessContext';
import { getInvoice } from '../../../../lib/invoicing/invoiceService';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });

    const invoiceId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!invoiceId) return res.status(400).json({ error: 'Invoice id is required' });

    const invoice = await getInvoice(prisma, ctx.company.id, invoiceId);
    if (invoice.stripePaymentLinkUrl) {
      return res.status(200).json({ url: invoice.stripePaymentLinkUrl });
    }
    const totalPence = Math.round(Number(invoice.total) * 100);
    const link = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: `Invoice ${invoice.number}` },
            unit_amount: totalPence,
          },
          quantity: 1,
        },
      ],
      metadata: { invoiceId: invoice.id, companyId: ctx.company.id },
    });
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { stripePaymentLinkUrl: link.url },
    });
    return res.status(200).json({ url: link.url });
  });
}
