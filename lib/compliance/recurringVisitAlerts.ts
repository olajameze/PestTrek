import type { PrismaClient } from '@prisma/client';

export type RecurringAlertCandidate = {
  type: 'missed_recurring_visit' | 'overdue_follow_up' | 'contract_gap';
  entityType: string;
  entityId: string;
  message: string;
};

export async function detectComplianceAlerts(
  prisma: PrismaClient,
  companyId: string,
  now = new Date(),
): Promise<RecurringAlertCandidate[]> {
  const alerts: RecurringAlertCandidate[] = [];
  const pastWindowStart = new Date(now);
  pastWindowStart.setDate(pastWindowStart.getDate() - 7);

  const missedAppointments = await prisma.appointment.findMany({
    where: {
      companyId,
      status: 'scheduled',
      scheduledEnd: { lt: now, gte: pastWindowStart },
      recurringAppointmentId: { not: null },
    },
    select: { id: true, clientName: true, address: true, scheduledStart: true },
  });
  for (const appt of missedAppointments) {
    alerts.push({
      type: 'missed_recurring_visit',
      entityType: 'appointment',
      entityId: appt.id,
      message: `Missed recurring visit for ${appt.clientName} at ${appt.address} (scheduled ${appt.scheduledStart.toLocaleDateString('en-GB')})`,
    });
  }

  const overdueFollowUps = await prisma.logbookEntry.findMany({
    where: {
      companyId,
      followUpDate: { lt: now },
      NOT: { status: { equals: 'completed', mode: 'insensitive' } },
    },
    select: { id: true, clientName: true, address: true, followUpDate: true },
    take: 50,
  });
  for (const entry of overdueFollowUps) {
    alerts.push({
      type: 'overdue_follow_up',
      entityType: 'logbook_entry',
      entityId: entry.id,
      message: `Overdue follow-up for ${entry.clientName} at ${entry.address} (due ${entry.followUpDate?.toLocaleDateString('en-GB') ?? 'unknown'})`,
    });
  }

  const activeRecurring = await prisma.recurringAppointment.findMany({
    where: { companyId, isActive: true },
    select: { id: true, clientName: true, intervalType: true, anchorStart: true },
  });
  for (const series of activeRecurring) {
    const since = new Date(now);
    since.setDate(since.getDate() - 45);
    const completed = await prisma.appointment.count({
      where: {
        companyId,
        recurringAppointmentId: series.id,
        status: 'completed',
        scheduledStart: { gte: since },
      },
    });
    if (completed === 0) {
      alerts.push({
        type: 'contract_gap',
        entityType: 'recurring_appointment',
        entityId: series.id,
        message: `No completed visits in 45 days for recurring contract: ${series.clientName} (${series.intervalType})`,
      });
    }
  }

  return alerts;
}

export async function upsertComplianceAlerts(
  prisma: PrismaClient,
  companyId: string,
  candidates: RecurringAlertCandidate[],
): Promise<number> {
  let created = 0;
  for (const alert of candidates) {
    await prisma.complianceAlert.upsert({
      where: {
        companyId_type_entityType_entityId: {
          companyId,
          type: alert.type,
          entityType: alert.entityType,
          entityId: alert.entityId,
        },
      },
      create: {
        companyId,
        type: alert.type,
        entityType: alert.entityType,
        entityId: alert.entityId,
        message: alert.message,
      },
      update: { message: alert.message, resolvedAt: null },
    });
    created += 1;
  }
  return created;
}

export async function resolveStaleComplianceAlerts(
  prisma: PrismaClient,
  companyId: string,
  activeKeys: Set<string>,
): Promise<void> {
  const open = await prisma.complianceAlert.findMany({
    where: { companyId, resolvedAt: null },
  });
  for (const row of open) {
    const key = `${row.type}:${row.entityType}:${row.entityId}`;
    if (!activeKeys.has(key)) {
      await prisma.complianceAlert.update({
        where: { id: row.id },
        data: { resolvedAt: new Date() },
      });
    }
  }
}

export async function listOpenComplianceAlerts(prisma: PrismaClient, companyId: string) {
  return prisma.complianceAlert.findMany({
    where: { companyId, resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
