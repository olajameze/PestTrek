import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCalendarAppointments } from '../../../lib/scheduling/calendarService';
import { withSchedulingHandler } from '../../../lib/scheduling/schedulingContext';
import { parseDate } from '../../../lib/scheduling/validation';
import type { CalendarView } from '../../../lib/scheduling/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const viewRaw = typeof req.query.view === 'string' ? req.query.view : 'week';
    const view: CalendarView =
      viewRaw === 'day' || viewRaw === 'week' || viewRaw === 'month' ? viewRaw : 'week';
    const anchor = req.query.start
      ? parseDate(req.query.start, 'start')
      : req.query.date
        ? parseDate(req.query.date, 'date')
        : new Date();

    const technicianId = ctx.technicianId ??
      (typeof req.query.technicianId === 'string' ? req.query.technicianId : undefined);

    const payload = await getCalendarAppointments(
      prisma,
      ctx.company.id,
      view,
      anchor,
      technicianId,
    );
    return res.status(200).json(payload);
  });
}
