import type { PrismaClient } from '@prisma/client';
import { normalizeUkPostcode } from '../ukPostcode';

export type ActivationMilestone =
  | 'first_customer_created'
  | 'first_site_created'
  | 'first_job_completed'
  | 'first_photo_uploaded'
  | 'first_report_generated';

export const ACTIVATION_MILESTONES: ActivationMilestone[] = [
  'first_customer_created',
  'first_site_created',
  'first_job_completed',
  'first_photo_uploaded',
  'first_report_generated',
];

const MILESTONE_COLUMN: Record<
  ActivationMilestone,
  | 'firstCustomerCreatedAt'
  | 'firstSiteCreatedAt'
  | 'firstJobCompletedAt'
  | 'firstPhotoUploadedAt'
  | 'firstReportGeneratedAt'
> = {
  first_customer_created: 'firstCustomerCreatedAt',
  first_site_created: 'firstSiteCreatedAt',
  first_job_completed: 'firstJobCompletedAt',
  first_photo_uploaded: 'firstPhotoUploadedAt',
  first_report_generated: 'firstReportGeneratedAt',
};

export type CompanyActivationRow = {
  firstCustomerCreatedAt: Date | null;
  firstSiteCreatedAt: Date | null;
  firstJobCompletedAt: Date | null;
  firstPhotoUploadedAt: Date | null;
  firstReportGeneratedAt: Date | null;
  checklistDismissedAt?: Date | null;
};

export type ActivationNextAction = {
  label: string;
  href: string;
  milestone: ActivationMilestone;
};

const MILESTONE_META: Record<
  ActivationMilestone,
  { label: string; completedLabel: string; href: string }
> = {
  first_customer_created: {
    label: 'Create your first customer',
    completedLabel: 'First customer created',
    href: '/dashboard?tab=logbook',
  },
  first_site_created: {
    label: 'Add your first site',
    completedLabel: 'First site added',
    href: '/dashboard?tab=logbook',
  },
  first_job_completed: {
    label: 'Complete your first job',
    completedLabel: 'First job completed',
    href: '/reports',
  },
  first_photo_uploaded: {
    label: 'Upload your first photo',
    completedLabel: 'First photo uploaded',
    href: '/dashboard?tab=logbook',
  },
  first_report_generated: {
    label: 'Generate your first report',
    completedLabel: 'First report generated',
    href: '/reports',
  },
};

export function normalizeSiteKey(address: string, postcode?: string | null): string {
  const addr = address.trim().toLowerCase();
  const rawPc = postcode?.trim();
  if (rawPc) return `${addr}|${normalizeUkPostcode(rawPc)}`;
  return addr;
}

export function normalizeCustomerKey(clientName: string): string {
  return clientName.trim().toLowerCase();
}

export function isMilestoneComplete(
  row: CompanyActivationRow,
  milestone: ActivationMilestone,
): boolean {
  const col = MILESTONE_COLUMN[milestone];
  return row[col] !== null && row[col] !== undefined;
}

export function computeActivationScore(row: CompanyActivationRow): number {
  const completed = ACTIVATION_MILESTONES.filter((m) => isMilestoneComplete(row, m)).length;
  return Math.round((completed / ACTIVATION_MILESTONES.length) * 100);
}

export function getNextRecommendedAction(row: CompanyActivationRow): ActivationNextAction | null {
  for (const milestone of ACTIVATION_MILESTONES) {
    if (!isMilestoneComplete(row, milestone)) {
      const meta = MILESTONE_META[milestone];
      return { label: meta.label, href: meta.href, milestone };
    }
  }
  return null;
}

export function buildMilestoneFlags(row: CompanyActivationRow): Record<ActivationMilestone, boolean> {
  return {
    first_customer_created: isMilestoneComplete(row, 'first_customer_created'),
    first_site_created: isMilestoneComplete(row, 'first_site_created'),
    first_job_completed: isMilestoneComplete(row, 'first_job_completed'),
    first_photo_uploaded: isMilestoneComplete(row, 'first_photo_uploaded'),
    first_report_generated: isMilestoneComplete(row, 'first_report_generated'),
  };
}

