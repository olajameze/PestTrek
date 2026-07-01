import { useState } from 'react';
import { formatOwnerBillingPlanLabel, ownerCanManagePaidPlanInStripe } from '../../lib/subscriptionAccess';
import { getClientSupportEmail } from '../../lib/supportEmail';
import { ACCOUNT_DELETION_REASONS } from '../../lib/accountDeletionReasons';
import { supabase } from '../../lib/supabase';
import Card from '../ui/Card';
import Button from '../ui/Button';
import FormInput from '../ui/FormInput';
import WebPushSettings from '../push/WebPushSettings';

type NotificationPreferences = {
  trialExpiry: boolean;
  renewal: boolean;
  certificationExpiry: boolean;
  digestDaily?: boolean;
  digestWeekly?: boolean;
  business?: {
    jobCompleteEmailToOwner?: boolean;
    jobCompleteEmailToCustomer?: boolean;
  };
    enterprise?: {
    accountManager?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    branding?: {
      primaryColor?: string;
      footerText?: string;
      portalWelcomeText?: string;
      logoUrl?: string;
    };
    security?: {
      ipAllowlistEnabled?: boolean;
      allowedIps?: string[];
      requireVerifiedEmail?: boolean;
    };
  };
};

type Company = {
  id: string;
  name?: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  vatNumber?: string | null;
  /** ISO 3166-1 alpha-2 country code — authoritative locale source for all technicians. */
  country?: string | null;
  requireSignature: boolean;
  requirePhotos: boolean;
  defaultReportRangeDays?: number | null;
  notificationPreferences?: Partial<NotificationPreferences> | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
};

type Subscription = {
  status: string;
  trialEndsAt?: string;
  plan?: string;
  stripeCustomerId?: string;
  subscriptionPeriodEndAt?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean;
};

interface SettingsTabProps {
  company: Company;
  subscription: Subscription | null;
  onSubscribe: () => void;
  onManageSubscription: () => void;
  onUpdateCompanySettings: (settings: {
    name: string;
    phone?: string;
    address?: string;
    website?: string;
    vatNumber?: string;
    country?: string;
    requireSignature: boolean;
    requirePhotos: boolean;
    defaultReportRangeDays: number;
    notificationPreferences: NotificationPreferences;
  }) => Promise<void>;
  savingSettings: boolean;
  checkoutLoading: boolean;
  portalLoading: boolean;
  onCancelSubscription: () => Promise<void>;
  showToast: (title: string, message: string, variant?: 'success' | 'error' | 'info') => void;
  onAccountDeleted: () => Promise<void>;
  previewMode?: boolean;
}

