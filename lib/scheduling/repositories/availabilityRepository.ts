import type { Prisma, PrismaClient } from '@prisma/client';

export async function listAvailabilityForTechnicians(
  prisma: PrismaClient,
  technicianIds: string[],
) {
  if (technicianIds.length === 0) return [];
  return prisma.technicianAvailability.findMany({
    where: { technicianId: { in: technicianIds } },
    orderBy: [{ dayOfWeek: 'asc' }, { specificDate: 'asc' }],
  });
}

export async function createAvailability(
  prisma: PrismaClient,
  data: Prisma.TechnicianAvailabilityCreateInput,
) {
  return prisma.technicianAvailability.create({ data });
}

export async function ensureCompanySchedule(prisma: PrismaClient, companyId: string) {
  const existing = await prisma.schedule.findUnique({ where: { companyId } });
  if (existing) return existing;
  return prisma.schedule.create({ data: { company: { connect: { id: companyId } } } });
}

export async function getCompanySchedule(prisma: PrismaClient, companyId: string) {
  return ensureCompanySchedule(prisma, companyId);
}
