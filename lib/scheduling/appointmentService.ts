import type { PrismaClient } from '@prisma/client';
import { assertNoTechnicianConflicts } from './conflictService';
import { syncLogbookOnComplete } from './logbookSync';
import { mapAppointment, mapAppointments } from './mappers';
import { notifySchedulingCancelled, notifySchedulingMoved } from './notifySchedulingEvent';
import {
  createAppointment,
  deleteAppointment,
  findAppointmentById,
  findAppointmentsInRange,
  setAppointmentTechnicians,
  updateAppointment,
} from './repositories/appointmentRepository';
import { getCompanySchedule } from './repositories/availabilityRepository';
import { detachOccurrence, deleteRecurringWithScope, maybeExtendRecurringHorizon } from './recurringService';
import type {
  AppointmentDTO,
  CreateAppointmentInput,
  MoveAppointmentInput,
  RecurrenceScope,
  UpdateAppointmentInput,
} from './types';
import { ForbiddenError, NotFoundError } from './validation';

async function validateTechnicians(
  prisma: PrismaClient,
  companyId: string,
  technicianIds: string[],
): Promise<void> {
  if (technicianIds.length === 0) return;
  const count = await prisma.technician.count({
    where: { companyId, id: { in: technicianIds } },
  });
  if (count !== technicianIds.length) {
    throw new NotFoundError('Invalid technician(s)');
  }
}

export async function listAppointments(
  prisma: PrismaClient,
  companyId: string,
  start: Date,
  end: Date,
  technicianId?: string,
): Promise<AppointmentDTO[]> {
  await maybeExtendRecurringHorizon(prisma, companyId);
  const rows = await findAppointmentsInRange(prisma, companyId, start, end, technicianId);
  return mapAppointments(rows);
}

export async function getAppointment(
  prisma: PrismaClient,
  companyId: string,
  id: string,
): Promise<AppointmentDTO> {
  const row = await findAppointmentById(prisma, companyId, id);
  if (!row) throw new NotFoundError('Appointment not found');
  return mapAppointment(row);
}

export async function createScheduledAppointment(
  prisma: PrismaClient,
  companyId: string,
  input: CreateAppointmentInput,
): Promise<AppointmentDTO> {
  const schedule = await getCompanySchedule(prisma, companyId);
  const start = new Date(input.scheduledStart);
  let end = new Date(input.scheduledEnd);
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + schedule.defaultDurationMinutes * 60_000);
  }

  const technicianIds = input.technicianIds ?? [];
  await validateTechnicians(prisma, companyId, technicianIds);
  await assertNoTechnicianConflicts(prisma, companyId, technicianIds, start, end);

  const row = await createAppointment(prisma, {
    company: { connect: { id: companyId } },
    clientName: input.clientName,
    address: input.address,
    postcode: input.postcode,
    treatment: input.treatment,
    notes: input.notes,
    scheduledStart: start,
    scheduledEnd: end,
    status: 'scheduled',
    ...(input.logbookEntryId
      ? { logbookEntry: { connect: { id: input.logbookEntryId } } }
      : {}),
  });

  if (technicianIds.length > 0) {
    await setAppointmentTechnicians(prisma, row.id, technicianIds);
  }

  return getAppointment(prisma, companyId, row.id);
}

export async function updateScheduledAppointment(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  input: UpdateAppointmentInput,
  scope: RecurrenceScope = 'occurrence',
): Promise<AppointmentDTO> {
  const existing = await findAppointmentById(prisma, companyId, id);
  if (!existing) throw new NotFoundError('Appointment not found');

  if (scope === 'occurrence' && existing.recurringAppointmentId) {
    await detachOccurrence(prisma, companyId, id);
  }

  const start = input.scheduledStart ? new Date(input.scheduledStart) : existing.scheduledStart;
  const end = input.scheduledEnd ? new Date(input.scheduledEnd) : existing.scheduledEnd;
  const technicianIds =
    input.technicianIds !== undefined
      ? input.technicianIds
      : existing.appointmentTechnicians.map((link) => link.technicianId);

  await validateTechnicians(prisma, companyId, technicianIds);
  if (existing.status === 'scheduled') {
    await assertNoTechnicianConflicts(prisma, companyId, technicianIds, start, end, id);
  }

  const previousStart = existing.scheduledStart.toISOString();
  const status = input.status ?? (existing.status as UpdateAppointmentInput['status']);

  await updateAppointment(prisma, id, {
    clientName: input.clientName ?? undefined,
    address: input.address ?? undefined,
    postcode: input.postcode === undefined ? undefined : input.postcode,
    treatment: input.treatment === undefined ? undefined : input.treatment,
    notes: input.notes === undefined ? undefined : input.notes,
    scheduledStart: input.scheduledStart ? start : undefined,
    scheduledEnd: input.scheduledEnd ? end : undefined,
    status: status ?? undefined,
  });

  if (input.technicianIds !== undefined) {
    await setAppointmentTechnicians(prisma, id, technicianIds);
  }

  if (status === 'completed') {
    await syncLogbookOnComplete(prisma, companyId, id);
  }

  const updated = await getAppointment(prisma, companyId, id);

  if (
    existing.status === 'scheduled' &&
    status !== 'cancelled' &&
    (input.scheduledStart || input.scheduledEnd) &&
    updated.scheduledStart !== previousStart
  ) {
    await notifySchedulingMoved(prisma, companyId, updated);
  }

  if (status === 'cancelled' && existing.status !== 'cancelled') {
    await notifySchedulingCancelled(prisma, companyId, updated);
  }

  return updated;
}

export async function moveScheduledAppointment(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  input: MoveAppointmentInput,
): Promise<AppointmentDTO> {
  return updateScheduledAppointment(
    prisma,
    companyId,
    id,
    {
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
    },
    input.scope ?? 'occurrence',
  );
}

export async function deleteScheduledAppointment(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  scope: RecurrenceScope = 'occurrence',
): Promise<void> {
  const existing = await findAppointmentById(prisma, companyId, id);
  if (!existing) throw new NotFoundError('Appointment not found');

  if (existing.recurringAppointmentId) {
    await deleteRecurringWithScope(prisma, companyId, id, scope);
    if (existing.status === 'scheduled') {
      await notifySchedulingCancelled(prisma, companyId, mapAppointment(existing));
    }
    return;
  }

  if (existing.status === 'scheduled') {
    await notifySchedulingCancelled(prisma, companyId, mapAppointment(existing));
  }
  await deleteAppointment(prisma, id);
}

export async function cancelScheduledAppointment(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  scope: RecurrenceScope = 'occurrence',
): Promise<AppointmentDTO> {
  if (scope === 'series') {
    const existing = await findAppointmentById(prisma, companyId, id);
    if (!existing) throw new NotFoundError('Appointment not found');
    if (existing.recurringAppointmentId) {
      await deleteRecurringWithScope(prisma, companyId, id, 'series');
      return getAppointment(prisma, companyId, id).catch(() => mapAppointment(existing));
    }
  }
  return updateScheduledAppointment(prisma, companyId, id, { status: 'cancelled' }, scope);
}

export function assertCanMutate(canWrite: boolean): void {
  if (!canWrite) {
    throw new ForbiddenError('You do not have permission to modify scheduling');
  }
}
