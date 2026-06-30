import type { PrismaClient } from '@prisma/client';
import { mapAppointments } from './mappers';
import {
  findAppointmentsInRange,
  findUnassignedScheduled,
} from './repositories/appointmentRepository';
import { canUseSmartScheduling } from './planAccess';
import type { SchedulingWidgetsData } from './types';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function emptySchedulingWidgets(): SchedulingWidgetsData {
  return {
    todayJobs: [],
    upcomingJobs: [],
    unassignedJobs: [],
    overdueJobs: [],
  };
}

export async function buildSchedulingWidgets(
  prisma: PrismaClient,
  companyId: string,
  plan: string | null | undefined,
): Promise<SchedulingWidgetsData> {
  if (!canUseSmartScheduling(plan)) {
    return emptySchedulingWidgets();
  }

  const now = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [todayRows, upcomingRows, unassignedRows] = await Promise.all([
    findAppointmentsInRange(prisma, companyId, todayStart, todayEnd),
    findAppointmentsInRange(prisma, companyId, now, weekEnd),
    findUnassignedScheduled(prisma, companyId),
  ]);

  const overdueRows = await prisma.appointment.findMany({
    where: {
      companyId,
      status: 'scheduled',
      scheduledEnd: { lt: now },
    },
    include: {
      appointmentTechnicians: {
        include: { technician: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { scheduledStart: 'asc' },
    take: 20,
  });

  return {
    todayJobs: mapAppointments(todayRows).filter((a) => a.status === 'scheduled'),
    upcomingJobs: mapAppointments(upcomingRows)
      .filter((a) => a.status === 'scheduled')
      .slice(0, 10),
    unassignedJobs: mapAppointments(unassignedRows).slice(0, 10),
    overdueJobs: mapAppointments(overdueRows),
  };
}
