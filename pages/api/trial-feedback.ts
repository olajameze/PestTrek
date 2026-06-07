import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { supabase } from '../../lib/supabase';
import { prisma } from '../../lib/prisma';
import { normalizeAuthEmail } from '../../lib/auth/userSession';
import {
  isTrialUpgradeFeedbackReason,
  parseTrialFeedbackDismissedAt,
  withTrialFeedbackDismissed,
} from '../../lib/trial/upgradeFeedback';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    select: { id: true, notificationPreferences: true },
  });
  if (!company) return res.status(403).json({ error: 'Only business owners can submit trial feedback.' });

  if (req.method === 'GET') {
    const existing = await prisma.trialUpgradeFeedback.findUnique({
      where: { companyId: company.id },
      select: { reason: true, comment: true, createdAt: true },
    });
    return res.status(200).json({
      submitted: Boolean(existing),
      feedback: existing
        ? {
            reason: existing.reason,
            comment: existing.comment,
            createdAt: existing.createdAt.toISOString(),
          }
        : null,
      dismissedAt: parseTrialFeedbackDismissedAt(company.notificationPreferences),
    });
  }

  if (req.method === 'POST') {
    const action = typeof req.body?.action === 'string' ? req.body.action : 'submit';

    if (action === 'dismiss') {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          notificationPreferences: withTrialFeedbackDismissed(
            company.notificationPreferences,
            new Date().toISOString(),
          ) as Prisma.InputJsonValue,
        },
      });
      return res.status(200).json({ dismissed: true });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!isTrialUpgradeFeedbackReason(reason)) {
      return res.status(400).json({ error: 'Invalid feedback reason.' });
    }

    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : null;

    const existing = await prisma.trialUpgradeFeedback.findUnique({
      where: { companyId: company.id },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: 'Feedback already submitted for this account.' });
    }

    const row = await prisma.trialUpgradeFeedback.create({
      data: {
        companyId: company.id,
        userId: user.id,
        userEmail: user.email,
        reason,
        comment: comment || null,
      },
    });

    return res.status(201).json({
      id: row.id,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
