import type { PrismaClient } from '@prisma/client';
import type {
  DashboardData,
  DashboardDateRangeOption,
} from './api/mockDashboardData';
import { normalizeUkPostcode } from './ukPostcode';
import { buildAuditReadinessSummary } from './compliance/auditReadiness';
import { computeComplianceHealthScore } from './compliance/healthScore';
import { buildQualificationUrgentAlerts } from './compliance/qualificationAlerts';

const ESTIMATED_GBP_PER_VISIT = 135;

type CompanyPolicy = {
  requirePhotos: boolean;
  requireSignature: boolean;
  plan?: 'free' | 'pro' | 'business' | 'enterprise';
  /** Plan tier used only for feature limits (e.g. chemical log rows). Defaults to `plan`. */
  featureTier?: 'free' | 'pro' | 'business' | 'enterprise';
};

type DashboardEnterpriseOptions = {
  npsResponses?: Array<{
    score: number;
    submittedAt: string;
    comment?: string;
  }>;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangeToDays(range: DashboardDateRangeOption): number {
  if (range === '7') return 7;
  if (range === '30') return 30;
  return 90;
}

function normalizeClientKey(entry: { clientName: string; postcode?: string | null; address: string }): string {
  const name = entry.clientName.trim().toLowerCase();
  if (!name) return '';
  const rawPc = entry.postcode?.trim();
  if (rawPc) return `${name}|${normalizeUkPostcode(rawPc)}`;
  return `${name}|${entry.address.trim().toLowerCase()}`;
}

function hashStringToPercent(s: string, axis: 0 | 1): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const base = axis === 0 ? h % 85 : (h >> 8) % 75;
  return 10 + base;
}

function entryHasPhoto(entry: { photoUrl: string | null; photos: { url: string }[] }): boolean {
  return Boolean(entry.photoUrl) || entry.photos.length > 0;
}

function entryHasSignature(entry: { signature: string | null }): boolean {
  return Boolean(entry.signature && entry.signature.trim().length > 0);
}

function isEntryCompliant(entry: { status: string | null; photoUrl: string | null; photos: { url: string }[]; signature: string | null }, policy: CompanyPolicy): boolean {
  const status = entry.status?.trim().toLowerCase() || 'open';
  const completed = status !== 'open';
  const photoOk = !policy.requirePhotos || entryHasPhoto(entry);
  const sigOk = !policy.requireSignature || entryHasSignature(entry);
  return completed && photoOk && sigOk;
}

function parseVolumeMl(productAmount: string | null): number {
  if (!productAmount) return 0;
  const m = productAmount.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  return Math.round(Number(m[1]));
}

function parsePoisonLabel(poisonUsed: string | null, treatment: string): string {
  const p = poisonUsed?.trim();
  if (p && p.toLowerCase() !== 'no' && p.length > 0) return p;
  return treatment.trim() || 'Treatment logged';
}

