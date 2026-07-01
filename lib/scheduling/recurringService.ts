import type { PrismaClient } from '@prisma/client';
import {
  createAppointment,
  deleteFutureByRecurringId,
  findFutureByRecurringId,
  setAppointmentTechnicians,
} from './repositories/appointmentRepository';
import { getCompanySchedule } from './repositories/availabilityRepository';
import {
  addExceptionDate,
  createRecurring,
  findRecurringById,
  updateRecurring,
} from './repositories/recurringRepository';
import { generateOccurrenceDates, toDayKey } from './recurringDates';
import type { CreateRecurringInput, RecurrenceScope } from './types';
import { NotFoundError } from './validation';
import { denormalizeFromSite, getSiteWithCustomer } from '../crm/customerService';

async function generateInstancesForRecurring(
  prisma: PrismaClient,
  recurringId: string,
  technicianIds: string[],
  fromDate?: Date,
): Promise<number> {
  const recurring = await prisma.recurringAppointment.findUnique({ where: { id: recurringId } });
  if (!recurring || !recurring.isActive) return 0;

  const schedule = await getCompanySchedule(prisma, recurring.companyId);
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + schedule.generationHorizonDays);

  const startFrom = fromDate ?? recurring.anchorStart;
  await deleteFutureByRecurringId(prisma, recurringId, startFrom);

  const exceptionDates = Array.isArray(recurring.exceptionDates)
    ? (recurring.exceptionDates as string[])
    : [];

  const dates = generateOccurrenceDates({
    anchorStart: recurring.anchorStart,
    horizonEnd,
    seriesEnd: recurring.endsAt,
    intervalType: recurring.intervalType as CreateRecurringInput['intervalType'],
    intervalDays: recurring.intervalDays,
    exceptionDates,
  }).filter((date) => date.getTime() >= startFrom.getTime());

  let created = 0;
  for (const occurrence of dates) {
    const scheduledEnd = new Date(occurrence.getTime() + recurring.durationMinutes * 60_000);
    const appointment = await createAppointment(prisma, {
      company: { connect: { id: recurring.companyId } },
      recurringAppointment: { connect: { id: recurringId } },
      clientName: recurring.clientName,
      address: recurring.address,
      postcode: recurring.postcode,
      treatment: recurring.treatment,
      notes: recurring.notes,
      scheduledStart: occurrence,
      scheduledEnd,
      status: 'scheduled',
      ...(recurring.customerId ? { customer: { connect: { id: recurring.customerId } } } : {}),
      ...(recurring.siteId ? { site: { connect: { id: recurring.siteId } } } : {}),
    });
    if (technicianIds.length > 0) {
      await setAppointmentTechnicians(prisma, appointment.id, technicianIds);
    }
    created += 1;
  }

  await updateRecurring(prisma, recurringId, { generatedUntil: horizonEnd });
  return created;
}

export async function createRecurringSeries(
  prisma: PrismaClient,
  companyId: string,
  input: CreateRecurringInput,
): Promise<{ recurringId: string; instancesCreated: number }> {
  const schedule = await getCompanySchedule(prisma, companyId);
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + schedule.generationHorizonDays);
  const anchorStart = new Date(input.anchorStart);

  let clientName = input.clientName;
  let address = input.address;
  let postcode = input.postcode ?? null;
  let customerId = input.customerId ?? null;
  let siteId = input.siteId ?? null;
  if (siteId) {
    const site = await getSiteWithCustomer(prisma, companyId, siteId);
    const denorm = denormalizeFromSite(site);
    clientName = denorm.clientName;
    address = denorm.address;
    postcode = denorm.postcode;
    customerId = site.customerId;
  }

  const recurring = await createRecurring(prisma, {
    company: { connect: { id: companyId } },
    intervalType: input.intervalType,
    intervalDays: input.intervalDays,
    anchorStart,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    generatedUntil: horizonEnd,
    exceptionDates: [],
    isActive: true,
    clientName,
    address,
    postcode,
    treatment: input.treatment,
    notes: input.notes,
    durationMinutes: input.durationMinutes ?? schedule.defaultDurationMinutes,
    ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
    ...(siteId ? { site: { connect: { id: siteId } } } : {}),
  });

  const instancesCreated = await generateInstancesForRecurring(
    prisma,
    recurring.id,
    input.technicianIds ?? [],
    anchorStart,
  );

  return { recurringId: recurring.id, instancesCreated };
}