export default function SettingsTab({
  company,
  subscription,
  onSubscribe,
  onManageSubscription,
  onUpdateCompanySettings,
  savingSettings,
  checkoutLoading,
  portalLoading,
  onCancelSubscription,
  showToast,
  onAccountDeleted,
  previewMode = false,
}: SettingsTabProps) {
  const supportAddr = getClientSupportEmail();
  const [companyName, setCompanyName] = useState(company.name || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [address, setAddress] = useState(company.address || '');
  const [website, setWebsite] = useState(company.website || '');
  const [vatNumber, setVatNumber] = useState(company.vatNumber || '');
  const [country, setCountry] = useState(company.country || '');
  const [requireSignature, setRequireSignature] = useState(company.requireSignature ?? false);
  const [requirePhotos, setRequirePhotos] = useState(company.requirePhotos ?? false);
  const [defaultReportRangeDays, setDefaultReportRangeDays] = useState(company.defaultReportRangeDays ?? 30);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    trialExpiry: company.notificationPreferences?.trialExpiry ?? true,
    renewal: company.notificationPreferences?.renewal ?? true,
    certificationExpiry: company.notificationPreferences?.certificationExpiry ?? true,
    digestDaily: company.notificationPreferences?.digestDaily ?? false,
    digestWeekly: company.notificationPreferences?.digestWeekly ?? true,
  });
  const [jobCompleteEmailToOwner, setJobCompleteEmailToOwner] = useState(
    company.notificationPreferences?.business?.jobCompleteEmailToOwner ?? true,
  );
  const [jobCompleteEmailToCustomer, setJobCompleteEmailToCustomer] = useState(
    company.notificationPreferences?.business?.jobCompleteEmailToCustomer ?? false,
  );
  const [accountManagerName, setAccountManagerName] = useState(
    company.notificationPreferences?.enterprise?.accountManager?.name || '',
  );
  const [accountManagerEmail, setAccountManagerEmail] = useState(
    company.notificationPreferences?.enterprise?.accountManager?.email || supportAddr,
  );
  const [accountManagerPhone, setAccountManagerPhone] = useState(
    company.notificationPreferences?.enterprise?.accountManager?.phone || '',
  );
  const [ipAllowlistEnabled, setIpAllowlistEnabled] = useState(
    company.notificationPreferences?.enterprise?.security?.ipAllowlistEnabled ?? false,
  );
  const [allowedIpsText, setAllowedIpsText] = useState(
    (company.notificationPreferences?.enterprise?.security?.allowedIps || []).join('\n'),
  );
  const [requireVerifiedEmail, setRequireVerifiedEmail] = useState(
    company.notificationPreferences?.enterprise?.security?.requireVerifiedEmail ?? true,
  );
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(
    company.notificationPreferences?.enterprise?.branding?.primaryColor ?? '#2563EB',
  );
  const [brandFooterText, setBrandFooterText] = useState(
    company.notificationPreferences?.enterprise?.branding?.footerText ?? '',
  );
  const [portalWelcomeText, setPortalWelcomeText] = useState(
    company.notificationPreferences?.enterprise?.branding?.portalWelcomeText ?? '',
  );

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteComment, setDeleteComment] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const confirmDeleteAccount = async () => {
    if (previewMode) {
      showToast('Preview mode', 'Account deletion is disabled in preview mode.', 'info');
      return;
    }
    if (!deleteReason) {
      showToast('Missing reason', 'Please select why you are leaving.', 'error');
      return;
    }
    if (deleteReason === 'Other (please specify)' && deleteComment.trim().length < 3) {
      showToast('More detail needed', 'Please add a short note for Other.', 'error');
      return;
    }
    setDeletingAccount(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      showToast('Session expired', 'Sign in again and retry.', 'error');
      setDeletingAccount(false);
      return;
    }
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: deleteReason,
        comment: deleteComment.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(
        'Delete failed',
        typeof data.error === 'string' ? data.error : 'Unable to delete account, contact support',
        'error',
      );
      setDeletingAccount(false);
      return;
    }
    setDeleteModalOpen(false);
    await onAccountDeleted();
    setDeletingAccount(false);
  };

  const handleSaveSettings = () => {
    const allowedIps = allowedIpsText
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    onUpdateCompanySettings({
      name: companyName.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      website: website.trim() || undefined,
      vatNumber: vatNumber.trim() || undefined,
      country: country.trim() || undefined,
      requireSignature,
      requirePhotos,
      defaultReportRangeDays,
      notificationPreferences: {
        ...notificationPreferences,
        business: {
          jobCompleteEmailToOwner,
          jobCompleteEmailToCustomer,
        },
        enterprise: {
          accountManager: {
            name: accountManagerName.trim(),
            email: accountManagerEmail.trim() || supportAddr,
            phone: accountManagerPhone.trim(),
          },
          security: {
            ipAllowlistEnabled,
            allowedIps,
            requireVerifiedEmail,
          },
          branding: {
            primaryColor: brandPrimaryColor.trim() || '#2563EB',
            footerText: brandFooterText.trim(),
            portalWelcomeText: portalWelcomeText.trim(),
            logoUrl: company.notificationPreferences?.enterprise?.branding?.logoUrl ?? '',
          },
        },
      },
    });
  };

  const currentPlanLabel = formatOwnerBillingPlanLabel({
    plan: subscription?.plan ?? company.plan,
    subscriptionStatus: subscription?.status ?? company.subscriptionStatus,
  }).toUpperCase();
  const trialEndsAtLabel = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString() : 'Not available';
  const cancelScheduled = Boolean(subscription?.subscriptionCancelAtPeriodEnd);
  const paidAccessEnds =
    subscription?.subscriptionPeriodEndAt && !Number.isNaN(new Date(subscription.subscriptionPeriodEndAt).getTime())
      ? new Date(subscription.subscriptionPeriodEndAt)
      : null;

  const canUseStripeBilling = ownerCanManagePaidPlanInStripe({
    plan: subscription?.plan ?? company.plan,
    subscriptionStatus: subscription?.status ?? company.subscriptionStatus,
    stripeCustomerId: subscription?.stripeCustomerId,
  });

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy sm:text-3xl">Settings</h2>
            <p className="mt-2 text-sm text-slate-600">
              Manage company profile, compliance defaults, notifications, and billing controls.
            </p>
          </div>
          <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
            Plan: {currentPlanLabel}
          </div>
        </div>
      </div>
      {cancelScheduled ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-950">Subscription renewal cancelled</p>
          <p className="mt-2 leading-relaxed">
            You still have full access to your <span className="font-semibold">{currentPlanLabel}</span> features until{' '}
            <span className="font-semibold">
              {paidAccessEnds
                ? paidAccessEnds.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                : 'the end of your current billing period'}
            </span>
            . After that, your account moves back to{' '}
            <span className="font-semibold">free trial</span> limits (same as when a trial has ended) unless you subscribe again.
          </p>
          <p className="mt-2 text-xs text-amber-900/90">
            We&apos;ve emailed your billing address with these details. You can reactivate or update payment details in the Stripe portal anytime.
          </p>
        </div>
      ) : null}
      <Card className="space-y-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-navy sm:text-xl">Company profile</h3>
          <p className="mt-1 text-sm text-slate-600">Keep your billing and business details up to date.</p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            label="Company Name"
            id="settings-company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <FormInput
            label="Billing Email"
            id="settings-billing-email"
            type="email"
            value={company.email}
            onChange={() => {}}
            readOnly
          />
          <FormInput
            label="Phone"
            id="settings-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <FormInput
            label="Website"
            id="settings-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
          />
          <FormInput
            label="Address"
            id="settings-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <FormInput
            label="VAT Number"
            id="settings-vat-number"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
          />
          <div className="form-group">
            <label htmlFor="settings-country" className="form-label">
              Country
            </label>
            <select
              id="settings-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="form-select w-full"
            >
              <option value="">Not set (auto-detect from browser)</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="IN">India</option>
              <option value="FR">France</option>
              <option value="DE">Germany</option>
              <option value="ES">Spain</option>
              <option value="IT">Italy</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Setting this ensures your technicians always see the correct postcode / PIN / ZIP field
              regardless of their browser language settings.
            </p>
          </div>
          <FormInput
            label="Default report range (days)"
            id="settings-default-report-range"
            type="number"
            value={String(defaultReportRangeDays)}
            onChange={(e) => setDefaultReportRangeDays(Number(e.target.value) || 0)}
          />
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Compliance defaults</p>
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireSignature}
                  onChange={(e) => setRequireSignature(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Require signature on reports</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requirePhotos}
                  onChange={(e) => setRequirePhotos(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Require photos on reports</span>
              </label>
            </div>
          </div>
        </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-lg font-semibold text-navy">Notification preferences</h4>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Delivery controls
            </span>
          </div>
          <div className="grid gap-4 mt-4 sm:grid-cols-2">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow">
              <input
                type="checkbox"
                checked={notificationPreferences.trialExpiry}
                onChange={(e) => setNotificationPreferences((prev) => ({ ...prev, trialExpiry: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Trial expiry reminders</span>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow">
              <input
                type="checkbox"
                checked={notificationPreferences.renewal}
                onChange={(e) => setNotificationPreferences((prev) => ({ ...prev, renewal: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Subscription renewal alerts</span>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow">
              <input
                type="checkbox"
                checked={notificationPreferences.certificationExpiry}
                onChange={(e) => setNotificationPreferences((prev) => ({ ...prev, certificationExpiry: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Certification expiry warnings</span>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow">
              <input
                type="checkbox"
                checked={Boolean(notificationPreferences.digestDaily)}
                onChange={(e) => setNotificationPreferences((prev) => ({ ...prev, digestDaily: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Daily digest email</span>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow">
              <input
                type="checkbox"
                checked={Boolean(notificationPreferences.digestWeekly)}
                onChange={(e) => setNotificationPreferences((prev) => ({ ...prev, digestWeekly: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Weekly digest email</span>
            </label>
          </div>
          {(subscription?.plan === 'business' || subscription?.plan === 'enterprise') ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <input type="checkbox" checked={jobCompleteEmailToOwner} onChange={(e) => setJobCompleteEmailToOwner(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-primary-600" />
                <span className="text-sm text-slate-700">Email me when a job is completed</span>
              </label>
              <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <input type="checkbox" checked={jobCompleteEmailToCustomer} onChange={(e) => setJobCompleteEmailToCustomer(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-primary-600" />
                <span className="text-sm text-slate-700">Email customer when job is completed</span>
              </label>
            </div>
          ) : null}
          <WebPushSettings />
        </section>

        {subscription?.plan === 'enterprise' ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <h4 className="text-lg font-semibold text-navy">Enterprise success & security</h4>
            <p className="mt-2 text-sm text-slate-600">
              Configure your dedicated account manager contact and security/compliance controls.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormInput
                label="Account Manager Name"
                id="settings-account-manager-name"
                value={accountManagerName}
                onChange={(e) => setAccountManagerName(e.target.value)}
                placeholder="Jane Smith"
              />
              <FormInput
                label="Account Manager Email"
                id="settings-account-manager-email"
                type="email"
                value={accountManagerEmail}
                onChange={(e) => setAccountManagerEmail(e.target.value)}
                placeholder={supportAddr}
              />
              <FormInput
                label="Account Manager Phone"
                id="settings-account-manager-phone"
                type="tel"
                value={accountManagerPhone}
                onChange={(e) => setAccountManagerPhone(e.target.value)}
                placeholder="+44 0000 000000"
              />
              <FormInput
                label="Report primary colour (hex)"
                id="settings-brand-color"
                value={brandPrimaryColor}
                onChange={(e) => setBrandPrimaryColor(e.target.value)}
                placeholder="#2563EB"
              />
              <FormInput
                label="Report footer text"
                id="settings-brand-footer"
                value={brandFooterText}
                onChange={(e) => setBrandFooterText(e.target.value)}
                placeholder="Thank you for choosing us"
              />
              <FormInput
                label="Client portal welcome text"
                id="settings-portal-welcome"
                value={portalWelcomeText}
                onChange={(e) => setPortalWelcomeText(e.target.value)}
                placeholder="View your service history"
              />
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Advanced security</p>
                <div className="mt-3 space-y-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={requireVerifiedEmail}
                      onChange={(e) => setRequireVerifiedEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">Require verified owner email on sensitive APIs</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ipAllowlistEnabled}
                      onChange={(e) => setIpAllowlistEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">Enable IP allowlist</span>
                  </label>
                </div>
              </div>
            </div>
            <label htmlFor="settings-allowed-ips" className="mt-4 block text-sm font-medium text-slate-700">
              Allowed IP addresses (one per line)
            </label>
            <textarea
              id="settings-allowed-ips"
              value={allowedIpsText}
              onChange={(e) => setAllowedIpsText(e.target.value)}
              placeholder={'203.0.113.10\n198.51.100.42'}
              className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-slate-800"
              rows={4}
            />
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Dedicated account representative</p>
              <p className="mt-2">
                {accountManagerName.trim()
                  ? `${accountManagerName.trim()} is your primary enterprise contact after you save.`
                  : 'Enterprise customers have a dedicated account representative.'}
              </p>
              <p className="mt-1">
                Contact:{' '}
                <a
                  href={`mailto:${(accountManagerEmail.trim() || supportAddr)}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {accountManagerEmail.trim() || supportAddr}
                </a>
              </p>
              {accountManagerPhone.trim() ? <p className="mt-1">Phone: {accountManagerPhone.trim()}</p> : null}
            </div>
          </section>
        ) : null}

        <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSaveSettings} disabled={savingSettings} className="min-w-[170px]">
            {savingSettings ? 'Saving settings...' : 'Save settings'}
          </Button>
          <span className="text-sm text-slate-500">Your changes will apply immediately to company account settings.</span>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Subscription status</p>
            <p className="mt-2 font-semibold text-slate-900">{subscription?.status || 'Unknown'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current plan</p>
            <p className="mt-2 font-semibold text-slate-900">{currentPlanLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Trial ends</p>
            <p className="mt-2 font-semibold text-slate-900">{trialEndsAtLabel}</p>
          </div>
        </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <p className="text-sm text-slate-600">
            Manage payment method, invoices, or cancel in Stripe. Cancelling stops renewal; access continues until the end of your billing period unless you delete your account immediately.
          </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button onClick={onSubscribe} disabled={checkoutLoading} className="w-full whitespace-normal bg-gradient-to-r from-blue-500 to-purple-600 sm:w-auto">
            {checkoutLoading ? 'Loading...' : 'Choose Plan & Upgrade'}
          </Button>
          {canUseStripeBilling && (
            <>
              <Button
                onClick={onManageSubscription}
                disabled={portalLoading}
                className="w-full whitespace-normal sm:w-auto"
              >
                {portalLoading ? 'Opening…' : 'Manage subscription'}
              </Button>
              <Button
                variant="secondary"
                onClick={onCancelSubscription}
                disabled={portalLoading}
                className="w-full border-red-300 whitespace-normal text-red-800 hover:bg-red-50 sm:w-auto"
              >
                {portalLoading ? 'Opening…' : 'Cancel plan'}
              </Button>
            </>
          )}
        </div>
        </section>

        <section className="rounded-2xl border border-red-200 bg-red-50/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-900">Delete account</p>
              <p className="text-sm text-red-700">
                Permanently delete this account, cancel Stripe subscriptions, and remove all company data from Pest Trace.
              </p>
            </div>
            <Button variant="danger" onClick={() => setDeleteModalOpen(true)} disabled={deletingAccount}>
              Delete account
            </Button>
          </div>
        </section>
      </Card>

      {deleteModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !deletingAccount && setDeleteModalOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !deletingAccount) setDeleteModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            data-testid="delete-account-modal"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-account-title" className="text-xl font-bold text-red-950">
              Delete account
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Why are you leaving? This helps us prioritise compliance improvements.
            </p>
            <div className="mt-4 space-y-3">
              {ACCOUNT_DELETION_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="delete-reason"
                    className="mt-1"
                    checked={deleteReason === r}
                    onChange={() => setDeleteReason(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            <label htmlFor="delete-comment" className="mt-4 block text-sm font-medium text-slate-700">
              Additional comments <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="delete-comment"
              data-testid="delete-account-comment"
              value={deleteComment}
              onChange={(e) => setDeleteComment(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="Anything specific we should know?"
            />
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={deletingAccount}
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={deletingAccount || !deleteReason}
                onClick={() => void confirmDeleteAccount()}
              >
                {deletingAccount ? 'Deleting…' : 'Confirm delete'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
