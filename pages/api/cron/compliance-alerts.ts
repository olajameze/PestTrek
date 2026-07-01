import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { sendComplianceAlertsDigestEmail } from '../../../lib/email';
import {
  detectComplianceAlerts,
  resolveStaleComplianceAlerts,
  upsertComplianceAlerts,
} from '../../../lib/compliance/recurringVisitAlerts';
import { canUseBusinessFeatures } from '../../../lib/businessFeatures/planAccess';

function authorizeCron(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization ?? '';
  return auth === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const companies = await prisma.company.findMany({
    where: {
      plan: { in: ['business', 'enterprise'] },
      subscriptionStatus: { in: ['active', 'trialing', 'past_due'] },
    },
    select: { id: true, email: true, name: true, plan: true },
  });

  let processed = 0;
  for (const company of companies) {
    if (!canUseBusinessFeatures(company.plan)) continue;
    const candidates = await detectComplianceAlerts(prisma, company.id);
    const activeKeys = new Set(candidates.map((c) => `${c.type}:${c.entityType}:${c.entityId}`));
    await upsertComplianceAlerts(prisma, company.id, candidates);
    await resolveStaleComplianceAlerts(prisma, company.id, activeKeys);

    const toEmail = await prisma.complianceAlert.findMany({
      where: { companyId: company.id, resolvedAt: null, emailedAt: null },
      take: 20,
    });
    if (toEmail.length > 0 && company.email) {
      try {
        await sendComplianceAlertsDigestEmail({
          to: company.email,
          companyName: company.name ?? 'Your business',
          alerts: toEmail.map((a) => a.message),
        });
        await prisma.complianceAlert.updateMany({
          where: { id: { in: toEmail.map((a) => a.id) } },
          data: { emailedAt: new Date() },
        });
      } catch (e) {
        console.error('[compliance-cron] email failed', e);
      }
    }
    processed += 1;
  }

  await prisma.backgroundJobRun.upsert({
    where: { jobName: 'compliance-alerts' },
    create: { jobName: 'compliance-alerts', lastFinishedAt: new Date(), status: 'ok', detail: { processed } },
    update: { lastFinishedAt: new Date(), status: 'ok', detail: { processed } },
  });

  return res.status(200).json({ ok: true, processed });
}
