import type { NextApiRequest, NextApiResponse } from 'next';
import { TECHNICIAN_EMAIL_NOT_ON_ROSTER, technicianEmailWhere } from '../../../lib/auth/technicianGate';
import { authCallbackUrl } from '../../../lib/authRedirect';
import { prisma } from '../../../lib/prisma';
import { sendNewSignupNotification } from '../../../lib/email';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
  const rawFullName = typeof req.body?.fullName === 'string' ? req.body.fullName : '';

  const email = rawEmail.trim().toLowerCase();
  const fullName = rawFullName.trim();

  if (!validEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  const techRecord = await prisma.technician.findFirst({
    where: technicianEmailWhere(email),
    select: {
      id: true,
      name: true,
      companyId: true,
      company: { select: { name: true } },
    },
  });
  if (!techRecord) {
    return res.status(403).json({
      error: TECHNICIAN_EMAIL_NOT_ON_ROSTER,
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'Auth service is not configured.' });
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/$/, '');
  const emailRedirectTo = baseUrl ? authCallbackUrl(baseUrl, '/technician') : undefined;

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(emailRedirectTo ? { email_redirect_to: emailRedirectTo } : {}),
    user_metadata: {
      role: 'technician',
      fullName: fullName || techRecord.name || '',
      technicianId: techRecord.id,
      companyId: techRecord.companyId,
    },
  });

  if (created.error) {
    if ((created.error.message || '').toLowerCase().includes('already')) {
      return res.status(409).json({
        error: 'This technician account already exists. Please sign in using one-time code.',
      });
    }
    return res.status(400).json({ error: created.error.message || 'Unable to create technician account.' });
  }

  try {
    await sendNewSignupNotification({
      email,
      role: 'technician',
      fullName: fullName || techRecord.name,
      companyName: techRecord.company?.name ?? null,
    });
  } catch (error) {
    console.error('New signup operator notification failed:', error);
  }

  return res.status(200).json({ success: true });
}
