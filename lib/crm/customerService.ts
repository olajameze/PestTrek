import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../scheduling/validation';
import { normalizeCustomerKey, normalizeSiteKey } from '../activation/companyActivation';

export type CreateCustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export type CreateSiteInput = {
  customerId: string;
  label?: string | null;
  address: string;
  postcode?: string | null;
  accessNotes?: string | null;
  propertyType?: string | null;
};

export async function listCustomers(
  prisma: PrismaClient,
  companyId: string,
  includeArchived = false,
) {
  return prisma.customer.findMany({
    where: {
      companyId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: { name: 'asc' },
    include: {
      sites: {
        where: includeArchived ? {} : { archivedAt: null },
        orderBy: { address: 'asc' },
      },
      _count: { select: { logbookEntries: true, invoices: true } },
    },
  });
}

export async function getCustomerById(prisma: PrismaClient, companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    include: {
      sites: { where: { archivedAt: null }, orderBy: { address: 'asc' } },
      logbookEntries: {
        orderBy: { date: 'desc' },
        take: 20,
        select: {
          id: true,
          date: true,
          treatment: true,
          status: true,
          address: true,
          price: true,
        },
      },
      invoices: {
        orderBy: { issuedAt: 'desc' },
        take: 10,
        select: { id: true, number: true, status: true, total: true, issuedAt: true },
      },
    },
  });
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

export async function createCustomer(
  prisma: PrismaClient,
  companyId: string,
  input: CreateCustomerInput,
) {
  const name = input.name?.trim();
  if (!name) throw new ValidationError('Customer name is required');
  return prisma.customer.create({
    data: {
      companyId,
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateCustomer(
  prisma: PrismaClient,
  companyId: string,
  customerId: string,
  input: Partial<CreateCustomerInput> & { archived?: boolean },
) {
  await getCustomerById(prisma, companyId, customerId);
  return prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.archived === true ? { archivedAt: new Date() } : {}),
      ...(input.archived === false ? { archivedAt: null } : {}),
    },
  });
}

export async function createSite(prisma: PrismaClient, companyId: string, input: CreateSiteInput) {
  const address = input.address?.trim();
  if (!address) throw new ValidationError('Site address is required');
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, companyId },
    select: { id: true },
  });
  if (!customer) throw new NotFoundError('Customer not found');
  return prisma.site.create({
    data: {
      companyId,
      customerId: input.customerId,
      label: input.label?.trim() || null,
      address,
      postcode: input.postcode?.trim() || null,
      accessNotes: input.accessNotes?.trim() || null,
      propertyType: input.propertyType?.trim() || null,
    },
  });
}

export async function updateSite(
  prisma: PrismaClient,
  companyId: string,
  siteId: string,
  input: Partial<Omit<CreateSiteInput, 'customerId'>> & { archived?: boolean },
) {
  const site = await prisma.site.findFirst({ where: { id: siteId, companyId } });
  if (!site) throw new NotFoundError('Site not found');
  return prisma.site.update({
    where: { id: siteId },
    data: {
      ...(input.label !== undefined ? { label: input.label?.trim() || null } : {}),
      ...(input.address !== undefined ? { address: input.address.trim() } : {}),
      ...(input.postcode !== undefined ? { postcode: input.postcode?.trim() || null } : {}),
      ...(input.accessNotes !== undefined ? { accessNotes: input.accessNotes?.trim() || null } : {}),
      ...(input.propertyType !== undefined ? { propertyType: input.propertyType?.trim() || null } : {}),
      ...(input.archived === true ? { archivedAt: new Date() } : {}),
      ...(input.archived === false ? { archivedAt: null } : {}),
    },
  });
}

/** Resolve or create customer+site from free-text fields (Business+ auto-link). */
export async function resolveCustomerSiteFromText(
  prisma: PrismaClient,
  companyId: string,
  clientName: string,
  address: string,
  postcode?: string | null,
  propertyType?: string | null,
): Promise<{ customerId: string; siteId: string }> {
  const name = clientName.trim();
  const addr = address.trim();
  if (!name || !addr) throw new ValidationError('Client name and address are required');

  let customer = await prisma.customer.findFirst({
    where: { companyId, name: { equals: name, mode: 'insensitive' }, archivedAt: null },
    select: { id: true },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { companyId, name },
      select: { id: true },
    });
  }

  const siteKey = normalizeSiteKey(addr, postcode);
  const sites = await prisma.site.findMany({
    where: { companyId, customerId: customer.id, archivedAt: null },
    select: { id: true, address: true, postcode: true },
  });
  let site = sites.find((s) => normalizeSiteKey(s.address, s.postcode) === siteKey);
  if (!site) {
    const created = await prisma.site.create({
      data: {
        companyId,
        customerId: customer.id,
        address: addr,
        postcode: postcode?.trim() || null,
        propertyType: propertyType?.trim() || null,
      },
      select: { id: true },
    });
    site = { id: created.id, address: addr, postcode: postcode ?? null };
  }

  return { customerId: customer.id, siteId: site.id };
}

export async function getSiteWithCustomer(
  prisma: PrismaClient,
  companyId: string,
  siteId: string,
) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, companyId, archivedAt: null },
    include: { customer: true },
  });
  if (!site) throw new NotFoundError('Site not found');
  return site;
}

export function denormalizeFromSite(site: {
  address: string;
  postcode: string | null;
  propertyType: string | null;
  customer: { name: string };
}) {
  return {
    clientName: site.customer.name,
    address: site.address,
    postcode: site.postcode,
    propertyType: site.propertyType,
  };
}

export { normalizeCustomerKey, normalizeSiteKey };
