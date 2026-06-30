import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import {
  assertCanMutate,
  createScheduledAppointment,
  listAppointments,
} from '../../../../lib/scheduling/appointmentService';
import { withSchedulingHandler } from '../../../../lib/scheduling/schedulingContext';
import { validateCreateAppointment, parseDate } from '../../../../lib/scheduling/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;

    if (req.method === 'GET') {
      const start = req.query.start ? parseDate(req.query.start, 'start') : new Date();
      const end = req.query.end
        ? parseDate(req.query.end, 'end')
        : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const technicianId =
        ctx.technicianId ??
        (typeof req.query.technicianId === 'string' ? req.query.technicianId : undefined);
      const appointments = await listAppointments(
        prisma,
        companyId,
        start,
        end,
        ctx.technicianId ?? technicianId,
      );
      return res.status(200).json({ appointments });
    }

    if (req.method === 'POST') {
      assertCanMutate(ctx.canWrite);
      const input = validateCreateAppointment(req.body);
      const appointment = await createScheduledAppointment(prisma, companyId, input);
      return res.status(201).json({ appointment });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  });
}
