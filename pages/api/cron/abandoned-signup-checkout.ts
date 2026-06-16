import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { sendAbandonedSignupCheckoutEmail } from '../../../lib/email';
import { prisma } from '../../../lib/prisma';
import {
  isEligibleForSignupCheckoutReminder,
  SIGNUP_CHECKOUT_REMINDER_MIN_AGE_MS,
  withSignupCheckoutReminderSent,
} from '../../../lib/signupCheckoutReminder';

const BATCH_LIMIT = 50;

function authorizeCron(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const createdBefore = new Date(now.getTime() - SIGNUP_CHECKOUT_REMINDER_MIN_AGE_MS);
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`;

  const companies = await prisma.company.findMany({
    where: {
      createdAt: { lte: createdBefore },
      trialEndsAt: { gt: now },
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      trialEndsAt: true,
      plan: true,
      subscriptionStatus: true,
      notificationPreferences: true,
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_LIMIT * 3,
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const company of companies) {
    if (sent >= BATCH_LIMIT) break;

    if (!isEligibleForSignupCheckoutReminder(company, now.getTime())) {
      skipped += 1;
      continue;
    }

    try {
      await sendAbandonedSignupCheckoutEmail({
        email: company.email,
        companyName: company.name,
        dashboardUrl,
        companyId: company.id,
      });

      await prisma.company.update({
        where: { id: company.id },
        data: {
          notificationPreferences: withSignupCheckoutReminderSent(
            company.notificationPreferences,
            now.toISOString(),
          ) as Prisma.InputJsonValue,
        },
      });

      sent += 1;
    } catch {
      errors += 1;
    }
  }

  return res.status(200).json({ sent, skipped, errors });
}
