import type { AppNotification } from '../notifications';
import type { DashboardData } from '../api/mockDashboardData';

export const QUALIFICATION_ALERT_DAYS = [90, 60, 30, 7] as const;

export type QualificationCert = {
  id: string;
  technicianName: string;
  expiryDate: Date;
};

export function daysUntilExpiry(expiryDate: Date, now: Date = new Date()): number {
  const ms = expiryDate.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function getQualificationAlertThreshold(
  expiryDate: Date,
  now: Date = new Date(),
): (typeof QUALIFICATION_ALERT_DAYS)[number] | 'expired' | null {
  const days = daysUntilExpiry(expiryDate, now);
  if (days < 0) return 'expired';
  if (days === 90 || days === 60 || days === 30 || days === 7) {
    return days;
  }
  return null;
}

export function buildQualificationUrgentAlerts(
  certs: QualificationCert[],
  now: Date = new Date(),
): DashboardData['urgentAlerts'] {
  const alerts: DashboardData['urgentAlerts'] = [];

  for (const cert of certs) {
    const threshold = getQualificationAlertThreshold(cert.expiryDate, now);
    if (!threshold) continue;

    const isExpired = threshold === 'expired';
    alerts.push({
      id: `cert-${cert.id}-${isExpired ? 'expired' : threshold}`,
      title: isExpired
        ? `Qualification expired: ${cert.technicianName}`
        : `Qualification expiring in ${threshold} days: ${cert.technicianName}`,
      description: isExpired
        ? `Expired ${cert.expiryDate.toLocaleDateString()}. Renew before audits or site work.`
        : `Expires ${cert.expiryDate.toLocaleDateString()}. Plan renewal now.`,
      severity: isExpired || threshold <= 7 ? 'high' : threshold <= 30 ? 'medium' : 'low',
      action: { type: 'open_technicians' },
    });
  }

  return alerts;
}

export function qualificationAlertKey(certId: string, threshold: string): string {
  return `${certId}:${threshold}`;
}

export function parseQualificationAlertsSent(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const sent = (raw as Record<string, unknown>).qualificationAlertsSent;
  if (!Array.isArray(sent)) return [];
  return sent.filter((item): item is string => typeof item === 'string');
}

export function buildQualificationNotification(
  cert: QualificationCert,
  threshold: string,
): AppNotification {
  const isExpired = threshold === 'expired';
  return {
    id: `qual-${cert.id}-${threshold}`,
    title: isExpired
      ? `Qualification expired: ${cert.technicianName}`
      : `Qualification expiring in ${threshold} days`,
    message: isExpired
      ? `${cert.technicianName}'s certification expired on ${cert.expiryDate.toLocaleDateString()}.`
      : `${cert.technicianName}'s certification expires on ${cert.expiryDate.toLocaleDateString()}.`,
    severity: isExpired || threshold === '7' ? 'high' : threshold === '30' ? 'medium' : 'low',
    read: false,
    createdAt: new Date().toISOString(),
    sourceId: qualificationAlertKey(cert.id, threshold),
  };
}
