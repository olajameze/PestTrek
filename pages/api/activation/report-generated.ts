import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { normalizeAuthEmail } from '../../../lib/auth/userSession';
import { recordActivationMilestone } from '../../../lib/activation/companyActivation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const company = await prisma.company.findUnique({
    where: { email: normalizeAuthEmail(user.email) },
    select: { id: true },
  });
  if (!company) {
    return res.status(403).json({ error: 'Only business owners can record report activation.' });
  }

  const existing = await prisma.companyActivation.findUnique({
    where: { companyId: company.id },
    select: { firstReportGeneratedAt: true },
  });

  if (existing?.firstReportGeneratedAt) {
    return res.status(200).json({
      recorded: false,
      firstReportGeneratedAt: existing.firstReportGeneratedAt.toISOString(),
    });
  }

  const at = new Date();
  await recordActivationMilestone(prisma, company.id, 'first_report_generated', at);

  return res.status(201).json({
    recorded: true,
    firstReportGeneratedAt: at.toISOString(),
  });
}
