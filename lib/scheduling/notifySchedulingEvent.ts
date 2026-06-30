import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { parseNotifications, type AppNotification } from '../notifications';
import type { AppointmentDTO } from './types';

function withNotificationPrefs(raw: unknown, notifications: AppNotification[]) {
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { ...base, notifications };
}

async function appendNotification(
  prisma: PrismaClient,
  companyId: string,
  item: AppNotification,
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { notificationPreferences: true },
  });
  if (!company) return;
  const existing = parseNotifications(company.notificationPreferences);
  const next = [item, ...existing].slice(0, 120);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      notificationPreferences: withNotificationPrefs(company.notificationPreferences, next) as Prisma.InputJsonValue,
    },
  });
}

function buildSchedulingNotification(params: {
  title: string;
  message: string;
  severity?: AppNotification['severity'];
  recipientEmail?: string;
  sourceId?: string;
}): AppNotification {
  return {
    id: randomUUID(),
    title: params.title,
    message: params.message,
    severity: params.severity ?? 'medium',
    read: false,
    createdAt: new Date().toISOString(),
    sourceId: params.sourceId,
    category: 'scheduling',
    recipientEmail: params.recipientEmail,
  };
}

export async function notifySchedulingAssigned(
  prisma: PrismaClient,
  companyId: string,
  appointment: AppointmentDTO,
  technicianEmail: string,
): Promise<void> {
  await appendNotification(
    prisma,
    companyId,
    buildSchedulingNotification({
      title: 'Job assigned',
      message: `${appointment.clientName} at ${appointment.address} on ${new Date(appointment.scheduledStart).toLocaleString()}`,
      recipientEmail: technicianEmail.toLowerCase(),
      sourceId: appointment.id,
    }),
  );
}

export async function notifySchedulingMoved(
  prisma: PrismaClient,
  companyId: string,
  appointment: AppointmentDTO,
): Promise<void> {
  for (const tech of appointment.technicians) {
    await appendNotification(
      prisma,
      companyId,
      buildSchedulingNotification({
        title: 'Job moved',
        message: `${appointment.clientName} rescheduled to ${new Date(appointment.scheduledStart).toLocaleString()}`,
        recipientEmail: tech.email.toLowerCase(),
        sourceId: appointment.id,
      }),
    );
  }
}

export async function notifySchedulingCancelled(
  prisma: PrismaClient,
  companyId: string,
  appointment: AppointmentDTO,
): Promise<void> {
  for (const tech of appointment.technicians) {
    await appendNotification(
      prisma,
      companyId,
      buildSchedulingNotification({
        title: 'Job cancelled',
        message: `${appointment.clientName} on ${new Date(appointment.scheduledStart).toLocaleString()} was cancelled`,
        recipientEmail: tech.email.toLowerCase(),
        sourceId: appointment.id,
        severity: 'high',
      }),
    );
  }

  if (appointment.technicians.length === 0) {
    await appendNotification(
      prisma,
      companyId,
      buildSchedulingNotification({
        title: 'Job cancelled',
        message: `${appointment.clientName} was cancelled`,
        sourceId: appointment.id,
        severity: 'high',
      }),
    );
  }
}
