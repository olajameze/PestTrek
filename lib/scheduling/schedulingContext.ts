import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../supabase';
import { prisma } from '../prisma';
import { hasSubscriptionAccess } from '../subscriptionAccess';
import { normalizeAuthEmail } from '../auth/userSession';
import { technicianEmailWhere } from '../auth/technicianGate';
import { canUseSmartScheduling, smartSchedulingPlanError } from './planAccess';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from './validation';

export type SchedulingCompany = {
  id: string;
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  paymentGraceEndsAt: Date | null;
  email: string;
};

export type SchedulingContext = {
  company: SchedulingCompany;
  userEmail: string;
  isOwner: boolean;
  technicianId: string | null;
  canWrite: boolean;
};

export async function resolveSchedulingContext(req: NextApiRequest): Promise<SchedulingContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
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
      technicianId: null,
      canWrite,
    };
  }

  const technician = await prisma.technician.findFirst({
    where: technicianEmailWhere(authEmail),
    select: { id: true, companyId: true, email: true },
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
    },
  });
  if (!company) return null;

  return {
    company,
    userEmail: authEmail,
    isOwner: false,
    technicianId: technician.id,
    canWrite: false,
  };
}

export function assertSchedulingAccess(ctx: SchedulingContext): void {
  if (!hasSubscriptionAccess(ctx.company)) {
    throw new ForbiddenError('Trial expired. Upgrade required to continue using Pest Trace.');
  }
  if (!canUseSmartScheduling(ctx.company.plan)) {
    throw new ForbiddenError(smartSchedulingPlanError());
  }
}

export function handleSchedulingError(res: NextApiResponse, error: unknown): void {
  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof ConflictError) {
    res.status(error.statusCode).json({ error: error.message, code: 'CONFLICT' });
    return;
  }
  if (error instanceof ForbiddenError) {
    res.status(error.statusCode).json({ error: error.message, code: 'FORBIDDEN' });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  throw error;
}

export async function withSchedulingHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (ctx: SchedulingContext) => Promise<void>,
): Promise<void> {
  try {
    const ctx = await resolveSchedulingContext(req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    assertSchedulingAccess(ctx);
    await handler(ctx);
  } catch (error) {
    handleSchedulingError(res, error);
  }
}
