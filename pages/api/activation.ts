import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { prisma } from '../../lib/prisma';
import { normalizeAuthEmail } from '../../lib/auth/userSession';
import { technicianEmailWhere } from '../../lib/auth/technicianGate';
import {
  ACTIVATION_MILESTONES,
  backfillActivationFromCompanyData,
  buildActivationEvents,
  buildMilestoneFlags,
  computeActivationScore,
  getNextRecommendedAction,
} from '../../lib/activation/companyActivation';

const MILESTONE_META_EXPORT = {
  first_customer_created: { label: 'Create your first customer', completedLabel: 'First customer created' },
  first_site_created: { label: 'Add your first site', completedLabel: 'First site added' },
  first_job_completed: { label: 'Complete your first job', completedLabel: 'First job completed' },
  first_photo_uploaded: { label: 'Upload your first photo', completedLabel: 'First photo uploaded' },
  first_report_generated: { label: 'Generate your first report', completedLabel: 'First report generated' },
} as const;

async function resolveCompanyContext(email: string) {
  const authEmail = normalizeAuthEmail(email);
  const ownerCompany = await prisma.company.findUnique({
    where: { email: authEmail },
    select: { id: true },
  });
  if (ownerCompany) {
    return { companyId: ownerCompany.id, isOwner: true };
  }

  const technician = await prisma.technician.findFirst({
    where: technicianEmailWhere(authEmail),
    select: { companyId: true },
  });
  if (!technician) return null;
  return { companyId: technician.companyId, isOwner: false };
}

function buildActivationResponse(
  row: Awaited<ReturnType<typeof backfillActivationFromCompanyData>>,
) {
  const score = computeActivationScore(row);
  const flags = buildMilestoneFlags(row);
  const events = buildActivationEvents(row);
  const nextAction = getNextRecommendedAction(row);

  const completed = ACTIVATION_MILESTONES.filter((m) => flags[m]).map((m) => ({
    milestone: m,
    label: MILESTONE_META_EXPORT[m].completedLabel,
    completedAt: events[m],
  }));

  const remaining = ACTIVATION_MILESTONES.filter((m) => !flags[m]).map((m) => ({
    milestone: m,
    label: MILESTONE_META_EXPORT[m].label,
  }));

  return {
    completionPercent: score,
    score,
    milestones: flags,
    events,
    nextAction,
    checklistDismissed: Boolean(row.checklistDismissedAt),
    checklistDismissedAt: row.checklistDismissedAt?.toISOString() ?? null,
    completed,
    remaining,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const context = await resolveCompanyContext(user.email);
  if (!context) return res.status(404).json({ error: 'Company not found' });

  if (req.method === 'GET') {
    const row = await backfillActivationFromCompanyData(prisma, context.companyId);
    return res.status(200).json(buildActivationResponse(row));
  }

  if (req.method === 'PATCH') {
    if (!context.isOwner) {
      return res.status(403).json({ error: 'Only business owners can update activation settings.' });
    }

    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    if (action === 'dismiss_checklist') {
      const row = await prisma.companyActivation.upsert({
        where: { companyId: context.companyId },
        create: {
          companyId: context.companyId,
          checklistDismissedAt: new Date(),
        },
        update: {
          checklistDismissedAt: new Date(),
        },
      });
      return res.status(200).json(buildActivationResponse(row));
    }

    return res.status(400).json({ error: 'Unsupported action.' });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
