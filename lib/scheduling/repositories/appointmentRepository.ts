import type { Prisma, PrismaClient } from '@prisma/client';
import type { AppointmentStatus } from '../types';

const includeTechnicians = {
  appointmentTechnicians: {
    include: {
      technician: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

export type AppointmentWithTechnicians = Prisma.AppointmentGetPayload<{
  include: typeof includeTechnicians;
}>;

export async function findAppointmentsInRange(
  prisma: PrismaClient,
  companyId: string,
  start: Date,
  end: Date,
  technicianId?: string,
): Promise<AppointmentWithTechnicians[]> {
  const where: Prisma.AppointmentWhereInput = {
    companyId,
    scheduledStart: { lt: end },
    scheduledEnd: { gt: start },
    status: { not: 'cancelled' },
  };
  if (technicianId) {
    where.appointmentTechnicians = { some: { technicianId } };
  }
  return prisma.appointment.findMany({
    where,
    include: includeTechnicians,
    orderBy: { scheduledStart: 'asc' },
  });
}

export async function findAppointmentById(
  prisma: PrismaClient,
  companyId: string,
  id: string,
): Promise<AppointmentWithTechnicians | null> {
  return prisma.appointment.findFirst({
    where: { id, companyId },
    include: includeTechnicians,
  });
}

export async function createAppointment(
  prisma: PrismaClient,
  data: Prisma.AppointmentCreateInput,
): Promise<AppointmentWithTechnicians> {
  return prisma.appointment.create({ data, include: includeTechnicians });
}

export async function updateAppointment(
  prisma: PrismaClient,
  id: string,
  data: Prisma.AppointmentUpdateInput,
): Promise<AppointmentWithTechnicians> {
  return prisma.appointment.update({ where: { id }, data, include: includeTechnicians });
}

export async function deleteAppointment(prisma: PrismaClient, id: string): Promise<void> {
  await prisma.appointment.delete({ where: { id } });
}

export async function findOverlappingForTechnicians(
  prisma: PrismaClient,
  companyId: string,
  technicianIds: string[],
  start: Date,
  end: Date,
  excludeAppointmentId?: string,
): Promise<AppointmentWithTechnicians[]> {
  if (technicianIds.length === 0) return [];
  return prisma.appointment.findMany({
    where: {
      companyId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      status: 'scheduled',
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
      appointmentTechnicians: { some: { technicianId: { in: technicianIds } } },
    },
    include: includeTechnicians,
  });
}

export async function findUnassignedScheduled(
  prisma: PrismaClient,
  companyId: string,
  before?: Date,
): Promise<AppointmentWithTechnicians[]> {
  return prisma.appointment.findMany({
    where: {
      companyId,
      status: 'scheduled',
      appointmentTechnicians: { none: {} },
      ...(before ? { scheduledStart: { lt: before } } : {}),
    },
    include: includeTechnicians,
    orderBy: { scheduledStart: 'asc' },
    take: 50,
  });
}

export async function setAppointmentTechnicians(
  prisma: PrismaClient,
  appointmentId: string,
  technicianIds: string[],
): Promise<void> {
  await prisma.appointmentTechnician.deleteMany({ where: { appointmentId } });
  if (technicianIds.length === 0) return;
  await prisma.appointmentTechnician.createMany({
    data: technicianIds.map((technicianId) => ({ appointmentId, technicianId })),
    skipDuplicates: true,
  });
}

export async function updateAppointmentStatus(
  prisma: PrismaClient,
  id: string,
  status: AppointmentStatus,
): Promise<AppointmentWithTechnicians> {
  return updateAppointment(prisma, id, { status });
}

export async function findFutureByRecurringId(
  prisma: PrismaClient,
  recurringId: string,
  from: Date,
): Promise<AppointmentWithTechnicians[]> {
  return prisma.appointment.findMany({
    where: {
      recurringAppointmentId: recurringId,
      scheduledStart: { gte: from },
      status: 'scheduled',
    },
    include: includeTechnicians,
    orderBy: { scheduledStart: 'asc' },
  });
}

export async function deleteFutureByRecurringId(
  prisma: PrismaClient,
  recurringId: string,
  from: Date,
): Promise<void> {
  await prisma.appointment.deleteMany({
    where: {
      recurringAppointmentId: recurringId,
      scheduledStart: { gte: from },
      status: 'scheduled',
    },
  });
}
