import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { assertCanMutate } from '../../../../lib/scheduling/appointmentService';
import { createRecurringSeries } from '../../../../lib/scheduling/recurringService';
import { listRecurring } from '../../../../lib/scheduling/repositories/recurringRepository';
import { withSchedulingHandler } from '../../../../lib/scheduling/schedulingContext';
import { validateCreateRecurring } from '../../../../lib/scheduling/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;

    if (req.method === 'GET') {
      const series = await listRecurring(prisma, companyId);
      return res.status(200).json({ series });
    }

    if (req.method === 'POST') {
      assertCanMutate(ctx.canWrite);
      const input = validateCreateRecurring(req.body);
      const result = await createRecurringSeries(prisma, companyId, input);
      return res.status(201).json(result);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  });
}
