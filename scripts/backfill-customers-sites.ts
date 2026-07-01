/**
 * Backfill Customer and Site records from existing logbook/appointment data.
 * Run: npx tsx scripts/backfill-customers-sites.ts
 */
import { PrismaClient } from '@prisma/client';
import { normalizeCustomerKey, normalizeSiteKey } from '../lib/activation/companyActivation';

const prisma = new PrismaClient();

async function backfillCompany(companyId: string): Promise<{ customers: number; sites: number; linked: number }> {
  const customerMap = new Map<string, string>();
  const siteMap = new Map<string, string>();
  let linked = 0;

  const entries = await prisma.logbookEntry.findMany({
    where: { companyId },
    select: {
      id: true,
      clientName: true,
      address: true,
      postcode: true,
      propertyType: true,
      customerId: true,
      siteId: true,
    },
  });

  for (const entry of entries) {
    const cKey = normalizeCustomerKey(entry.clientName);
    if (!cKey) continue;

    let customerId = customerMap.get(cKey);
    if (!customerId) {
      const existing = await prisma.customer.findFirst({
        where: { companyId, name: { equals: entry.clientName.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await prisma.customer.create({
          data: { companyId, name: entry.clientName.trim() },
          select: { id: true },
        });
        customerId = created.id;
      }
      customerMap.set(cKey, customerId);
    }

    const sKey = normalizeSiteKey(entry.address, entry.postcode);
    let siteId = siteMap.get(`${customerId}|${sKey}`);
    if (!siteId) {
      const existingSite = await prisma.site.findFirst({
        where: {
          companyId,
          customerId,
          address: { equals: entry.address.trim(), mode: 'insensitive' },
          postcode: entry.postcode?.trim() || null,
        },
        select: { id: true },
      });
      if (existingSite) {
        siteId = existingSite.id;
      } else {
        const created = await prisma.site.create({
          data: {
            companyId,
            customerId,
            address: entry.address.trim(),
            postcode: entry.postcode?.trim() || null,
            propertyType: entry.propertyType,
          },
          select: { id: true },
        });
        siteId = created.id;
      }
      siteMap.set(`${customerId}|${sKey}`, siteId);
    }

    if (!entry.customerId || !entry.siteId) {
      await prisma.logbookEntry.update({
        where: { id: entry.id },
        data: {
          customerId: entry.customerId ?? customerId,
          siteId: entry.siteId ?? siteId,
        },
      });
      linked += 1;
    }
  }

  const appointments = await prisma.appointment.findMany({
    where: { companyId },
    select: {
      id: true,
      clientName: true,
      address: true,
      postcode: true,
      customerId: true,
      siteId: true,
    },
  });

  for (const appt of appointments) {
    const cKey = normalizeCustomerKey(appt.clientName);
    if (!cKey) continue;
    const customerId = customerMap.get(cKey);
    if (!customerId) continue;
    const sKey = normalizeSiteKey(appt.address, appt.postcode);
    const siteId = siteMap.get(`${customerId}|${sKey}`);
    if (!siteId) continue;
    if (!appt.customerId || !appt.siteId) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          customerId: appt.customerId ?? customerId,
          siteId: appt.siteId ?? siteId,
        },
      });
    }
  }

  return { customers: customerMap.size, sites: siteMap.size, linked };
}

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  for (const company of companies) {
    const result = await backfillCompany(company.id);
    console.log(
      `[${company.name ?? company.id}] customers=${result.customers} sites=${result.sites} linked=${result.linked}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
