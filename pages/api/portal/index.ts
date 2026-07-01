import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canUseEnterpriseFeatures } from '../../../lib/businessFeatures/planAccess';
import { resolveCustomerByPortalToken } from '../../../lib/portal/portalService';
import { verifySignedPortalLink } from '../../../lib/portal/portalSignedLink';
import { logGovernanceEvent } from '../../../lib/audit/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : '';
  const exp = typeof req.query.exp === 'string' ? Number.parseInt(req.query.exp, 10) : NaN;
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';

  let customer = token ? await resolveCustomerByPortalToken(prisma, token) : null;

  if (!customer && customerId && sig && Number.isFinite(exp)) {
    const row = await prisma.customer.findFirst({
      where: { id: customerId, portalEnabled: true, archivedAt: null },
      include: {
        company: { select: { id: true, name: true, plan: true, notificationPreferences: true } },
        sites: { where: { archivedAt: null } },
      },
    });
    if (row && verifySignedPortalLink(customerId, exp, sig, row.companyId) && canUseEnterpriseFeatures(row.company.plan)) {
      customer = row;
    }
  }

  if (!customer) {
    return res.status(404).json({ error: 'Portal link invalid or expired' });
  }

  await logGovernanceEvent('portal_view', { customerId: customer.id, companyId: customer.companyId });

  const jobs = await prisma.logbookEntry.findMany({
    where: { companyId: customer.companyId, customerId: customer.id, status: { equals: 'completed', mode: 'insensitive' } },
    orderBy: { date: 'desc' },
    take: 50,
    select: {
      id: true,
      date: true,
      treatment: true,
      address: true,
      postcode: true,
      siteId: true,
    },
  });

  const upcoming = await prisma.appointment.findMany({
    where: {
      companyId: customer.companyId,
      customerId: customer.id,
      status: 'scheduled',
      scheduledStart: { gte: new Date() },
    },
    orderBy: { scheduledStart: 'asc' },
    take: 10,
    select: { id: true, scheduledStart: true, address: true, treatment: true },
  });

  return res.status(200).json({
    customer: {
      name: customer.name,
      companyName: customer.company.name,
    },
    sites: customer.sites,
    jobs,
    upcoming,
  });
}