export function buildActivationEvents(row: CompanyActivationRow): Record<ActivationMilestone, string | null> {
  return {
    first_customer_created: row.firstCustomerCreatedAt?.toISOString() ?? null,
    first_site_created: row.firstSiteCreatedAt?.toISOString() ?? null,
    first_job_completed: row.firstJobCompletedAt?.toISOString() ?? null,
    first_photo_uploaded: row.firstPhotoUploadedAt?.toISOString() ?? null,
    first_report_generated: row.firstReportGeneratedAt?.toISOString() ?? null,
  };
}

export async function ensureCompanyActivation(
  prisma: PrismaClient,
  companyId: string,
): Promise<CompanyActivationRow & { companyId: string; checklistDismissedAt: Date | null }> {
  const row = await prisma.companyActivation.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
  return row;
}

export async function recordActivationMilestone(
  prisma: PrismaClient,
  companyId: string,
  milestone: ActivationMilestone,
  at: Date = new Date(),
): Promise<void> {
  await ensureCompanyActivation(prisma, companyId);
  const row = await prisma.companyActivation.findUnique({ where: { companyId } });
  if (!row) return;

  const data: Partial<CompanyActivationRow> = {};
  const column = MILESTONE_COLUMN[milestone];
  if (row[column]) return;

  data[column] = at;
  await prisma.companyActivation.update({
    where: { companyId },
    data,
  });
}

function entryHasPhoto(entry: { photoUrl: string | null; photos?: { url: string }[] }): boolean {
  if (entry.photoUrl && entry.photoUrl.trim().length > 0) return true;
  return Boolean(entry.photos && entry.photos.length > 0);
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const s = status?.trim().toLowerCase() || 'open';
  return s === 'completed';
}

