import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/router';
import AuthLayout from '../../components/layouts/AuthLayout';
import Button from '../../components/ui/Button';
import FormInput from '../../components/ui/FormInput';
import PasswordField from '../../components/ui/PasswordField';
import { useToast } from '../../components/ui/ToastProvider';
import { authCallbackUrl } from '../../lib/authRedirect';
import { resolveBusinessSignInRoute } from '../../lib/auth/resolveWorkspaceRoute';

export type SignInPageProps = {
  initialRole: 'admin' | 'technician';
  initialInviteEmail: string;
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export const getServerSideProps: GetServerSideProps<SignInPageProps> = async (context) => {
  const roleParam = firstQueryValue(context.query.role);
  const initialRole: SignInPageProps['initialRole'] = roleParam === 'technician' ? 'technician' : 'admin';

  let initialInviteEmail = '';
  const emailParam = firstQueryValue(context.query.email);
  if (emailParam?.trim()) {
    try {
      initialInviteEmail = decodeURIComponent(emailParam.trim());
    } catch {
      initialInviteEmail = emailParam.trim();
    }
  }

  return {
    props: {
      initialRole,
      initialInviteEmail,
    },
  };
};

export default function SignIn({ initialRole, initialInviteEmail }: SignInPageProps) {
  const router = useRouter();
  const roleFromRouter =
    router.isReady && typeof router.query.role === 'string' ? router.query.role : undefined;
  const role =
    roleFromRouter === 'technician' || (roleFromRouter === undefined && initialRole === 'technician')
      ? 'technician'
      : 'admin';

  const emailFromRouter =
    router.isReady && typeof router.query.email === 'string'
      ? decodeURIComponent(router.query.email)
      : undefined;
  const inviteEmail =
    emailFromRouter !== undefined ? emailFromRouter : initialInviteEmail;

  const isTechnicianFlow = role === 'technician';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { showToast } = useToast();
  const otpCooldownRaw = Number(process.env.NEXT_PUBLIC_OTP_RESEND_COOLDOWN_SECONDS ?? '30');
  const otpCooldownSeconds = Number.isFinite(otpCooldownRaw) && otpCooldownRaw > 0 ? otpCooldownRaw : 30;
  const resolvedEmail = email || inviteEmail;

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCountdown]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      showToast('Sign in failed', error.message, 'error');
    } else if (!data.session) {
      setSuccessMessage('Please verify your email before accessing the dashboard.');
      showToast('Email verification required', 'Check your inbox or resend verification from the next screen.', 'info');
      router.push(`/auth/verify?email=${encodeURIComponent(resolvedEmail)}`);
    } else {
      const u = data.session.user as {
        email_confirmed_at?: string | null;
        confirmed_at?: string | null;
        email_confirmed?: boolean;
      };
      const verified = Boolean(u.email_confirmed_at ?? u.confirmed_at ?? u.email_confirmed);
      if (!verified && !isTechnicianFlow) {
        setSuccessMessage('Please verify your email before accessing the dashboard.');
        showToast('Email verification required', 'Check your inbox for the verification email.', 'info');
        router.push(`/auth/verify?email=${encodeURIComponent(resolvedEmail)}`);
        setLoading(false);
        return;
      }
      if (data.session.access_token) {
        const destination = await resolveBusinessSignInRoute(
          data.session.access_token,
          data.session.user.email,
        );
        if (destination === '/technician') {
          setSuccessMessage('Signed in successfully. Redirecting to technician workspace...');
          showToast('Signed in', 'Redirecting to technician workspace', 'success');
          setLoading(false);
          await router.push('/technician');
          return;
        }
      }
      setSuccessMessage('Signed in successfully. Redirecting to dashboard...');
      showToast('Signed in', 'Redirecting to dashboard', 'success');
      router.push('/dashboard');
    }
    setLoading(false);
  };

  const sendTechnicianCode = async () => {
    const normalizedEmail = resolvedEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your technician email first.');
      return;
    }

    setSendingOtp(true);
    setError('');
    setSuccessMessage('');

    const eligibilityRes = await fetch('/api/auth/technician-otp-eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const eligibilityBody = (await eligibilityRes.json().catch(() => ({}))) as { error?: string };
    if (!eligibilityRes.ok) {
      const message = eligibilityBody.error || 'Unable to send sign-in code.';
      setError(message);
      showToast('Sign in not available', message, 'error');
      setSendingOtp(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authCallbackUrl(window.location.origin, '/technician'),
      },
    });

    if (otpError) {
      setError(otpError.message);
      showToast('Code send failed', otpError.message, 'error');
      setSendingOtp(false);
      return;
    }

    setOtpSent(true);
    setResendCountdown(otpCooldownSeconds);
    setSuccessMessage('A one-time code was sent to your email. Enter it below to sign in.');
    showToast('Code sent', 'Check your inbox for your one-time code.', 'success');
    setSendingOtp(false);
  };

  const verifyTechnicianCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = resolvedEmail.trim().toLowerCase();
    if (!normalizedEmail || !otpCode.trim()) {
      setError('Enter both email and one-time code.');
      return;
    }

    setVerifyingOtp(true);
    setError('');
    setSuccessMessage('');

    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otpCode.trim(),
      type: 'email',
    });

    if (otpError || !data.session) {
      const message = otpError?.message || 'Invalid or expired one-time code.';
      setError(message);
      showToast('Verification failed', message, 'error');
      setVerifyingOtp(false);
      return;
    }

    setSuccessMessage('Signed in successfully. Redirecting to technician workspace...');
    showToast('Signed in', 'Redirecting to technician workspace', 'success');
    setVerifyingOtp(false);
    await router.push('/technician');
  };

  return (
    <AuthLayout
      title={isTechnicianFlow ? 'Technician sign in' : 'Business login'}
      subtitle={
        isTechnicianFlow
          ? 'Sign in to access technician logbook and reports.'
          : 'Sign in to access your compliance dashboard.'
      }
    >
      <form
        className={`space-y-6 page-fade-in ${error ? 'field-shake' : ''}`}
        onSubmit={isTechnicianFlow ? verifyTechnicianCode : handleAdminSignIn}
      >
        <FormInput
          label="Email Address"
          id="email"
          type="email"
          value={resolvedEmail}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
        />
        {isTechnicianFlow ? (
          <>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="m-0">Technician login uses one-time passcode only. Password sign-in is disabled for technicians.</p>
              <p className="mt-2 mb-0">
                On this device you stay signed in until you choose sign out; you&apos;ll only need a new code when starting a fresh sign-in (new device or after signing out).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={sendTechnicianCode}
                disabled={sendingOtp || resendCountdown > 0}
                size="sm"
              >
                {sendingOtp
                  ? 'Sending code...'
                  : resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : otpSent
                  ? 'Resend code'
                  : 'Send code'}
              </Button>
            </div>
            <FormInput
              label="One-Time Code"
              id="otp-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter 6-digit code"
              required
            />
          </>
        ) : (
          <>
            <PasswordField
              label="Password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div className="flex justify-between items-center text-sm text-zinc-600">
              <Link href="/auth/forgot-password" className="font-semibold text-primary-600 hover:text-primary-700">
                Forgot password?
              </Link>
            </div>
          </>
        )}
        {error ? <div className="form-feedback form-feedback-error">{error}</div> : null}
        {successMessage ? <div className="form-feedback form-feedback-success">{successMessage}</div> : null}
        <div className="flex justify-center">
          <Button type="submit" disabled={loading || verifyingOtp || (isTechnicianFlow && !otpSent)} size="sm">
            {loading || verifyingOtp ? (
              <>
                <span className="spinner"></span>
                {isTechnicianFlow ? 'Verifying...' : 'Signing in...'}
              </>
            ) : isTechnicianFlow ? (
              'Verify Code'
            ) : (
              'Sign In'
            )}
          </Button>
        </div>
        <div className="text-center text-sm text-zinc-600">
          Don&apos;t have an account?{' '}
          <Link
            href={isTechnicianFlow ? '/auth/signup?role=technician' : '/auth/signup'}
            className="font-semibold text-primary-600 hover:text-primary-700"
          >
            Create account
          </Link>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-900">
          {isTechnicianFlow ? (
            <>
              Technician access: use the exact email your admin added in the Technicians tab.{' '}
              <Link href="/auth/signin?role=admin" className="font-semibold text-primary-700 hover:text-primary-800">
                Business login
              </Link>
            </>
          ) : (
            <>
              Need technician access?{' '}
              <Link href="/auth/signin?role=technician" className="font-semibold text-primary-700 hover:text-primary-800">
                Technician sign in
              </Link>
            </>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}

