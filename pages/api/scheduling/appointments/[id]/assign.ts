import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { assignTechnician, unassignTechnician } from '../../../../../lib/scheduling/assignmentService';
import { assertCanMutate } from '../../../../../lib/scheduling/appointmentService';
import { withSchedulingHandler } from '../../../../../lib/scheduling/schedulingContext';
import { parseRequiredString, parseOptionalString } from '../../../../../lib/scheduling/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return res.status(400).json({ error: 'Appointment id is required' });

    assertCanMutate(ctx.canWrite);

    if (req.method === 'POST') {
      const technicianId = parseRequiredString(req.body?.technicianId, 'technicianId');
      const appointment = await assignTechnician(prisma, ctx.company.id, id, technicianId);
      return res.status(200).json({ appointment });
    }

    if (req.method === 'DELETE') {
      const technicianId =
        parseOptionalString(req.body?.technicianId) ??
        (typeof req.query.technicianId === 'string' ? req.query.technicianId : null);
      if (!technicianId) return res.status(400).json({ error: 'technicianId is required' });
      const appointment = await unassignTechnician(prisma, ctx.company.id, id, technicianId);
      return res.status(200).json({ appointment });
    }

    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  });
}
