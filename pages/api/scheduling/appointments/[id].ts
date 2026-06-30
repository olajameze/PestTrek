import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import {
  assertCanMutate,
  deleteScheduledAppointment,
  getAppointment,
  updateScheduledAppointment,
} from '../../../../lib/scheduling/appointmentService';
import { withSchedulingHandler } from '../../../../lib/scheduling/schedulingContext';
import {
  parseRecurrenceScope,
  parseOptionalString,
  parseDate,
  parseStringArray,
} from '../../../../lib/scheduling/validation';
import type { UpdateAppointmentInput } from '../../../../lib/scheduling/types';

function parseUpdateAppointment(body: unknown): UpdateAppointmentInput {
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const input: UpdateAppointmentInput = {};
  if (row.clientName !== undefined) input.clientName = parseOptionalString(row.clientName) ?? undefined;
  if (row.address !== undefined) input.address = parseOptionalString(row.address) ?? undefined;
  if (row.postcode !== undefined) input.postcode = parseOptionalString(row.postcode);
  if (row.treatment !== undefined) input.treatment = parseOptionalString(row.treatment);
  if (row.notes !== undefined) input.notes = parseOptionalString(row.notes);
  if (row.scheduledStart !== undefined) {
    input.scheduledStart = parseDate(row.scheduledStart, 'scheduledStart').toISOString();
  }
  if (row.scheduledEnd !== undefined) {
    input.scheduledEnd = parseDate(row.scheduledEnd, 'scheduledEnd').toISOString();
  }
  if (row.technicianIds !== undefined) input.technicianIds = parseStringArray(row.technicianIds);
  if (
    row.status === 'scheduled' ||
    row.status === 'completed' ||
    row.status === 'cancelled'
  ) {
    input.status = row.status;
  }
  return input;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await withSchedulingHandler(req, res, async (ctx) => {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return res.status(400).json({ error: 'Appointment id is required' });

    const companyId = ctx.company.id;
    const scope = parseRecurrenceScope(req.body?.scope ?? req.query.scope);

    if (req.method === 'GET') {
      const appointment = await getAppointment(prisma, companyId, id);
      if (ctx.technicianId) {
        const assigned = appointment.technicians.some((t) => t.id === ctx.technicianId);
        if (!assigned) return res.status(403).json({ error: 'Forbidden' });
      }
      return res.status(200).json({ appointment });
    }

    if (req.method === 'PATCH') {
      assertCanMutate(ctx.canWrite);
      const input = parseUpdateAppointment(req.body);
      const appointment = await updateScheduledAppointment(prisma, companyId, id, input, scope);
      return res.status(200).json({ appointment });
    }

    if (req.method === 'DELETE') {
      assertCanMutate(ctx.canWrite);
      await deleteScheduledAppointment(prisma, companyId, id, scope);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  });
}
