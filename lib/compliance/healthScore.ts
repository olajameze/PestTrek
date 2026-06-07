export type ComplianceHealthWarning = {
  code: 'missing_signatures' | 'expired_qualifications' | 'missing_reports' | 'overdue_followups';
  title: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
};

export type ComplianceHealthResult = {
  score: number;
  warnings: ComplianceHealthWarning[];
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
};

type Cert = {
  expiryDate: Date | null;
};

function getStatus(entry: { status: string | null }): string {
  return entry.status?.trim().toLowerCase() || 'open';
}

function entryHasPhoto(entry: Entry): boolean {
  return Boolean(entry.photoUrl?.trim()) || entry.photos.length > 0;
}

function entryHasSignature(entry: Entry): boolean {
  return Boolean(entry.signature?.trim());
}

function isEntryCompliant(entry: Entry, policy: Policy): boolean {
  const completed = getStatus(entry) !== 'open';
  const photoOk = !policy.requirePhotos || entryHasPhoto(entry);
  const sigOk = !policy.requireSignature || entryHasSignature(entry);
  return completed && photoOk && sigOk;
}

export function computeComplianceHealthScore(
  entries: Entry[],
  certs: Cert[],
  policy: Policy,
  now: Date = new Date(),
): ComplianceHealthResult {
  let score = 100;
  const warnings: ComplianceHealthWarning[] = [];

  const closedEntries = entries.filter((e) => getStatus(e) !== 'open');

  if (policy.requireSignature) {
    const missingSignatures = closedEntries.filter((e) => !entryHasSignature(e)).length;
    if (missingSignatures > 0) {
      const penalty = Math.min(25, missingSignatures * 5);
      score -= penalty;
      warnings.push({
        code: 'missing_signatures',
        title: 'Jobs missing required signatures',
        count: missingSignatures,
        severity: missingSignatures >= 3 ? 'high' : 'medium',
      });
    }
  }

  const expiredQualifications = certs.filter((c) => c.expiryDate && c.expiryDate < now).length;
  if (expiredQualifications > 0) {
    const penalty = Math.min(30, expiredQualifications * 20);
    score -= penalty;
    warnings.push({
      code: 'expired_qualifications',
      title: 'Expired technician qualifications',
      count: expiredQualifications,
      severity: 'high',
    });
  }

  const nonCompliantClosed = closedEntries.filter((e) => !isEntryCompliant(e, policy)).length;
  if (nonCompliantClosed > 0) {
    const penalty = Math.min(25, nonCompliantClosed * 5);
    score -= penalty;
    warnings.push({
      code: 'missing_reports',
      title: 'Closed jobs with compliance gaps',
      count: nonCompliantClosed,
      severity: nonCompliantClosed >= 3 ? 'high' : 'medium',
    });
  }

  const overdueFollowups = entries.filter(
    (e) => e.followUpDate && e.followUpDate < now && getStatus(e) === 'open',
  ).length;
  if (overdueFollowups > 0) {
    const penalty = Math.min(20, overdueFollowups * 10);
    score -= penalty;
    warnings.push({
      code: 'overdue_followups',
      title: 'Overdue follow-up visits',
      count: overdueFollowups,
      severity: overdueFollowups >= 2 ? 'high' : 'medium',
    });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    warnings: warnings.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.severity] - rank[b.severity];
    }),
  };
}
