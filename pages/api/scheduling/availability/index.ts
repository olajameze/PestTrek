import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { assertCanMutate } from '../../../../lib/scheduling/appointmentService';
import {
  createAvailability,
  listAvailabilityForTechnicians,
} from '../../../../lib/scheduling/repositories/availabilityRepository';
import { withSchedulingHandler } from '../../../../lib/scheduling/schedulingContext';
import { parseRequiredString } from '../../../../lib/scheduling/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    const companyId = ctx.company.id;

    if (req.method === 'GET') {
      const technicianId =
        typeof req.query.technicianId === 'string' ? req.query.technicianId : ctx.technicianId;
      const technicians = await prisma.technician.findMany({
        where: { companyId, ...(technicianId ? { id: technicianId } : {}) },
        select: { id: true },
      });
      const blocks = await listAvailabilityForTechnicians(
        prisma,
        technicians.map((t) => t.id),
      );
      return res.status(200).json({ availability: blocks });
    }

    if (req.method === 'POST') {
      assertCanMutate(ctx.canWrite);
      const technicianId = parseRequiredString(req.body?.technicianId, 'technicianId');
      const startTime = parseRequiredString(req.body?.startTime, 'startTime');
      const endTime = parseRequiredString(req.body?.endTime, 'endTime');
      const tech = await prisma.technician.findFirst({ where: { id: technicianId, companyId } });
      if (!tech) return res.status(404).json({ error: 'Technician not found' });

      const block = await createAvailability(prisma, {
        technician: { connect: { id: technicianId } },
        dayOfWeek: typeof req.body?.dayOfWeek === 'number' ? req.body.dayOfWeek : null,
        specificDate: req.body?.specificDate ? new Date(req.body.specificDate) : null,
        startTime,
        endTime,
        isAvailable: req.body?.isAvailable !== false,
      });
      return res.status(201).json({ availability: block });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  });
}