export async function buildDashboardInsights(
  prisma: PrismaClient,
  companyId: string,
  policy: CompanyPolicy,
  range: DashboardDateRangeOption,
  enterpriseOptions?: DashboardEnterpriseOptions,
): Promise<DashboardData> {
  const days = rangeToDays(range);
  const now = new Date();
  const rangeEnd = endOfLocalDay(now);
  const rangeStart = new Date(rangeEnd);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));
  rangeStart.setHours(0, 0, 0, 0);

  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  const auditWindowStart = new Date(rangeEnd);
  auditWindowStart.setDate(auditWindowStart.getDate() - 89);
  auditWindowStart.setHours(0, 0, 0, 0);

  const [entriesInRange, entriesToday, entriesAuditWindow, technicians] = await Promise.all([
    prisma.logbookEntry.findMany({
      where: { companyId, date: { gte: rangeStart, lte: rangeEnd } },
      include: {
        photos: { select: { url: true } },
        logbookEntryTechnicians: { include: { technician: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.logbookEntry.findMany({
      where: { companyId, date: { gte: todayStart, lte: todayEnd } },
      include: {
        photos: { select: { url: true } },
        logbookEntryTechnicians: { include: { technician: { select: { name: true } } } },
      },
      orderBy: [{ startTime: 'asc' }, { date: 'asc' }],
    }),
    prisma.logbookEntry.findMany({
      where: { companyId, date: { gte: auditWindowStart, lte: rangeEnd } },
      include: { photos: { select: { url: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.technician.findMany({
      where: { companyId },
      include: {
        certifications: { select: { id: true, expiryDate: true } },
      },
    }),
  ]);

  const certs = technicians.flatMap((t) =>
    t.certifications.map((c) => ({
      id: c.id,
      expiryDate: c.expiryDate,
      technicianName: t.name,
    })),
  );

  // Helper to safely get status (never null)
function getStatus(entry: { status: string | null }): string {
  return entry.status?.trim()?.toLowerCase() || 'open';
}

const appointments = entriesToday.map((e) => {
  const techNames = e.logbookEntryTechnicians.map((x) => x.technician.name).join(', ') || 'Unassigned';
  const t = e.startTime ?? e.date;
  const time = t ? t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const statusLower = getStatus(e);
  const completed = statusLower !== 'open';
  const lat = 51.45 + (hashStringToPercent(e.address, 0) / 5000);
  const lng = -2.58 - (hashStringToPercent(e.address, 1) / 5000);
  return {
    id: e.id,
    clientName: e.clientName,
    address: e.address,
    time,
    status: completed ? ('completed' as const) : ('pending' as const),
    technician: techNames,
    locationLabel: e.address.slice(0, 32) + (e.address.length > 32 ? '…' : ''),
    lat,
    lng,
  };
});

const completedToday = appointments.filter((a) => a.status === 'completed').length;
const scheduledToday = appointments.length;
const percentComplete = scheduledToday === 0 ? 0 : Math.round((completedToday / scheduledToday) * 100);

const locations = entriesToday.slice(0, 8).map((e, index) => {
  const statusLower = getStatus(e);
  const completed = statusLower !== 'open';
  const key = `${e.address}-${index}`;
  return {
    label: e.clientName,
    status: completed ? ('completed' as const) : ('pending' as const),
    xPercent: hashStringToPercent(key, 0),
    yPercent: hashStringToPercent(key, 1),
  };
});

const bucketCount = Math.min(12, Math.max(4, Math.ceil(days / 7)));
const bucketMs = (rangeEnd.getTime() - rangeStart.getTime() + 1) / bucketCount;
const series: { date: string; rate: number }[] = [];
for (let b = 0; b < bucketCount; b += 1) {
  const from = new Date(rangeStart.getTime() + b * bucketMs);
  const to = new Date(rangeStart.getTime() + (b + 1) * bucketMs - 1);
  const slice = entriesInRange.filter((e) => e.date >= from && e.date <= to);
  const rate =
    slice.length === 0
      ? 0
      : Math.round(
          (slice.filter((e) => isEntryCompliant(e, policy)).length / slice.length) * 100,
        );
  series.push({
    date: `${from.getDate()}/${from.getMonth() + 1}`,
    rate,
  });
}

const currentRate =
  entriesInRange.length === 0
    ? 0
    : Math.round(
        (entriesInRange.filter((e) => isEntryCompliant(e, policy)).length / entriesInRange.length) *
          100,
      );

const openActions = entriesInRange
  .filter((e) => !isEntryCompliant(e, policy))
  .slice(0, 5)
  .map((e) => {
    const statusLower = getStatus(e);
    return {
      id: e.id,
      title: statusLower === 'open' ? 'Job still open' : 'Compliance gap on closed job',
      area: e.clientName,
      dueDate: e.followUpDate ? e.followUpDate.toLocaleDateString() : 'Review',
    };
  });

const chemicalMap = new Map<string, { volume: number; compliant: number; total: number }>();
for (const e of entriesInRange) {
  const label = parsePoisonLabel(e.poisonUsed, e.treatment);
  const vol = parseVolumeMl(e.productAmount) || 120;
  const row = chemicalMap.get(label) ?? { volume: 0, compliant: 0, total: 0 };
  row.volume += vol;
  row.total += 1;
  const statusLower = getStatus(e);
  if (statusLower !== 'open') row.compliant += 1;
  chemicalMap.set(label, row);
}

const chemicalLog = [...chemicalMap.entries()]
  .sort((a, b) => b[1].volume - a[1].volume)
  // Higher plans see more chemical history
  .slice(0, (() => {
    const tier = policy.featureTier ?? policy.plan;
    return tier === 'enterprise' ? 20 : tier === 'business' ? 12 : 6;
  })())
  .map(([chemical, agg], i) => ({
    id: `chem-${i}-${chemical}`,
    chemical,
    volumeMl: agg.volume,
    status: (agg.compliant / agg.total >= 0.85 ? 'compliant' : 'non-compliant') as 'compliant' | 'non-compliant',
    stockRemaining: Math.max(8, Math.min(92, 100 - (agg.volume % 60))),
  }));

const urgentAlerts: DashboardData['urgentAlerts'] = [];
const qualificationCerts = certs
  .filter((c): c is typeof c & { expiryDate: Date } => c.expiryDate !== null)
  .map((c) => ({
    id: c.id,
    technicianName: c.technicianName,
    expiryDate: c.expiryDate,
  }));
urgentAlerts.push(...buildQualificationUrgentAlerts(qualificationCerts, now));

for (const e of entriesInRange) {
  if (e.followUpDate && e.followUpDate < now && getStatus(e) === 'open') {
    urgentAlerts.push({
      id: `fu-${e.id}`,
      title: `Follow-up overdue: ${e.clientName}`,
      description: `Follow-up was due ${e.followUpDate.toLocaleDateString()}. Job is still open.`,
      severity: 'high',
      action: {
        type: 'open_reports',
        search: e.clientName,
        followUpOnly: true,
      },
    });
  }
}

if (policy.requirePhotos) {
  const recent = entriesInRange.filter((e) => (now.getTime() - e.date.getTime()) / 86400000 <= 14);
  for (const e of recent) {
    if (!entryHasPhoto(e)) {
      urgentAlerts.push({
        id: `photo-${e.id}`,
        title: 'Job missing photos',
        description: `${e.clientName} has no photos attached. This is required by your current ${policy.plan || 'pro'} plan policy.`,
        severity: 'medium',
        action: {
          type: 'open_reports',
          search: e.clientName,
        },
      });
    }
  }
}

const nextBestActions: DashboardData['nextBestActions'] = [];
if (urgentAlerts.length > 0) {
  const highAlert = urgentAlerts.find((alert) => alert.severity === 'high' && alert.action);
  if (highAlert?.action) {
    nextBestActions.push({
      id: `nba-alert-${highAlert.id}`,
      title: 'Address highest priority alert',
      description: highAlert.title,
      action: highAlert.action,
    });
  }
}
if (openActions.length > 0) {
  nextBestActions.push({
    id: 'nba-open-actions',
    title: 'Close compliance gaps',
    description: `${openActions.length} jobs need attention in the current range.`,
    action: { type: 'open_reports', followUpOnly: true },
  });
}
if (currentRate < 85) {
  nextBestActions.push({
    id: 'nba-compliance-rate',
    title: 'Improve compliance completion rate',
    description: `Current compliance is ${currentRate}%. Review jobs missing signatures/photos.`,
    action: { type: 'open_reports' },
  });
}
if (nextBestActions.length === 0) {
  nextBestActions.push({
    id: 'nba-maintain',
    title: 'Maintain today`s momentum',
    description: 'Review reports for scheduling and keep follow-ups moving.',
    action: { type: 'open_reports' },
  });
}

const clientCounts = new Map<string, number>();
for (const e of entriesInRange) {
  const k = normalizeClientKey(e);
  if (!k) continue;
  clientCounts.set(k, (clientCounts.get(k) ?? 0) + 1);
}
const uniqueClients = clientCounts.size;
const totalJobs = entriesInRange.length;
const repeatClients = [...clientCounts.values()].filter((n) => n >= 2).length;
const retentionRate =
  uniqueClients === 0 ? 0 : Math.round((repeatClients / uniqueClients) * 100);

const churnByReason = new Map<string, number>();
for (const e of entriesInRange) {
  const status = getStatus(e);
  if (status === 'cancelled' || status === 'canceled') {
    const reason = (e.recommendation || '').trim() || 'No reason logged';
    churnByReason.set(reason, (churnByReason.get(reason) ?? 0) + 1);
  }
}
  const reasons = [...churnByReason.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  const totalRevenue = entriesInRange.reduce(
    (sum, entry) => sum + (entry.price != null && Number(entry.price) > 0 ? Number(entry.price) : ESTIMATED_GBP_PER_VISIT),
    0,
  );
  /** Average revenue per distinct client in range (uses job `price` / invoice value when set, else visit estimate). */
  const clvPerClient = uniqueClients === 0 ? 0 : Math.round(totalRevenue / uniqueClients);
  const cac = Math.max(420, Math.min(1400, Math.round(5400 / Math.max(1, Math.ceil(uniqueClients / 2) || 1))));

  const weekBuckets = Math.min(8, Math.max(3, Math.ceil(days / 14)));
  const trend: number[] = [];
  for (let w = 0; w < weekBuckets; w += 1) {
    const from = new Date(rangeStart.getTime() + (w * (rangeEnd.getTime() - rangeStart.getTime())) / weekBuckets);
    const to = new Date(
      rangeStart.getTime() + ((w + 1) * (rangeEnd.getTime() - rangeStart.getTime())) / weekBuckets,
    );
    const slice = entriesInRange.filter((e) => e.date >= from && e.date < to);
    const sliceRevenue = slice.reduce(
      (sum, entry) =>
        sum + (entry.price != null && Number(entry.price) > 0 ? Number(entry.price) : ESTIMATED_GBP_PER_VISIT),
      0,
    );
    trend.push(Math.round(sliceRevenue));
  }
  if (trend.length === 0) trend.push(0);

  const csatTrend: number[] = [];
  for (let w = 0; w < weekBuckets; w += 1) {
    const from = new Date(rangeStart.getTime() + (w * (rangeEnd.getTime() - rangeStart.getTime())) / weekBuckets);
    const to = new Date(
      rangeStart.getTime() + ((w + 1) * (rangeEnd.getTime() - rangeStart.getTime())) / weekBuckets,
    );
    const slice = entriesInRange.filter((e) => e.date >= from && e.date < to);
    if (slice.length === 0) {
      csatTrend.push(0);
      continue;
    }
    let acc = 0;
    for (const e of slice) {
      let pts = 0;
      if (!policy.requirePhotos || entryHasPhoto(e)) pts += 1;
      if (!policy.requireSignature || entryHasSignature(e)) pts += 1;
      if (e.notes && e.notes.trim().length > 10) pts += 0.5;
      acc += (pts / 2.5) * 5;
    }
    csatTrend.push(Math.round((acc / slice.length) * 10) / 10);
  }
  const averageCsat =
    csatTrend.length === 0 ? 0 : Math.round((csatTrend.reduce((a, b) => a + b, 0) / csatTrend.length) * 10) / 10;

  const rawNpsResponses =
    enterpriseOptions?.npsResponses?.filter((item) => {
      if (!Number.isFinite(item.score) || item.score < 0 || item.score > 10) return false;
      const at = new Date(item.submittedAt);
      return !Number.isNaN(at.getTime()) && at >= rangeStart && at <= rangeEnd;
    }) ?? [];
  const weekBucketsForNps = Math.min(8, Math.max(3, Math.ceil(days / 14)));
  const npsTrend: number[] = [];
  for (let w = 0; w < weekBucketsForNps; w += 1) {
    const from = new Date(rangeStart.getTime() + (w * (rangeEnd.getTime() - rangeStart.getTime())) / weekBucketsForNps);
    const to = new Date(
      rangeStart.getTime() + ((w + 1) * (rangeEnd.getTime() - rangeStart.getTime())) / weekBucketsForNps,
    );
    const slice = rawNpsResponses.filter((response) => {
      const at = new Date(response.submittedAt);
      return at >= from && at < to;
    });
    if (slice.length === 0) {
      npsTrend.push(0);
      continue;
    }
    const promoters = slice.filter((response) => response.score >= 9).length;
    const detractors = slice.filter((response) => response.score <= 6).length;
    const npsValue = Math.round(((promoters - detractors) / slice.length) * 100);
    npsTrend.push(npsValue);
  }
  const nps =
    rawNpsResponses.length === 0
      ? Math.max(-100, Math.min(100, Math.round((retentionRate - 55) * 1.8)))
      : Math.round(npsTrend.reduce((sum, value) => sum + value, 0) / Math.max(1, npsTrend.length));

  const complianceHealth = computeComplianceHealthScore(entriesInRange, certs, policy, now);
  const auditSummary = buildAuditReadinessSummary(
    entriesAuditWindow,
    certs,
    { requirePhotos: policy.requirePhotos, requireSignature: policy.requireSignature },
    now,
  );

  return {
    todaySchedule: {
      appointments,
      completed: completedToday,
      scheduled: scheduledToday,
      percentComplete,
      locations,
    },
    compliance: {
      series,
      openActions,
      currentRate,
      healthScore: complianceHealth.score,
      warnings: complianceHealth.warnings,
    },
    auditReadiness: {
      reportCount: auditSummary.reportCount,
      missingSignatures: auditSummary.missingSignatures,
      expiringQualifications: auditSummary.expiringQualifications,
      openComplianceIssues: auditSummary.openComplianceIssues,
    },
    chemicalLog,
    urgentAlerts: urgentAlerts.slice(0, 8),
    nextBestActions: nextBestActions.slice(0, 4),
    customerValue: {
      clv: clvPerClient,
      cac,
      trend,
    },
    retention: {
      retentionRate,
      reasons,
    },
    csat: {
      average: averageCsat,
      nps,
      trend: rawNpsResponses.length > 0 ? npsTrend : csatTrend,
    },
  };
}
