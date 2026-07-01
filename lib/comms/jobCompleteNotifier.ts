import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { parseBusinessSettings } from '../businessFeatures/businessSettings';
import { canUseBusinessFeatures } from '../businessFeatures/planAccess';
import { canUseEnterpriseFeatures } from '../businessFeatures/planAccess';
import { sendJobCompleteCustomerEmail, sendJobCompleteOwnerEmail } from '../email';
import { createSignedPortalLink } from '../portal/portalSignedLink';

function idempotencyKey(entryId: string, recipient: string): string {
  return createHash('sha256').update(`job-complete:${entryId}:${recipient}`).digest('hex');
}

export async function notifyJobComplete(
  prisma: PrismaClient,
  companyId: string,
  logbookEntryId: string,
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      notificationPreferences: true,
    },
  });
  if (!company || !canUseBusinessFeatures(company.plan)) return;

  const prefs = parseBusinessSettings(company.notificationPreferences);
  const entry = await prisma.logbookEntry.findFirst({
    where: { id: logbookEntryId, companyId },
    include: {
      customer: true,
      site: true,
    },
  });
  if (!entry || (entry.status ?? '').toLowerCase() !== 'completed') return;

  const jobSummary = {
    clientName: entry.clientName,
    address: entry.address,
    postcode: entry.postcode,
    treatment: entry.treatment,
    date: entry.date.toISOString(),
    logbookEntryId: entry.id,
  };

  if (prefs.jobCompleteEmailToOwner && company.email) {
    await sendJobCompleteOwnerEmail({
      to: company.email,
      companyName: company.name ?? 'Your business',
      job: jobSummary,
      idempotencyKey: idempotencyKey(entry.id, `owner:${company.email}`),
    }).catch((e) => console.error('[jobComplete] owner email failed', e));
  }

  const customerEmail = entry.customer?.email?.trim();
  if (prefs.jobCompleteEmailToCustomer && customerEmail) {
    let portalLink: string | undefined;
    if (canUseEnterpriseFeatures(company.plan) && entry.customer?.portalEnabled && entry.customerId) {
      portalLink = createSignedPortalLink(entry.customerId, company.id);
    }
    await sendJobCompleteCustomerEmail({
      to: customerEmail,
      companyName: company.name ?? 'Pest control provider',
      customerName: entry.customer?.name ?? entry.clientName,
      job: jobSummary,
      portalLink,
      idempotencyKey: idempotencyKey(entry.id, `customer:${customerEmail}`),
    }).catch((e) => console.error('[jobComplete] customer email failed', e));
  }
}
