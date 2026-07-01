import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withOwnerBusinessHandler } from '../../../lib/businessFeatures/businessContext';
import { getCustomerById, updateCustomer } from '../../../lib/crm/customerService';
import {
  disableCustomerPortal,
  enableCustomerPortal,
} from '../../../lib/portal/portalService';
import { logGovernanceEvent } from '../../../lib/audit/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withOwnerBusinessHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;
    const customerId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!customerId) return res.status(400).json({ error: 'Customer id is required' });

    if (req.method === 'GET') {
      const customer = await getCustomerById(prisma, companyId, customerId);
      return res.status(200).json({ customer });
    }

    if (req.method === 'PATCH') {
      const body = req.body as {
        name?: string;
        email?: string;
        phone?: string;
        notes?: string;
        archived?: boolean;
        portalAction?: 'enable' | 'disable' | 'regenerate';
      };

      if (body.portalAction) {
        if (body.portalAction === 'disable') {
          await disableCustomerPortal(prisma, companyId, customerId);
          await logGovernanceEvent('portal_disabled', { companyId, customerId });
          const customer = await getCustomerById(prisma, companyId, customerId);
          return res.status(200).json({ customer });
        }
        const portal = await enableCustomerPortal(
          prisma,
          companyId,
          ctx.company.plan,
          customerId,
        );
        await logGovernanceEvent(
          body.portalAction === 'regenerate' ? 'portal_token_regenerated' : 'portal_enabled',
          { companyId, customerId },
        );
        const customer = await getCustomerById(prisma, companyId, customerId);
        return res.status(200).json({ customer, portal });
      }

      const customer = await updateCustomer(prisma, companyId, customerId, body);
      return res.status(200).json({ customer });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  });
}
