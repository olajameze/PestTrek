import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { sendTrialEndedUpgradeEmail } from '../email';
import { listExpiredTrialRecipients, type ExpiredTrialRecipient } from './expiredTrialRecipients';

export type TrialUpgradeCampaignResult = {
  dryRun: boolean;
  eligible: number;
  sent: number;
  skipped: number;
  failed: Array<{ email: string; error: string }>;
  recipients: Array<{ email: string; companyName: string | null }>;
};

function mergePrefs(
  raw: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

async function markSent(companyId: string, existingPrefs: unknown): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      notificationPreferences: mergePrefs(existingPrefs, {
        trialEndedUpgradeEmailSentAt: new Date().toISOString(),
      }),
    },
  });
}

export async function runExpiredTrialUpgradeCampaign(options?: {
  dryRun?: boolean;
  /** Resend even if trialEndedUpgradeEmailSentAt is already set (super-admin only). */
  force?: boolean;
}): Promise<TrialUpgradeCampaignResult> {
  const dryRun = options?.dryRun ?? false;
  const force = options?.force ?? false;

  const toProcess = await listExpiredTrialRecipients({ includeAlreadyEmailed: force });

  const result: TrialUpgradeCampaignResult = {
    dryRun,
    eligible: toProcess.length,
    sent: 0,
    skipped: 0,
    failed: [],
    recipients: toProcess.map((r) => ({ email: r.email, companyName: r.companyName })),
  };

  if (dryRun) return result;

  const companyPrefs = new Map<string, unknown>();
  if (toProcess.length > 0) {
    const ids = [...new Set(toProcess.map((r) => r.companyId))];
    const rows = await prisma.company.findMany({
      where: { id: { in: ids } },
      select: { id: true, notificationPreferences: true },
    });
    for (const row of rows) {
      companyPrefs.set(row.id, row.notificationPreferences);
    }
  }

  for (const row of toProcess) {
    try {
      await sendTrialEndedUpgradeEmail({
        email: row.email,
        companyName: row.companyName,
        trialEndedAt: row.trialEndedAt,
      });
      await markSent(row.companyId, companyPrefs.get(row.companyId));
      result.sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.failed.push({ email: row.email, error: msg });
    }
  }

  return result;
}

export async function previewExpiredTrialUpgradeCampaign(): Promise<{
  pending: ExpiredTrialRecipient[];
  alreadySent: number;
}> {
  const all = await listExpiredTrialRecipients({ includeAlreadyEmailed: true });
  const pending = all.filter((r) => !r.alreadyEmailed);
  const alreadySent = all.filter((r) => r.alreadyEmailed).length;
  return { pending, alreadySent };
}
