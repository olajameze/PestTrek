import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import {
  getTechnicianSchedule,
  getTechnicianWorkload,
} from '../../../../../lib/scheduling/assignmentService';
import { withSchedulingHandler } from '../../../../../lib/scheduling/schedulingContext';
import { parseDate } from '../../../../../lib/scheduling/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const technicianId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!technicianId) return res.status(400).json({ error: 'Technician id is required' });

    if (ctx.technicianId && ctx.technicianId !== technicianId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const start = req.query.start ? parseDate(req.query.start, 'start') : new Date();
    const end = req.query.end
      ? parseDate(req.query.end, 'end')
      : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [appointments, workload] = await Promise.all([
      getTechnicianSchedule(prisma, ctx.company.id, technicianId, start, end),
      getTechnicianWorkload(prisma, ctx.company.id, start, end),
    ]);

    const techWorkload = workload.find((row) => row.technicianId === technicianId) ?? null;
    return res.status(200).json({ appointments, workload: techWorkload, teamWorkload: workload });
  });
}
