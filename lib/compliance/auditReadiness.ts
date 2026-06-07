import { computeComplianceHealthScore, type ComplianceHealthResult } from './healthScore';

export type AuditReadinessSummary = {
  reportCount: number;
  missingSignatures: number;
  expiringQualifications: number;
  openComplianceIssues: number;
  complianceHealth: ComplianceHealthResult;
};

type Policy = {
  requireSignature: boolean;
  requirePhotos: boolean;
};

type Entry = {
  status: string | null;
  signature: string | null;
  photoUrl: string | null;
  photos: { url: string }[];
  followUpDate: Date | null;
  date: Date;
};

type Cert = {
  expiryDate: Date | null;
};

function getStatus(entry: { status: string | null }): string {
  return entry.status?.trim().toLowerCase() || 'open';
}

export function buildAuditReadinessSummary(
  entries: Entry[],
  certs: Cert[],
  policy: Policy,
  now: Date = new Date(),
): AuditReadinessSummary {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 90);

  const recentEntries = entries.filter((e) => e.date >= windowStart && e.date <= now);
  const reportCount = recentEntries.filter((e) => getStatus(e) === 'completed').length;

  const missingSignatures = policy.requireSignature
    ? recentEntries.filter((e) => getStatus(e) !== 'open' && !e.signature?.trim()).length
    : 0;

  const expiringQualifications = certs.filter((c) => {
    if (!c.expiryDate) return false;
    const days = Math.ceil((c.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 90;
  }).length;

  const complianceHealth = computeComplianceHealthScore(recentEntries, certs, policy, now);
  const openComplianceIssues =
    complianceHealth.warnings.reduce((sum, warning) => sum + warning.count, 0);

  return {
    reportCount,
    missingSignatures,
    expiringQualifications,
    openComplianceIssues,
    complianceHealth,
  };
}
