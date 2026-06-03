import { prisma } from '../prisma';
import { hasSubscriptionAccess } from '../subscriptionAccess';

export type ExpiredTrialRecipient = {
  companyId: string;
  email: string;
  companyName: string | null;
  trialEndedAt: string;
  alreadyEmailed: boolean;
  optedOut: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function wantsTrialExpiryEmail(notificationPreferences: unknown): boolean {
  if (!isRecord(notificationPreferences)) return true;
  return notificationPreferences.trialExpiry !== false;
}

function trialEndedEmailAlreadySent(notificationPreferences: unknown): boolean {
  if (!isRecord(notificationPreferences)) return false;
  return typeof notificationPreferences.trialEndedUpgradeEmailSentAt === 'string';
}

/**
 * Companies whose app trial window has ended and who do not currently have paid access.
 */
export async function listExpiredTrialRecipients(options?: {
  includeAlreadyEmailed?: boolean;
}): Promise<ExpiredTrialRecipient[]> {
  const now = new Date();
  const includeAlreadyEmailed = options?.includeAlreadyEmailed ?? false;

  const rows = await prisma.company.findMany({
    where: {
      trialEndsAt: { not: null, lt: now },
    },
    select: {
      id: true,
      email: true,
      name: true,
      trialEndsAt: true,
      plan: true,
      subscriptionStatus: true,
      paymentGraceEndsAt: true,
      notificationPreferences: true,
    },
    orderBy: { trialEndsAt: 'desc' },
  });

  const out: ExpiredTrialRecipient[] = [];

  for (const row of rows) {
    const email = row.email.trim();
    if (!email || !email.includes('@')) continue;

    if (
      hasSubscriptionAccess({
        plan: row.plan,
        subscriptionStatus: row.subscriptionStatus,
        trialEndsAt: row.trialEndsAt,
        paymentGraceEndsAt: row.paymentGraceEndsAt,
      })
    ) {
      continue;
    }

    const optedOut = !wantsTrialExpiryEmail(row.notificationPreferences);
    const alreadyEmailed = trialEndedEmailAlreadySent(row.notificationPreferences);

    if (!includeAlreadyEmailed && alreadyEmailed) continue;
    if (optedOut) continue;

    out.push({
      companyId: row.id,
      email,
      companyName: row.name,
      trialEndedAt: row.trialEndsAt!.toISOString(),
      alreadyEmailed,
      optedOut,
    });
  }

  return out;
}
