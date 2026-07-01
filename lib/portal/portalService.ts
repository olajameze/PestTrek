import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../scheduling/validation';
import { canUseEnterpriseFeatures } from '../businessFeatures/planAccess';

const PORTAL_TOKEN_DAYS = 90;

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generatePortalToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function enableCustomerPortal(
  prisma: PrismaClient,
  companyId: string,
  companyPlan: string | null | undefined,
  customerId: string,
): Promise<{ portalUrl: string; token: string; expiresAt: Date }> {
  if (!canUseEnterpriseFeatures(companyPlan)) {
    throw new Error('Client portal requires Enterprise plan');
  }
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const token = generatePortalToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + PORTAL_TOKEN_DAYS);

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      portalEnabled: true,
      portalTokenHash: hashPortalToken(token),
      portalTokenExpiresAt: expiresAt,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return { portalUrl: `${appUrl}/portal/${token}`, token, expiresAt };
}

export async function disableCustomerPortal(
  prisma: PrismaClient,
  companyId: string,
  customerId: string,
): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) throw new NotFoundError('Customer not found');
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      portalEnabled: false,
      portalTokenHash: null,
      portalTokenExpiresAt: null,
    },
  });
}

export async function resolveCustomerByPortalToken(prisma: PrismaClient, token: string) {
  const hash = hashPortalToken(token);
  const now = new Date();
  const customer = await prisma.customer.findFirst({
    where: {
      portalEnabled: true,
      portalTokenHash: hash,
      portalTokenExpiresAt: { gt: now },
      archivedAt: null,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          plan: true,
          notificationPreferences: true,
        },
      },
      sites: { where: { archivedAt: null }, orderBy: { address: 'asc' } },
    },
  });
  if (!customer || !canUseEnterpriseFeatures(customer.company.plan)) return null;
  return customer;
}
