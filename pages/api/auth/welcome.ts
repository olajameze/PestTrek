import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { normalizeAuthEmail } from '../../../lib/auth/userSession';
import { sendNewSignupNotification, sendWelcomeEmail } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  const bearer = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (!bearer) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(bearer);
  if (authErr || !user?.email) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const sessionRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
  if (sessionRole !== 'admin') {
    return res.status(403).json({ error: 'Business admin signup only' });
  }

  const { email, fullName, businessName } = req.body as {
    email?: string;
    fullName?: string;
    businessName?: string;
  };

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const bodyEmail = normalizeAuthEmail(email);
  const sessionEmail = normalizeAuthEmail(user.email);
  if (bodyEmail !== sessionEmail) {
    return res.status(403).json({ error: 'Email does not match signed-in user' });
  }

  const fn = typeof fullName === 'string' ? fullName.trim() || null : null;
  const bn = typeof businessName === 'string' ? businessName.trim() || null : null;

  try {
    await prisma.signupMarketingLead.upsert({
      where: { email: sessionEmail },
      create: {
        email: sessionEmail,
        fullName: fn,
        businessName: bn,
      },
      update: {
        fullName: fn,
        businessName: bn,
      },
    });
  } catch (e) {
    console.error('Signup marketing lead upsert failed:', e);
    return res.status(500).json({ error: 'Unable to record signup' });
  }

  try {
    await sendWelcomeEmail(sessionEmail, fn ?? undefined, bn ?? undefined);
  } catch (error) {
    console.error('Welcome email failed:', error);
    return res.status(500).json({ error: 'Failed to send welcome email' });
  }

  try {
    await sendNewSignupNotification({
      email: sessionEmail,
      role: 'admin',
      fullName: fn,
      businessName: bn,
    });
  } catch (error) {
    console.error('New signup operator notification failed:', error);
  }

  return res.status(200).json({ success: true });
}
