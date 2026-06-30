import type { Prisma, PrismaClient } from '@prisma/client';

export type RecurringWithCount = Prisma.RecurringAppointmentGetPayload<object>;

export async function findRecurringById(
  prisma: PrismaClient,
  companyId: string,
  id: string,
): Promise<RecurringWithCount | null> {
  return prisma.recurringAppointment.findFirst({ where: { id, companyId } });
}

export async function listRecurring(
  prisma: PrismaClient,
  companyId: string,
): Promise<RecurringWithCount[]> {
  return prisma.recurringAppointment.findMany({
    where: { companyId, isActive: true },
    orderBy: { anchorStart: 'asc' },
  });
}

export async function createRecurring(
  prisma: PrismaClient,
  data: Prisma.RecurringAppointmentCreateInput,
): Promise<RecurringWithCount> {
  return prisma.recurringAppointment.create({ data });
}

export async function updateRecurring(
  prisma: PrismaClient,
  id: string,
  data: Prisma.RecurringAppointmentUpdateInput,
): Promise<RecurringWithCount> {
  return prisma.recurringAppointment.update({ where: { id }, data });
}

export async function deleteRecurring(prisma: PrismaClient, id: string): Promise<void> {
  await prisma.recurringAppointment.delete({ where: { id } });
}

export function parseExceptionDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

export async function addExceptionDate(
  prisma: PrismaClient,
  recurringId: string,
  dateIso: string,
): Promise<string[]> {
  const row = await prisma.recurringAppointment.findUnique({ where: { id: recurringId } });
  if (!row) return [];
  const existing = parseExceptionDates(row.exceptionDates);
  const dayKey = dateIso.slice(0, 10);
  if (existing.includes(dayKey)) return existing;
  const next = [...existing, dayKey];
  await prisma.recurringAppointment.update({
    where: { id: recurringId },
    data: { exceptionDates: next },
  });
  return next;
}
