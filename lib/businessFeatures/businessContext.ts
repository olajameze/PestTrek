import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../supabase';
import { prisma } from '../prisma';
import { hasSubscriptionAccess, subscriptionAccessBlockedMessage } from '../subscriptionAccess';
import { normalizeAuthEmail } from '../auth/userSession';
import { technicianEmailWhere } from '../auth/technicianGate';
import { ForbiddenError, NotFoundError, ValidationError } from '../scheduling/validation';
import { canUseBusinessFeatures, businessPlanError } from './planAccess';

export type BusinessCompany = {
  id: string;
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  paymentGraceEndsAt: Date | null;
  email: string;
  name: string | null;
  vatNumber: string | null;
  invoicePrefix: string | null;
  nextInvoiceNumber: number | null;
  defaultVatRate: { toNumber(): number } | null;
  notificationPreferences: unknown;
};

export type BusinessContext = {
  company: BusinessCompany;
  userEmail: string;
  isOwner: boolean;
  canWrite: boolean;
};

export async function resolveBusinessContext(req: NextApiRequest): Promise<BusinessContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return null;

  const authEmail = normalizeAuthEmail(user.email);
  const ownerCompany = await prisma.company.findUnique({
    where: { email: authEmail },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      paymentGraceEndsAt: true,
      email: true,
      name: true,
      vatNumber: true,
      invoicePrefix: true,
      nextInvoiceNumber: true,
      defaultVatRate: true,
      notificationPreferences: true,
    },
  });

  if (ownerCompany) {
    const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const role = profileRes.data?.role;
    const canWrite = role !== 'technician';
    return {
      company: ownerCompany,
      userEmail: authEmail,
      isOwner: true,
      canWrite,
    };
  }

  const technician = await prisma.technician.findFirst({
    where: technicianEmailWhere(authEmail),
    select: { companyId: true },
  });
  if (!technician) return null;

  const company = await prisma.company.findUnique({
    where: { id: technician.companyId },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      paymentGraceEndsAt: true,
      email: true,
      name: true,
      vatNumber: true,
      invoicePrefix: true,
      nextInvoiceNumber: true,
      defaultVatRate: true,
      notificationPreferences: true,
    },
  });
  if (!company) return null;

  return {
    company,
    userEmail: authEmail,
    isOwner: false,
    canWrite: false,
  };
}

export function assertBusinessAccess(ctx: BusinessContext): void {
  if (!hasSubscriptionAccess(ctx.company)) {
    throw new ForbiddenError(subscriptionAccessBlockedMessage(ctx.company));
  }
  if (!canUseBusinessFeatures(ctx.company.plan)) {
    throw new ForbiddenError(businessPlanError());
  }
}

export function assertBusinessWrite(ctx: BusinessContext): void {
  assertBusinessAccess(ctx);
  if (!ctx.canWrite) {
    throw new ForbiddenError('Technician accounts cannot modify this resource.');
  }
}

export function handleBusinessError(res: NextApiResponse, error: unknown): void {
  if (error instanceof ValidationError || error instanceof ForbiddenError || error instanceof NotFoundError) {
    res.status(error.statusCode).json({ error: error.message, code: error instanceof ForbiddenError ? 'FORBIDDEN' : undefined });
    return;
  }
  throw error;
}

export function isMutatingBusinessMethod(method?: string): boolean {
  const normalized = method?.toUpperCase();
  return normalized === 'POST' || normalized === 'PATCH' || normalized === 'PUT' || normalized === 'DELETE';
}

export async function withOwnerBusinessHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (ctx: BusinessContext) => Promise<void>,
  options?: { requireWrite?: boolean },
): Promise<void> {
  try {
    const ctx = await resolveBusinessContext(req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const requireWrite = options?.requireWrite ?? isMutatingBusinessMethod(req.method);
    if (!ctx.isOwner && requireWrite) {
      res.status(403).json({ error: 'Only business owners can modify this resource.', code: 'FORBIDDEN' });
      return;
    }
    assertBusinessAccess(ctx);
    if (requireWrite) {
      assertBusinessWrite(ctx);
    }
    await handler(ctx);
  } catch (error) {
    handleBusinessError(res, error);
  }
}
