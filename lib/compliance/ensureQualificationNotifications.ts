import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { parseNotifications } from '../notifications';
import {
  buildQualificationNotification,
  getQualificationAlertThreshold,
  parseQualificationAlertsSent,
  qualificationAlertKey,
  type QualificationCert,
} from './qualificationAlerts';

function certificationExpiryEnabled(notificationPreferences: unknown): boolean {
  if (!notificationPreferences || typeof notificationPreferences !== 'object' || Array.isArray(notificationPreferences)) {
    return true;
  }
  const prefs = notificationPreferences as Record<string, unknown>;
  if (typeof prefs.certificationExpiry === 'boolean') return prefs.certificationExpiry;
  return true;
}

function withQualificationAlertsSent(raw: unknown, sent: string[], notifications: ReturnType<typeof parseNotifications>) {
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    ...base,
    qualificationAlertsSent: sent.slice(-400),
    notifications,
  };
}

export async function ensureQualificationNotifications(
  prisma: PrismaClient,
  companyId: string,
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { notificationPreferences: true },
  });
  if (!company || !certificationExpiryEnabled(company.notificationPreferences)) return;

  const technicians = await prisma.technician.findMany({
    where: { companyId },
    include: {
      certifications: {
        where: { expiryDate: { not: null } },
        select: { id: true, expiryDate: true },
      },
    },
  });

  const certs: QualificationCert[] = technicians.flatMap((tech) =>
    tech.certifications
      .filter((c): c is { id: string; expiryDate: Date } => c.expiryDate !== null)
      .map((c) => ({
        id: c.id,
        technicianName: tech.name,
        expiryDate: c.expiryDate,
      })),
  );

  const sent = parseQualificationAlertsSent(company.notificationPreferences);
  const sentSet = new Set(sent);
  const notifications = parseNotifications(company.notificationPreferences);
  const existingSourceIds = new Set(notifications.map((n) => n.sourceId).filter(Boolean));
  const now = new Date();
  const newItems: typeof notifications = [];
  const newSentKeys: string[] = [];

  for (const cert of certs) {
    const threshold = getQualificationAlertThreshold(cert.expiryDate, now);
    if (!threshold) continue;
    const key = qualificationAlertKey(cert.id, String(threshold));
    if (sentSet.has(key) || existingSourceIds.has(key)) continue;

    newItems.push(buildQualificationNotification(cert, String(threshold)));
    newSentKeys.push(key);
  }

  if (newItems.length === 0) return;

  const nextNotifications = [...newItems, ...notifications].slice(0, 120);
  const nextSent = [...sent, ...newSentKeys];

  await prisma.company.update({
    where: { id: companyId },
    data: {
      notificationPreferences: withQualificationAlertsSent(
        company.notificationPreferences,
        nextSent,
        nextNotifications,
      ) as Prisma.InputJsonValue,
    },
  });
}
