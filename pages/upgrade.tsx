import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import { MARKETING_PLAN_FEATURES, PRICING_TRIAL_FOOTNOTE } from '../lib/marketingPlanFeatures';
import { ownerCanManagePaidPlanInStripe, hasOutstandingPaymentFailure } from '../lib/subscriptionAccess';

type Company = {
  id: string;
  name?: string;
  email: string;
  plan?: string | null;
};

type Subscription = {
  status: string;
  trialEndsAt?: string;
  stripeCustomerId?: string;
  plan?: string;
  subscriptionPeriodEndAt?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean;
  paymentFailedAt?: string | null;
};

export default function UpgradePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const isPreviewMode = process.env.NODE_ENV === 'development' && router.query.preview === '1';
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business' | 'enterprise' | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [trialEndsDate, setTrialEndsDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (isPreviewMode) {
        const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        setCompany({ id: 'preview-company', name: 'Pest Trace Preview Co.', email: 'owner@preview.local' });
        setSubscription({ status: 'trial', trialEndsAt: endDate.toISOString() });
        setTrialEndsDate(endDate);
        setTrialDaysLeft(7);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }
      const authUser = session.user as {
        email_confirmed_at?: string | null;
        confirmed_at?: string | null;
        email_confirmed?: boolean;
      };
      const userVerified = Boolean(authUser.email_confirmed_at ?? authUser.confirmed_at ?? authUser.email_confirmed);
      if (!userVerified) {
        router.push(`/auth/verify?email=${encodeURIComponent(session.user.email ?? '')}`);
        return;
      }

      const companyRes = await fetch('/api/company', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!companyRes.ok) {
        const companyError = await companyRes.json().catch(() => ({}));
        if (companyRes.status === 403 && companyError?.code === 'ROLE_TECHNICIAN') {
          router.replace('/technician?accessDenied=upgrade');
          return;
        }
      }
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        setCompany(companyData);
      }

      const subscriptionRes = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!subscriptionRes.ok) {
        router.push('/dashboard');
        return;
      }

      const subscriptionData = await subscriptionRes.json();
      setSubscription(subscriptionData);
      
      // Calculate trial days left safely (only once, after data loads)
      if (subscriptionData.trialEndsAt) {
        const endDate = new Date(subscriptionData.trialEndsAt);
        setTrialEndsDate(endDate);
        const now = new Date(); // safe inside useEffect
        const days = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        setTrialDaysLeft(days);
      }
      
      setLoading(false);
    };

    loadData();
  }, [isPreviewMode, router]);

  const handleSubscribe = async (plan: 'pro' | 'business' | 'enterprise') => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Checkout is disabled in preview mode.', 'info');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    setActionLoading(true);
    setSelectedPlan(plan);
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      showToast('Checkout failed', data.error || 'Unable to start checkout', 'error');
      setActionLoading(false);
      setSelectedPlan(null);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Billing portal is disabled in preview mode.', 'info');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    setActionLoading(true);
    const res = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ intent: 'payment_update' }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      const detail = [data.error, data.hint].filter(Boolean).join(' — ');
      showToast('Payment update failed', detail || 'Unable to open secure billing', 'error');
      setActionLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Billing portal is disabled in preview mode.', 'info');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    setActionLoading(true);
    const res = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ intent: 'manage' }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      const detail = [data.error, data.hint]
        .concat(
          Array.isArray(data.attemptedReturnHosts) && data.attemptedReturnHosts.length > 0
            ? [`Tried hosts: ${data.attemptedReturnHosts.join(', ')}`]
            : [],
        )
        .filter(Boolean)
        .join(' — ');
      showToast('Portal failed', detail || 'Unable to open Stripe portal', 'error');
      setActionLoading(false);
      setSelectedPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Billing portal is disabled in preview mode.', 'info');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    setActionLoading(true);
    const res = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ intent: 'cancel' }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      const detail = [data.error, data.hint]
        .concat(
          Array.isArray(data.attemptedReturnHosts) && data.attemptedReturnHosts.length > 0
            ? [`Tried hosts: ${data.attemptedReturnHosts.join(', ')}`]
            : [],
        )
        .filter(Boolean)
        .join(' — ');
      showToast('Cancel plan', detail || 'Unable to open Stripe billing', 'error');
      setActionLoading(false);
      setSelectedPlan(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-offwhite">Loading subscription details...</div>;
  }

  const canStripeBilling =
    !isPreviewMode &&
    ownerCanManagePaidPlanInStripe({
      plan: subscription?.plan ?? company?.plan,
      subscriptionStatus: subscription?.status,
      stripeCustomerId: subscription?.stripeCustomerId,
    });

  const paymentBlocked = Boolean(
    subscription &&
      hasOutstandingPaymentFailure({
        plan: subscription.plan ?? company?.plan,
        subscriptionStatus: subscription.status,
        paymentFailedAt: subscription.paymentFailedAt,
      }),
  );

  const cancelScheduled = Boolean(subscription?.subscriptionCancelAtPeriodEnd);
  const paidAccessEnds =
    subscription?.subscriptionPeriodEndAt && !Number.isNaN(new Date(subscription.subscriptionPeriodEndAt).getTime())
      ? new Date(subscription.subscriptionPeriodEndAt)
      : null;

  return (
    <div className="min-h-screen bg-offwhite px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl min-w-0 space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-navy mb-3">
            {paymentBlocked ? 'Payment required' : 'Upgrade to Pest Trace'}
          </h1>
          <div className="mx-auto h-1 w-20 bg-primary-500 rounded-full mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">
            {paymentBlocked
              ? 'Your last subscription payment failed. Pest Trace is locked until you add a valid card and pay the outstanding invoice in Stripe.'
              : 'Choose a plan for your team. Features match the lists below — trial limits apply until you subscribe.'}
          </p>
        </div>

        {paymentBlocked ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 sm:p-6">
            <p className="text-sm font-semibold text-red-900">Payment failed — access suspended</p>
            <p className="mt-2 text-sm text-red-800">
              Stripe could not charge your card (for example, an invalid card or account number). Update your payment
              method using Stripe&apos;s secure billing portal, then retry the invoice. Access restores automatically
              after payment succeeds.
            </p>
            <button
              type="button"
              onClick={handleUpdatePaymentMethod}
              disabled={actionLoading || !canStripeBilling}
              className="btn btn-primary mt-4 w-full sm:w-auto"
            >
              {actionLoading ? 'Opening secure billing…' : 'Update card & pay in Stripe'}
            </button>
          </div>
        ) : null}

        {/* Status Cards */}
        <div className="space-y-3">
          {company && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 hover-lift">
              <p className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wide">Company</p>
              <p className="mt-2 break-words text-lg font-semibold text-navy sm:text-xl">{company.name || company.email}</p>
            </div>
          )}

          {/* Subscription Status Card */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 hover-lift">
            <p className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wide">Subscription Status</p>
            <div className="mt-3 space-y-2">
              <p className="text-base sm:text-lg text-gray-800">
                Status: <span className="font-bold text-navy">{subscription?.status || 'None'}</span>
              </p>
              {cancelScheduled ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-semibold">Renewal cancelled</p>
                  <p className="mt-1">
                    Full plan access until{' '}
                    <strong>
                      {paidAccessEnds
                        ? paidAccessEnds.toLocaleDateString('en-GB', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'the end of your billing period'}
                    </strong>
                    . Then your account returns to free trial limits unless you subscribe again. Check your email for confirmation.
                  </p>
                </div>
              ) : null}
              {trialEndsDate && trialDaysLeft > 0 && (
                <div className="text-sm text-gray-600">
                  ✓ Access ends in <strong>{trialDaysLeft}</strong> day{trialDaysLeft === 1 ? '' : 's'} <span className="text-gray-500">({trialEndsDate.toLocaleDateString()})</span>
                  {trialDaysLeft <= 2 && (
                    <p className="mt-1 text-sm font-semibold text-orange-600">
                      ⏰ Access ending soon! Upgrade now to retain full Pest Trace access.
                    </p>
                  )}
                </div>
              )}
              {subscription?.status !== 'active' && trialEndsDate && trialDaysLeft <= 0 && (
                <p className="text-sm font-semibold text-red-600">
                  ⚠️ Access expired. Upgrade now to regain full Pest Trace access.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        {!paymentBlocked ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-navy">🟢 Pro</h2>
            <p className="mt-2 text-2xl font-bold text-primary-600">£25<span className="text-sm font-medium text-zinc-500">/month</span></p>
            <p className="mt-2 text-xs font-medium text-zinc-500">Startups & owner-operators scaling beyond a handful of jobs</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              {MARKETING_PLAN_FEATURES.pro.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe('pro')}
              disabled={actionLoading}
              className="btn btn-primary mt-6 w-full"
            >
              {actionLoading && selectedPlan === 'pro' ? 'Redirecting...' : 'Choose Pro'}
            </button>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-navy">🟢 Business</h2>
            <p className="mt-2 text-2xl font-bold text-primary-600">£50<span className="text-sm font-medium text-zinc-500">/month</span></p>
            <p className="mt-2 text-xs font-medium text-zinc-500">Growing teams that need revenue and performance visibility</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              {MARKETING_PLAN_FEATURES.business.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe('business')}
              disabled={actionLoading}
              className="btn btn-primary mt-6 w-full"
            >
              {actionLoading && selectedPlan === 'business' ? 'Redirecting...' : 'Choose Business'}
            </button>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm ring-1 ring-amber-100">
            <h2 className="text-xl font-bold text-navy">🔵 Enterprise</h2>
            <p className="mt-2 text-2xl font-bold text-primary-600">£100<span className="text-sm font-medium text-zinc-500">/month</span></p>
            <p className="mt-1 break-words text-xs text-zinc-500">Requires <code className="rounded bg-zinc-100 px-1">STRIPE_PRICE_ID_ENTERPRISE</code> in environment.</p>
            <p className="mt-2 text-xs font-medium text-zinc-500">Larger fleets, multi-site, and stricter governance</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              {MARKETING_PLAN_FEATURES.enterprise.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleSubscribe('enterprise')}
              disabled={actionLoading}
              className="btn btn-primary mt-6 w-full"
            >
              {actionLoading && selectedPlan === 'enterprise' ? 'Redirecting...' : 'Choose Enterprise'}
            </button>
          </div>
        </div>
        ) : null}

        {!paymentBlocked ? (
        <p className="text-center text-xs leading-relaxed text-zinc-500">{PRICING_TRIAL_FOOTNOTE}</p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
          {canStripeBilling ? (
            <>
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={actionLoading}
                className="btn btn-success w-full sm:w-auto hover:shadow-md hover-lift"
              >
                {actionLoading ? 'Opening portal...' : 'Manage subscription'}
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="btn btn-secondary w-full border-red-300 text-red-800 hover:bg-red-50 sm:w-auto hover:shadow-md hover-lift"
              >
                {actionLoading ? 'Opening…' : 'Cancel plan'}
              </button>
            </>
          ) : null}
          <button
            className="btn btn-secondary w-full sm:w-auto hover:shadow-md hover-lift"
            onClick={() => router.push(paymentBlocked ? '/upgrade' : '/dashboard')}
            disabled={paymentBlocked}
          >
            {paymentBlocked ? 'Dashboard locked' : 'Back to Dashboard'}
          </button>
          <button 
            className="btn btn-danger w-full sm:w-auto hover:shadow-md hover-lift" 
            onClick={async () => {
              if (!confirm('⚠️ PERMANENT account deletion!\\n\\nCancels subscription, deletes ALL data (jobs, photos, techs, certs, reports). Cannot be undone.\\n\\nAre you 100% sure?')) return;
              if (!confirm('FINAL WARNING: All data LOST FOREVER. Type DELETE to continue.')) return;
              if ((prompt('Type DELETE to confirm:') || '').toUpperCase() !== 'DELETE') return;
              
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/account/delete', {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${session?.access_token}` },
                });
                if (res.ok) {
                  showToast('Deleted', 'Account, data, and subscription permanently removed.', 'success');
                  router.push('/auth/signin');
                } else {
                  const err = await res.json();
                  showToast('Failed', err.error || 'Delete failed', 'error');
                }
              } catch {
                showToast('Error', 'Delete failed', 'error');
              }
            }}
          >
            🗑️ Delete Account & Cancel Sub
          </button>
        </div>
      </div>
    </div>
  );
}

