import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import { getServerSupportEmail } from './supportEmail';

const resendApiKey = process.env.RESEND_API_KEY;
export const supportEmail = getServerSupportEmail();
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Shared HTML shell for transactional messages. */
function brandEmailHtml(title: string, innerHtml: string): string {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${safeTitle}</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e4e4e7;">
        <tr><td style="font-size:15px;line-height:1.6;">${innerHtml}</td></tr>
        <tr><td style="padding-top:20px;margin-top:16px;font-size:12px;color:#71717a;border-top:1px solid #f4f4f5;">Pest Trace · Pest control compliance</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendMail(payload: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Visitor/submitter address so support can hit Reply (defaults to support inbox). */
  replyTo?: string;
  /** Dedupes retries for 24h — see https://resend.com/docs/dashboard/emails/idempotency-keys */
  idempotencyKey?: string;
}) {
  if (!resend) {
    throw new Error('Email service is not configured. Set RESEND_API_KEY.');
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const replyTo = payload.replyTo ?? supportEmail;
  const sendOpts = payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined;

  const result = await resend.emails.send(
    {
      from: `Pest Trace <${fromAddress}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo,
    },
    sendOpts,
  );

  if (result.error) {
    const msg = result.error.message || 'Resend rejected the email.';
    console.error('[Resend]', result.error);
    throw new Error(msg);
  }

  if (result.data?.id) {
    console.info(`[Resend] email queued id=${result.data.id} subject=${payload.subject} to=${payload.to.join(',')}`);
  }

  return result.data;
}

export async function sendWelcomeEmail(email: string, fullName?: string, businessName?: string) {
  const userName = fullName ? escapeHtml(fullName) : 'Pest Trace user';
  const companyName = businessName ? escapeHtml(businessName) : null;
  const appLink = `${appUrl}/auth/verify?email=${encodeURIComponent(email)}`;
  const inner = `
    <p>Hi ${userName},</p>
    <p>Welcome to Pest Trace! Your account has been created successfully.</p>
    ${companyName ? `<p>Your business: <strong>${companyName}</strong></p>` : ''}
    <p>To complete setup, verify your email address by clicking the link in the verification email we sent to <strong>${escapeHtml(email)}</strong>.</p>
    <p>If you did not receive a verification email, please visit <a href="${appLink}">this verification help page</a>.</p>
    <p>Need help? Email us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Thanks,<br />The Pest Trace team</p>
  `;
  const text = `Hi ${fullName ?? 'Pest Trace user'},

Welcome to Pest Trace! Your account has been created successfully.
${companyName ? `Your business: ${businessName}

` : ''}
To complete setup, verify your email address by clicking the link in the verification email we sent to ${email}.

If you did not receive your verification email, visit ${appLink}.

Need help? Email us at ${supportEmail}.

Thanks,
The Pest Trace team`;

  await sendMail({
    to: [email],
    subject: 'Welcome to Pest Trace',
    html: brandEmailHtml('Welcome to Pest Trace', inner),
    text,
  });
}

export async function sendVerificationReminderEmail(email: string) {
  const appLink = `${appUrl}/auth/verify?email=${encodeURIComponent(email)}`;
  const inner = `
    <p>Hi there,</p>
    <p>We have sent a verification email to <strong>${escapeHtml(email)}</strong>.</p>
    <p>Click the link in that email to activate your Pest Trace account and return to the dashboard.</p>
    <p>If you still do not see the verification email, check your spam folder or visit <a href="${appLink}">this page</a> for additional instructions.</p>
    <p>If you need help, contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Thanks,<br />The Pest Trace team</p>
  `;
  const text = `Hi there,

We have sent a verification email to ${email}.

Click the link in that email to activate your Pest Trace account and return to the dashboard.

If you still do not see the verification email, check your spam folder or visit ${appLink} for additional instructions.

If you need help, contact us at ${supportEmail}.

Thanks,
The Pest Trace team`;

  await sendMail({
    to: [email],
    subject: 'Verify your Pest Trace account',
    html: brandEmailHtml('Verify your Pest Trace account', inner),
    text,
  });
}

export async function sendVerificationActionEmail(email: string, actionLink: string) {
  const safeActionLink = escapeHtml(actionLink);
  const safeEmail = escapeHtml(email);
  const inner = `
    <p>Hi there,</p>
    <p>Use the button below to verify the email address for <strong>${safeEmail}</strong>.</p>
    <p style="text-align:center;">
      <a href="${safeActionLink}" style="background-color:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
        Verify email address
      </a>
    </p>
    <p>If the button does not work, copy and paste this URL into your browser:</p>
    <p><a href="${safeActionLink}">${safeActionLink}</a></p>
    <p>If you did not create a Pest Trace account, you can ignore this message.</p>
  `;
  const text = `Hi there,

Use this link to verify ${email}:
${actionLink}

If you did not create a Pest Trace account, you can ignore this message.`;

  await sendMail({
    to: [email],
    subject: 'Verify your Pest Trace email',
    html: brandEmailHtml('Verify your Pest Trace email', inner),
    text,
  });
}

export async function sendAccountDeletionEmail(email: string, companyName?: string) {
  const inner = `
    <p>Hi,</p>
    <p>Your Pest Trace account has been deleted and your company data has been removed.</p>
    ${companyName ? `<p>Company: <strong>${escapeHtml(companyName)}</strong></p>` : ''}
    <p>If this was not requested by you, please contact us immediately at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Thank you for trying Pest Trace.</p>
  `;
  const text = `Hi,

Your Pest Trace account has been deleted and your company data has been removed.
${companyName ? `Company: ${companyName}

` : ''}
If this was not requested by you, please contact us immediately at ${supportEmail}.

Thank you for trying Pest Trace.`;

  await sendMail({
    to: [email],
    subject: 'Your Pest Trace account has been deleted',
    html: brandEmailHtml('Account deleted', inner),
    text,
  });
}

export async function sendUpgradeNotificationEmail(email: string, plan: string) {
  const planLabel = plan === 'business' ? 'Business' : plan === 'pro' ? 'Pro' : plan;
  const inner = `
    <p>Hi,</p>
    <p>Your Pest Trace subscription is now active on the <strong>${escapeHtml(planLabel)}</strong> plan.</p>
    <p>You can now access improved reporting, analytics, and higher tier features inside your dashboard.</p>
    <p>If you have questions about your plan or billing, reach out at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Thanks,<br />The Pest Trace team</p>
  `;
  const text = `Hi,

Your Pest Trace subscription is now active on the ${planLabel} plan.

You can now access improved reporting, analytics, and higher tier features inside your dashboard.

If you have questions about your plan or billing, reach out at ${supportEmail}.

Thanks,
The Pest Trace team`;

  await sendMail({
    to: [email],
    subject: `Your Pest Trace ${planLabel} subscription is active`,
    html: brandEmailHtml('Subscription active', inner),
    text,
  });
}

function formatPlanLabelForEmail(plan: string): string {
  const p = plan.toLowerCase();
  if (p === 'business') return 'Business';
  if (p === 'enterprise') return 'Enterprise';
  if (p === 'pro') return 'Pro';
  return plan;
}

/** Sent when Stripe reports cancel_at_period_end (customer cancelled renewal; access continues until period end). */
export async function sendSubscriptionCancellationScheduledEmail(params: {
  email: string;
  companyName?: string | null;
  plan: string;
  accessEndsAt: Date | null;
}): Promise<void> {
  const planLabel = formatPlanLabelForEmail(params.plan);
  const safeCompany = params.companyName?.trim() ? escapeHtml(params.companyName.trim()) : null;
  const endText = params.accessEndsAt
    ? params.accessEndsAt.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const accessLine = endText
    ? `You keep full access to your <strong>${escapeHtml(planLabel)}</strong> features until <strong>${escapeHtml(endText)}</strong>. After that, your workspace moves to the free trial limits (or trial expired flow) unless you subscribe again.`
    : `You keep full access to your <strong>${escapeHtml(planLabel)}</strong> features until the end of your current billing period. After that, your workspace moves to the free trial limits unless you subscribe again.`;

  const inner = `
    <p>Hi${safeCompany ? ` from <strong>${safeCompany}</strong>` : ''},</p>
    <p>We&apos;ve received your request to cancel your Pest Trace subscription renewal.</p>
    <p>${accessLine}</p>
    <p>You can double-check dates or reactivate any time in your billing portal: <a href="${appUrl}/upgrade">${escapeHtml(appUrl)}/upgrade</a></p>
    <p>Questions? Email <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Thanks,<br />The Pest Trace team</p>
  `;
  const text = `Hi${params.companyName?.trim() ? ` (${params.companyName.trim()})` : ''},

We've received your request to cancel your Pest Trace subscription renewal.
${endText ? `Full ${planLabel} access continues until ${endText}.` : `Full ${planLabel} access continues until the end of your current billing period.`}
After that, your account returns to free trial limits unless you subscribe again.

Manage billing: ${appUrl}/upgrade
Support: ${supportEmail}

Thanks,
The Pest Trace team`;

  await sendMail({
    to: [params.email.trim()],
    subject: `Your Pest Trace subscription renewal is cancelled`,
    html: brandEmailHtml('Subscription renewal cancelled', inner),
    text,
  });
}

/** Sent when the app-managed free trial has ended and the workspace no longer has full access. */
export async function sendTrialEndedUpgradeEmail(params: {
  email: string;
  companyName?: string | null;
  trialEndedAt?: Date | string | null;
}): Promise<{ id: string } | undefined> {
  const email = params.email.trim();
  const upgradeUrl = `${appUrl}/upgrade`;
  const signinUrl = `${appUrl}/auth/signin`;
  const safeCompany = params.companyName?.trim() ? escapeHtml(params.companyName.trim()) : null;
  const ended =
    params.trialEndedAt != null
      ? new Date(params.trialEndedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

  const idempotencyKey = `trial-ended-upgrade/${createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex')
    .slice(0, 48)}`;

  const inner = `
    <p>Hi${safeCompany ? ` from <strong>${safeCompany}</strong>` : ''},</p>
    <p>Thank you for trying Pest Trace. ${
      ended
        ? `Your free trial ended on <strong>${escapeHtml(ended)}</strong>.`
        : 'Your free trial has now ended.'
    }</p>
    <p>We hope the platform helped your team with logbooks, compliance, and day-to-day pest control operations. To continue using Pest Trace without interruption — including your digital logbook, reports, and team access — please choose a plan that fits your business.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${upgradeUrl}" style="background-color:#2F855A;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">
        View plans and subscribe
      </a>
    </p>
    <p>Your existing data remains in your account. Once subscribed, you and your technicians can sign in as usual at <a href="${signinUrl}">${escapeHtml(signinUrl)}</a>.</p>
    <p>If you have questions about pricing, features, or need a little more time to evaluate, we&apos;re happy to help — just reply to this email or contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Thank you again for giving Pest Trace a try.</p>
    <p>Kind regards,<br />The Pest Trace team</p>
  `;

  const text = `Hi${params.companyName?.trim() ? ` (${params.companyName.trim()})` : ''},

Thank you for trying Pest Trace. ${ended ? `Your free trial ended on ${ended}.` : 'Your free trial has now ended.'}

We hope the platform helped your team with logbooks, compliance, and day-to-day operations. To continue using Pest Trace — including your digital logbook, reports, and team access — please choose a plan:

${upgradeUrl}

Your existing data remains in your account. Sign in any time at:
${signinUrl}

Questions about pricing or features? Reply to this email or contact ${supportEmail}.

Thank you again for trying Pest Trace.

Kind regards,
The Pest Trace team`;

  return sendMail({
    to: [email],
    subject: 'Your Pest Trace trial has ended — continue with a plan',
    html: brandEmailHtml('Your trial has ended', inner),
    text,
    idempotencyKey,
  });
}

/** One-time nudge when signup Stripe checkout was abandoned during an active trial. */
export async function sendAbandonedSignupCheckoutEmail(params: {
  email: string;
  companyName?: string | null;
  dashboardUrl: string;
  companyId: string;
}): Promise<{ id: string } | undefined> {
  const email = params.email.trim();
  const dashboardUrl = params.dashboardUrl.trim();
  const safeCompany = params.companyName?.trim() ? escapeHtml(params.companyName.trim()) : null;

  const idempotencyKey = `signup-checkout-reminder/${createHash('sha256')
    .update(params.companyId)
    .digest('hex')
    .slice(0, 48)}`;

  const inner = `
    <p>Hi${safeCompany ? ` from <strong>${safeCompany}</strong>` : ''},</p>
    <p>You started setting up Pest Trace but did not finish adding your card for the free trial. Your workspace is waiting — add a payment method to unlock logbooks, reports, and team access.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(dashboardUrl)}" style="background-color:#2F855A;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">
        Finish setup
      </a>
    </p>
    <p>Opening the link takes you back to your dashboard checkout step. Your trial does not start billing until the trial period ends.</p>
    <p>Questions? Reply to this email or contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Kind regards,<br />The Pest Trace team</p>
  `;

  const text = `Hi${params.companyName?.trim() ? ` (${params.companyName.trim()})` : ''},

You started setting up Pest Trace but did not finish adding your card for the free trial.

Finish setup: ${dashboardUrl}

Your trial does not start billing until the trial period ends.

Questions? Contact ${supportEmail}.

Kind regards,
The Pest Trace team`;

  return sendMail({
    to: [email],
    subject: 'Finish setting up Pest Trace — add your card to start your trial',
    html: brandEmailHtml('Finish your Pest Trace setup', inner),
    text,
    idempotencyKey,
  });
}

/**
 * Delivers marketing/contact form submissions to the support inbox via Resend.
 * Uses an idempotency key so network retries or double-clicks do not send duplicate emails within 24 hours.
 */
export async function sendContactFormNotification(params: {
  submitterName: string;
  submitterEmail: string;
  message: string;
}): Promise<{ id: string } | undefined> {
  const name = params.submitterName.trim();
  const email = params.submitterEmail.trim();
  const message = params.message.trim();
  const idempotencyPayload = `${email.toLowerCase()}\n${name}\n${message}`;
  const idempotencyKey = `contact/${createHash('sha256').update(idempotencyPayload).digest('hex').slice(0, 48)}`;

  const subjectSafe = name.replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  const subject = subjectSafe.length ? `New contact: ${subjectSafe}` : 'New contact form submission';

  const inner = `
    <p><strong>New message</strong> from the Pest Trace contact form.</p>
    <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
    <strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap;border-left:3px solid #e4e4e7;padding-left:12px;margin:0;">${escapeHtml(message)}</p>
  `;
  const text = `New message from the Pest Trace contact form.

Name: ${name}
Email: ${email}

Message:
${message}`;

  return sendMail({
    to: [supportEmail],
    subject,
    html: brandEmailHtml(subject, inner),
    text,
    replyTo: email,
    idempotencyKey,
  });
}

/** Destination for landing-page suggestion alerts (defaults to support inbox). */
export function getSuggestionsNotifyEmail(): string {
  const override = process.env.SUGGESTIONS_NOTIFY_EMAIL?.trim();
  return override && override.includes('@') ? override : supportEmail;
}

/** Internal inbox for new signup alerts (defaults to pesttrace@gmail.com). */
export function getNewSignupNotifyEmail(): string {
  const override = process.env.NEW_SIGNUP_NOTIFY_EMAIL?.trim();
  if (override && override.includes('@')) return override;
  return 'pesttrace@gmail.com';
}

export async function sendNewSignupNotification(params: {
  email: string;
  role: 'admin' | 'technician';
  fullName?: string | null;
  businessName?: string | null;
  companyName?: string | null;
}): Promise<{ id: string } | undefined> {
  const email = params.email.trim().toLowerCase();
  const roleLabel = params.role === 'admin' ? 'Business admin' : 'Technician';
  const fn = params.fullName?.trim() || '(not provided)';
  const business = params.businessName?.trim() || params.companyName?.trim() || '(not provided)';
  const timestamp = new Date().toISOString();

  const idempotencyKey = `signup-notify/${createHash('sha256')
    .update(`${email}\n${params.role}`)
    .digest('hex')
    .slice(0, 48)}`;

  const subject = `New Pest Trace signup: ${roleLabel}`;
  const inner = `
    <p><strong>New account registered</strong> on Pest Trace.</p>
    <p><strong>Role:</strong> ${escapeHtml(roleLabel)}<br/>
    <strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br/>
    <strong>Name:</strong> ${escapeHtml(fn)}<br/>
    <strong>Business / company:</strong> ${escapeHtml(business)}<br/>
    <strong>Registered at (UTC):</strong> ${escapeHtml(timestamp)}</p>
  `;
  const text = `New Pest Trace signup

Role: ${roleLabel}
Email: ${email}
Name: ${fn}
Business / company: ${business}
Registered at (UTC): ${timestamp}`;

  return sendMail({
    to: [getNewSignupNotifyEmail()],
    subject,
    html: brandEmailHtml(subject, inner),
    text,
    replyTo: email,
    idempotencyKey,
  });
}

/**
 * Notifies operators when someone submits a suggestion on the marketing site.
 * Idempotent per suggestion body + category + submitter fingerprint within 24h.
 */
export async function sendSuggestionNotification(params: {
  name?: string | null;
  submitterEmail?: string | null;
  suggestion: string;
  category: string;
}): Promise<{ id: string } | undefined> {
  const suggestion = params.suggestion.trim();
  const category = params.category.trim();
  const name = params.name?.trim() ?? '';
  const email = params.submitterEmail?.trim() ?? '';
  const notifyTo = getSuggestionsNotifyEmail();
  const idempotencyPayload = `${email.toLowerCase()}\n${category}\n${suggestion}`;
  const idempotencyKey = `suggestion/${createHash('sha256').update(idempotencyPayload).digest('hex').slice(0, 48)}`;

  const safeSubject = `New suggestion: ${category.replace(/[\r\n]+/g, ' ').trim().slice(0, 60)}`;

  const inner = `
    <p><strong>New product suggestion</strong> from the PestTrace landing page.</p>
    ${name ? `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` : '<p><strong>Name:</strong> <em>Not provided</em></p>'}
    ${
      email
        ? `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`
        : '<p><strong>Email:</strong> <em>Not provided</em></p>'
    }
    <p><strong>Category:</strong> ${escapeHtml(category)}</p>
    <p><strong>Suggestion:</strong></p>
    <p style="white-space:pre-wrap;border-left:3px solid #e4e4e7;padding-left:12px;margin:0;">${escapeHtml(suggestion)}</p>
  `;
  const text = `New suggestion from the PestTrace landing page.

Name: ${name || '(not provided)'}
Email: ${email || '(not provided)'}
Category: ${category}

Suggestion:
${suggestion}`;

  return sendMail({
    to: [notifyTo],
    subject: safeSubject,
    html: brandEmailHtml(safeSubject, inner),
    text,
    ...(email ? { replyTo: email } : {}),
    idempotencyKey,
  });
}

export async function sendTechnicianInviteEmail(params: {
  email: string;
  technicianName?: string;
  companyName?: string;
  /** When omitted, falls back to SITE_URL-derived signup link using `params.email`. */
  inviteLink?: string;
}): Promise<{ id: string } | undefined> {
  const inviteLink =
    params.inviteLink ??
    `${appUrl}/auth/signup?role=technician&email=${encodeURIComponent(params.email)}`;
  const signinLink = `${appUrl}/auth/signin?role=technician&email=${encodeURIComponent(params.email)}`;
  const safeName = params.technicianName ? escapeHtml(params.technicianName) : 'there';
  const safeCompany = params.companyName ? escapeHtml(params.companyName) : 'your team';

  const inner = `
    <p>Hi ${safeName},</p>
    <p>You were invited to join <strong>${safeCompany}</strong> on Pest Trace as a technician.</p>
    <p>Use the button below to complete technician setup and activate your account.</p>
    <p class="text-sm text-slate-600">If you also receive a separate &quot;confirm email&quot; message from our auth provider, that link now opens your technician workspace (not the business dashboard).</p>
    <p style="text-align:center;">
      <a href="${inviteLink}" style="background-color:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
        Complete technician setup
      </a>
    </p>
    <p>After setup, sign in any time at <a href="${signinLink}">${signinLink}</a> — tap <strong>Send code</strong> and enter the one-time code from your email (technicians sign in with a code, not a password).</p>
    <p>If your account already exists, use that technician sign-in link and request a new code.</p>
    <p>Need help? Contact <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    <p>Thanks,<br />The Pest Trace team</p>
  `;

  const text = `Hi ${params.technicianName ?? 'there'},

You were invited to join ${params.companyName ?? 'your team'} on Pest Trace as a technician.

Complete technician setup:
${inviteLink}

After setup, sign in at:
${signinLink}
Tap Send code and enter the one-time code from your email.

If your account already exists, open the technician sign-in link and request a new code.

Need help? Contact ${supportEmail}.

Thanks,
The Pest Trace team`;

  return sendMail({
    to: [params.email],
    subject: 'You are invited to Pest Trace as a technician',
    html: brandEmailHtml('Technician invite', inner),
    text,
  });
}

export async function sendVerificationEmail(email: string, token: string, userName?: string) {
  const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  const greeting = userName ? escapeHtml(userName) : 'there';
  const inner = `
    <p>Hi ${greeting},</p>
    <p>Please click the button below to verify your Pest Trace email address:</p>
    <p style="text-align:center;">
      <a href="${verificationUrl}" style="background-color:#3B82F6;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
        Verify email address
      </a>
    </p>
    <p>This verification link will expire in 24 hours.</p>
    <p>If you did not create a Pest Trace account, please ignore this email.</p>
    <p>Thanks,<br />The Pest Trace team</p>
  `;
  const text = `Hi ${userName ?? 'there'},

Please verify your email by visiting this link:
${verificationUrl}

This link expires in 24 hours.

If you did not create a Pest Trace account, please ignore this email.

Thanks,
The Pest Trace team`;

  await sendMail({
    to: [email],
    subject: 'Verify your Pest Trace email address',
    html: brandEmailHtml('Verify your email', inner),
    text,
  });
}
