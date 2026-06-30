import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { assertCanMutate } from '../../../../lib/scheduling/appointmentService';
import { updateRecurringSeries } from '../../../../lib/scheduling/recurringService';
import { deleteRecurring, findRecurringById } from '../../../../lib/scheduling/repositories/recurringRepository';
import { withSchedulingHandler } from '../../../../lib/scheduling/schedulingContext';
import { NotFoundError } from '../../../../lib/scheduling/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return res.status(400).json({ error: 'Recurring id is required' });

    const companyId = ctx.company.id;

    if (req.method === 'GET') {
      const series = await findRecurringById(prisma, companyId, id);
      if (!series) throw new NotFoundError('Recurring series not found');
      return res.status(200).json({ series });
    }

    if (req.method === 'PATCH') {
      assertCanMutate(ctx.canWrite);
      await updateRecurringSeries(prisma, companyId, id, req.body ?? {});
      const series = await findRecurringById(prisma, companyId, id);
      return res.status(200).json({ series });
    }

    if (req.method === 'DELETE') {
      assertCanMutate(ctx.canWrite);
      await deleteRecurring(prisma, id);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  });
}