export async function backfillActivationFromCompanyData(
  prisma: PrismaClient,
  companyId: string,
): Promise<CompanyActivationRow> {
  const existing = await ensureCompanyActivation(prisma, companyId);
  const allComplete = ACTIVATION_MILESTONES.every((m) => isMilestoneComplete(existing, m));
  if (allComplete) return existing;

  const entries = await prisma.logbookEntry.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    select: {
      clientName: true,
      address: true,
      postcode: true,
      status: true,
      photoUrl: true,
      createdAt: true,
      photos: { select: { url: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  const customers = new Set<string>();
  const sites = new Set<string>();
  let firstCustomerAt: Date | null = existing.firstCustomerCreatedAt;
  let firstSiteAt: Date | null = existing.firstSiteCreatedAt;
  let firstJobAt: Date | null = existing.firstJobCompletedAt;
  let firstPhotoAt: Date | null = existing.firstPhotoUploadedAt;

  for (const entry of entries) {
    const at = entry.createdAt ?? new Date();
    const customerKey = normalizeCustomerKey(entry.clientName);
    if (customerKey && !customers.has(customerKey)) {
      customers.add(customerKey);
      if (!firstCustomerAt) firstCustomerAt = at;
    }

    const siteKey = normalizeSiteKey(entry.address, entry.postcode);
    if (siteKey && !sites.has(siteKey)) {
      sites.add(siteKey);
      if (!firstSiteAt) firstSiteAt = at;
    }

    if (!firstJobAt && isCompletedStatus(entry.status)) {
      firstJobAt = at;
    }

    if (!firstPhotoAt && entryHasPhoto(entry)) {
      const photoCreated = entry.photos[0]?.createdAt ?? at;
      firstPhotoAt = photoCreated;
    }
  }

  const data: Partial<Record<keyof CompanyActivationRow, Date | null>> = {};
  if (!existing.firstCustomerCreatedAt && firstCustomerAt) data.firstCustomerCreatedAt = firstCustomerAt;
  if (!existing.firstSiteCreatedAt && firstSiteAt) data.firstSiteCreatedAt = firstSiteAt;
  if (!existing.firstJobCompletedAt && firstJobAt) data.firstJobCompletedAt = firstJobAt;
  if (!existing.firstPhotoUploadedAt && firstPhotoAt) data.firstPhotoUploadedAt = firstPhotoAt;

  if (Object.keys(data).length > 0) {
    await prisma.companyActivation.update({
      where: { companyId },
      data,
    });
  }

  return prisma.companyActivation.findUniqueOrThrow({ where: { companyId } });
}

export async function recordLogbookActivationMilestones(
  prisma: PrismaClient,
  companyId: string,
  entry: {
    clientName: string;
    address: string;
    postcode?: string | null;
    status?: string | null;
    photoUrl?: string | null;
    photosCount?: number;
  },
  at: Date = new Date(),
): Promise<void> {
  await ensureCompanyActivation(prisma, companyId);

  const customerKey = normalizeCustomerKey(entry.clientName);
  if (customerKey) {
    const customerCount = await prisma.logbookEntry.count({
      where: { companyId, clientName: { equals: entry.clientName, mode: 'insensitive' } },
    });
    if (customerCount === 1) {
      await recordActivationMilestone(prisma, companyId, 'first_customer_created', at);
    }
  }

  const siteKey = normalizeSiteKey(entry.address, entry.postcode);
  if (siteKey) {
    const siteEntries = await prisma.logbookEntry.findMany({
      where: { companyId },
      select: { address: true, postcode: true },
    });
    const matchingSites = siteEntries.filter(
      (e) => normalizeSiteKey(e.address, e.postcode) === siteKey,
    );
    if (matchingSites.length === 1) {
      await recordActivationMilestone(prisma, companyId, 'first_site_created', at);
    }
  }

  const hasPhoto =
    Boolean(entry.photoUrl && entry.photoUrl.trim().length > 0) ||
    Boolean(entry.photosCount && entry.photosCount > 0);
  if (hasPhoto) {
    const photoEntryCount = await prisma.logbookEntry.count({
      where: {
        companyId,
        OR: [
          { photoUrl: { not: null } },
          { photos: { some: {} } },
        ],
      },
    });
    if (photoEntryCount === 1) {
      await recordActivationMilestone(prisma, companyId, 'first_photo_uploaded', at);
    } else {
      const priorPhoto = await prisma.companyActivation.findUnique({
        where: { companyId },
        select: { firstPhotoUploadedAt: true },
      });
      if (!priorPhoto?.firstPhotoUploadedAt) {
        const anyPhoto = await prisma.logbookPhoto.findFirst({
          where: { logbookEntry: { companyId } },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });
        if (anyPhoto?.createdAt) {
          await recordActivationMilestone(prisma, companyId, 'first_photo_uploaded', anyPhoto.createdAt);
        } else {
          await recordActivationMilestone(prisma, companyId, 'first_photo_uploaded', at);
        }
      }
    }
  }

  if (isCompletedStatus(entry.status)) {
    const completedCount = await prisma.logbookEntry.count({
      where: {
        companyId,
        status: { equals: 'completed', mode: 'insensitive' },
      },
    });
    if (completedCount === 1) {
      await recordActivationMilestone(prisma, companyId, 'first_job_completed', at);
    }
  }
}

export async function recordJobCompletedActivation(
  prisma: PrismaClient,
  companyId: string,
  at: Date = new Date(),
): Promise<void> {
  await ensureCompanyActivation(prisma, companyId);
  const row = await prisma.companyActivation.findUnique({
    where: { companyId },
    select: { firstJobCompletedAt: true },
  });
  if (row?.firstJobCompletedAt) return;

  const completedCount = await prisma.logbookEntry.count({
    where: {
      companyId,
      status: { equals: 'completed', mode: 'insensitive' },
    },
  });
  if (completedCount >= 1) {
    const firstCompleted = await prisma.logbookEntry.findFirst({
      where: {
        companyId,
        status: { equals: 'completed', mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    await recordActivationMilestone(
      prisma,
      companyId,
      'first_job_completed',
      firstCompleted?.createdAt ?? at,
    );
  }
}
