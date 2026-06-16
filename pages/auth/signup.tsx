import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/router';
import AuthLayout from '../../components/layouts/AuthLayout';
import FormInput from '../../components/ui/FormInput';
import PasswordField from '../../components/ui/PasswordField';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';
import { authCallbackUrl } from '../../lib/authRedirect';

export type SignUpPageProps = {
  initialRole: 'admin' | 'technician';
  initialInviteEmail: string;
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export const getServerSideProps: GetServerSideProps<SignUpPageProps> = async (context) => {
  const roleParam = firstQueryValue(context.query.role);
  const initialRole: SignUpPageProps['initialRole'] = roleParam === 'technician' ? 'technician' : 'admin';

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

export default function SignUp({ initialRole, initialInviteEmail }: SignUpPageProps) {
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [pendingAdminVerification, setPendingAdminVerification] = useState(false);
  const [adminOtpCode, setAdminOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();
  const { showToast } = useToast();
  const otpCooldownRaw = Number(process.env.NEXT_PUBLIC_OTP_RESEND_COOLDOWN_SECONDS ?? '30');
  const otpCooldownSeconds = Number.isFinite(otpCooldownRaw) && otpCooldownRaw > 0 ? otpCooldownRaw : 30;
  const roleFromRouter =
    router.isReady && typeof router.query.role === 'string' ? router.query.role : undefined;
  const role =
    roleFromRouter === 'technician' || (roleFromRouter === undefined && initialRole === 'technician')
      ? 'technician'
      : 'admin';
  const isTechnicianSignup = role === 'technician';
  const emailFromRouter =
    router.isReady && typeof router.query.email === 'string'
      ? decodeURIComponent(router.query.email)
      : undefined;
  const prefilledInviteEmail =
    emailFromRouter !== undefined ? emailFromRouter : initialInviteEmail;
  const resolvedEmail = isTechnicianSignup && prefilledInviteEmail ? prefilledInviteEmail : email;

  useEffect(() => {
    if (!router.isReady || !isTechnicianSignup || !prefilledInviteEmail) return;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.email) return;
      const sessionEmail = session.user.email.trim().toLowerCase();
      const inviteEmail = prefilledInviteEmail.trim().toLowerCase();
      if (sessionEmail === inviteEmail) return;
      void supabase.auth.signOut();
    });
  }, [router.isReady, isTechnicianSignup, prefilledInviteEmail]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCountdown]);

  const sendAdminSignupOtp = async (targetEmail: string) => {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    if (!normalizedEmail) return 'Enter a valid email address.';

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authCallbackUrl(window.location.origin, '/dashboard'),
      },
    });

    if (otpError) {
      return otpError.message;
    }

    setResendCountdown(otpCooldownSeconds);
    return null;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!isTechnicianSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!isTechnicianSignup && password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    if (isTechnicianSignup) {
      const createRes = await fetch('/api/auth/technician-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resolvedEmail,
          fullName,
        }),
      });
      const createData = (await createRes.json().catch(() => ({}))) as { error?: string };
      if (!createRes.ok) {
        const message = createData.error || 'Unable to create technician account.';
        setError(message);
        showToast('Sign up failed', message, 'error');
        setLoading(false);
        return;
      }

      setSuccessMessage('Technician account created. Continue with one-time code sign-in.');
      showToast('Account created', 'Use OTP sign-in to access your technician workspace.', 'success');
      setLoading(false);
      await router.push(`/auth/signin?role=technician&email=${encodeURIComponent(resolvedEmail)}`);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: resolvedEmail,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(window.location.origin, '/dashboard'),
        data: {
          role: 'admin',
          businessName,
          fullName,
        },
      },
    });
    if (error) {
      setError(error.message);
      showToast('Sign up failed', error.message, 'error');
    } else {
      const otpErrorMessage = await sendAdminSignupOtp(resolvedEmail);
      setPendingAdminVerification(true);
      if (otpErrorMessage) {
        setSuccessMessage('Account created. Send a one-time code below to complete registration.');
        setError(otpErrorMessage);
        showToast('Account created', 'Send your OTP code to finish registration.', 'info');
      } else {
        setSuccessMessage('Account created. Enter the one-time code from your email to complete registration.');
        showToast('Code sent', 'Enter the OTP to finish business registration.', 'success');
      }
    }
    setLoading(false);
  };

  const handleResendAdminOtp = async () => {
    const normalizedEmail = resolvedEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email first.');
      return;
    }

    setSendingOtp(true);
    setError('');
    const otpErrorMessage = await sendAdminSignupOtp(normalizedEmail);
    if (otpErrorMessage) {
      setError(otpErrorMessage);
      showToast('Resend failed', otpErrorMessage, 'error');
      setSendingOtp(false);
      return;
    }
    setSuccessMessage('A new one-time code was sent. Enter it below to complete registration.');
    showToast('Code resent', 'Check your email for the new OTP code.', 'success');
    setSendingOtp(false);
  };

  const verifyAdminSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = resolvedEmail.trim().toLowerCase();
    if (!normalizedEmail || !adminOtpCode.trim()) {
      setError('Enter both your email and one-time code.');
      return;
    }

    setVerifyingOtp(true);
    setError('');
    setSuccessMessage('');

    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: adminOtpCode.trim(),
      type: 'email',
    });

    if (otpError || !data.session) {
      const message = otpError?.message || 'Invalid or expired one-time code.';
      setError(message);
      showToast('Verification failed', message, 'error');
      setVerifyingOtp(false);
      return;
    }

    try {
      await fetch('/api/auth/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ email: normalizedEmail, fullName, businessName }),
      });
    } catch (sendError) {
      console.error('Welcome email failed', sendError);
    }

    setPendingAdminVerification(false);
    setVerifyingOtp(false);
    showToast('Registration complete', 'Redirecting to your dashboard.', 'success');
    await router.push('/dashboard');
  };

  return (
    <AuthLayout
      title={isTechnicianSignup ? 'Create technician account' : 'Create your account'}
      subtitle={
        isTechnicianSignup
          ? 'Use the same email your admin added in the Technicians tab.'
          : 'Add a card to start your 7-day Pro trial. You won\'t be charged until the trial ends.'
      }
    >
      {isTechnicianSignup ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Technician sign-up: your account email must match an existing technician record from your admin dashboard.
        </div>
      ) : null}
      {isTechnicianSignup && prefilledInviteEmail ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Invite detected. Your technician email is pre-filled below.
        </div>
      ) : null}
      <form
        className={`space-y-4 page-fade-in ${error ? 'field-shake' : ''}`}
        onSubmit={pendingAdminVerification ? verifyAdminSignupOtp : handleSignUp}
      >
        {!isTechnicianSignup ? (
          <FormInput
            label="Business Name"
            id="business-name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="ABC Pest Control Ltd"
            readOnly={pendingAdminVerification}
            required
          />
        ) : null}
        <FormInput
          label={isTechnicianSignup ? 'Technician Full Name' : 'Your Full Name'}
          id="full-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="John Smith"
          readOnly={!isTechnicianSignup && pendingAdminVerification}
          required
        />
        <FormInput
          label="Email Address"
          id="email"
          type="email"
          value={resolvedEmail}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          readOnly={(isTechnicianSignup && Boolean(prefilledInviteEmail)) || (!isTechnicianSignup && pendingAdminVerification)}
          required
        />
        {!isTechnicianSignup ? (
          <>
            <PasswordField
              label="Password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <PasswordField
              label="Confirm Password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />
          </>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Technicians do not set a password. After signup, you will sign in using one-time code.
          </div>
        )}
        {!isTechnicianSignup && pendingAdminVerification ? (
          <>
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
              Registration step 2 of 2: enter the one-time code sent to your email to complete business signup.
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleResendAdminOtp}
                disabled={sendingOtp || resendCountdown > 0}
              >
                {sendingOtp
                  ? 'Sending code...'
                  : resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : 'Resend code'}
              </Button>
            </div>
            <FormInput
              label="One-Time Code"
              id="admin-signup-otp"
              value={adminOtpCode}
              onChange={(e) => setAdminOtpCode(e.target.value)}
              placeholder="Enter 6-digit code"
              required
            />
          </>
        ) : null}
        {error ? <div className="form-feedback form-feedback-error">{error}</div> : null}
        {successMessage ? <div className="form-feedback form-feedback-success">{successMessage}</div> : null}
        <div className="flex justify-center">
          <Button type="submit" disabled={loading || verifyingOtp} size="sm">
            {loading ? 'Creating account...' : verifyingOtp ? 'Verifying code...' : pendingAdminVerification ? 'Verify Code' : 'Create Account'}
          </Button>
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-zinc-500">
        By creating an account, you agree to our Terms of Service and Privacy Policy.
      </p>
      <p className="mt-4 text-center text-sm text-zinc-600">
        Already have an account?{' '}
        <Link
          href={isTechnicianSignup ? '/auth/signin?role=technician' : '/auth/signin'}
          className="font-semibold text-primary-600 hover:text-primary-700"
        >
          Sign in
        </Link>
      </p>
      {!isTechnicianSignup ? (
        <p className="mt-2 text-center text-sm text-zinc-600">
          Joining as field staff?{' '}
          <Link href="/auth/signup?role=technician" className="font-semibold text-primary-600 hover:text-primary-700">
            Sign up as Technician
          </Link>
        </p>
      ) : (
        <p className="mt-2 text-center text-sm text-zinc-600">
          Creating an owner/admin account?{' '}
          <Link href="/auth/signup?role=admin" className="font-semibold text-primary-600 hover:text-primary-700">
            Switch to Business Sign-up
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}