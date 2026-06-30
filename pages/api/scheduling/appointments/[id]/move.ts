import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { assertCanMutate, moveScheduledAppointment } from '../../../../../lib/scheduling/appointmentService';
import { withSchedulingHandler } from '../../../../../lib/scheduling/schedulingContext';
import { validateMoveAppointment } from '../../../../../lib/scheduling/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return res.status(400).json({ error: 'Appointment id is required' });

    if (req.method !== 'PATCH') {
      res.setHeader('Allow', ['PATCH']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    assertCanMutate(ctx.canWrite);
    const input = validateMoveAppointment(req.body);
    const appointment = await moveScheduledAppointment(prisma, ctx.company.id, id, input);
    return res.status(200).json({ appointment });
  });
}