export async function detachOccurrence(
  prisma: PrismaClient,
  companyId: string,
  appointmentId: string,
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
  });
  if (!appointment?.recurringAppointmentId) return;

  await addExceptionDate(prisma, appointment.recurringAppointmentId, toDayKey(appointment.scheduledStart));
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { recurringAppointmentId: null },
  });
}

export async function updateRecurringSeries(
  prisma: PrismaClient,
  companyId: string,
  recurringId: string,
  input: Partial<CreateRecurringInput>,
): Promise<void> {
  const recurring = await findRecurringById(prisma, companyId, recurringId);
  if (!recurring) throw new NotFoundError('Recurring series not found');

  let clientName = input.clientName;
  let address = input.address;
  let postcode = input.postcode;
  let customerId = input.customerId;
  let siteId = input.siteId;
  if (input.siteId) {
    const site = await getSiteWithCustomer(prisma, companyId, input.siteId);
    const denorm = denormalizeFromSite(site);
    clientName = denorm.clientName;
    address = denorm.address;
    postcode = denorm.postcode;
    customerId = site.customerId;
    siteId = site.id;
  }

  await updateRecurring(prisma, recurringId, {
    intervalType: input.intervalType ?? undefined,
    intervalDays: input.intervalDays ?? undefined,
    anchorStart: input.anchorStart ? new Date(input.anchorStart) : undefined,
    endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
    clientName: clientName ?? undefined,
    address: address ?? undefined,
    postcode: postcode ?? undefined,
    treatment: input.treatment ?? undefined,
    notes: input.notes ?? undefined,
    durationMinutes: input.durationMinutes ?? undefined,
    ...(customerId !== undefined
      ? customerId
        ? { customer: { connect: { id: customerId } } }
        : { customer: { disconnect: true } }
      : {}),
    ...(siteId !== undefined
      ? siteId
        ? { site: { connect: { id: siteId } } }
        : { site: { disconnect: true } }
      : {}),
  });

  const from = input.anchorStart ? new Date(input.anchorStart) : recurring.anchorStart;
  await generateInstancesForRecurring(prisma, recurringId, input.technicianIds ?? [], from);
}

export async function deleteRecurringWithScope(
  prisma: PrismaClient,
  companyId: string,
  appointmentId: string,
  scope: RecurrenceScope,
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
  });
  if (!appointment) throw new NotFoundError('Appointment not found');

  if (scope === 'occurrence' || !appointment.recurringAppointmentId) {
    if (appointment.recurringAppointmentId) {
      await detachOccurrence(prisma, companyId, appointmentId);
    }
    await prisma.appointment.delete({ where: { id: appointmentId } });
    return;
  }

  const recurringId = appointment.recurringAppointmentId;
  await deleteFutureByRecurringId(prisma, recurringId, appointment.scheduledStart);
  await updateRecurring(prisma, recurringId, { isActive: false });
}

export async function maybeExtendRecurringHorizon(prisma: PrismaClient, companyId: string): Promise<void> {
  const schedule = await getCompanySchedule(prisma, companyId);
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + schedule.generationHorizonDays);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 14);

  const series = await prisma.recurringAppointment.findMany({
    where: { companyId, isActive: true, generatedUntil: { lte: threshold } },
  });

  for (const item of series) {
    const techLinks = await findFutureByRecurringId(prisma, item.id, item.anchorStart);
    const technicianIds = techLinks[0]?.appointmentTechnicians.map((l) => l.technicianId) ?? [];
    await generateInstancesForRecurring(prisma, item.id, technicianIds, new Date());
  }
}

export { generateInstancesForRecurring };
