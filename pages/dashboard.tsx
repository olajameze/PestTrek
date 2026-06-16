import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import Sidebar from '../components/sidebar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FormInput from '../components/ui/FormInput';
import SettingsTab from '../components/settings/SettingsTab';
import { useToast } from '../components/ui/ToastProvider';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Skeleton } from '../components/ui/Skeleton';
import { checkPlan } from '../lib/planGuard';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import {
  formatOwnerBillingPlanLabel,
  getGraceDaysLeft,
  hasSubscriptionAccess,
  needsSignupCheckout,
} from '../lib/subscriptionAccess';
import { formatTechnicianLimit, getTechnicianLimit } from '../lib/planLimits';
import { canUseEnterprisePreview, trialFullDaysRemaining } from '../lib/trialEnterprisePreview';
import {
  getTrialNoticeLevel,
  trialNoticeMessage,
  trialNoticeModalTitle,
  TRIAL_NOTICE_SESSION_KEY,
  type TrialNoticeLevel,
} from '../lib/trial/trialNoticeThresholds';
import { parseApiBody } from '../lib/api/parseApiBody';
import { startSignupCheckout, formatTrialChargeDate } from '../lib/stripe/signupCheckout';
import { usePermissions } from '../hooks/usePermissions';
import { isCompanyOwnerSession } from '../lib/auth/resolveWorkspaceRoute';

const DashboardEnhancements = dynamic(() => import('../components/dashboard/DashboardEnhancements'));
const OnboardingChecklist = dynamic(() => import('../components/dashboard/OnboardingChecklist'));
const TrialFeedbackModal = dynamic(() => import('../components/dashboard/TrialFeedbackModal'));
const OnboardingTour = dynamic(() => import('../components/onboarding/OnboardingTour'), { ssr: false });

interface User {
  id: string;
  email?: string;
}

interface Company {
  id: string;
  name?: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  vatNumber?: string | null;
  country?: string | null;
  requireSignature: boolean;
  requirePhotos: boolean;
  defaultReportRangeDays?: number | null;
  notificationPreferences?: {
    trialExpiry?: boolean;
    renewal?: boolean;
    certificationExpiry?: boolean;
    enterprise?: {
      accountManager?: {
        name?: string;
        email?: string;
        phone?: string;
      };
      security?: {
        ipAllowlistEnabled?: boolean;
        allowedIps?: string[];
        requireVerifiedEmail?: boolean;
      };
    };
  } | null;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  plan?: string;
}

interface Technician {
  id: string;
  name: string;
  email: string;
}

interface Subscription {
  status: string;
  trialEndsAt?: string;
  paymentGraceEndsAt?: string;
  stripeCustomerId?: string;
  plan?: string;
  subscriptionPeriodEndAt?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean;
}

interface BaitStationForm {
  stationId: string;
  location: string;
  baitType?: string;
  amount?: string;
}

interface LogbookEntry {
  id: string;
  date: string;
  clientName: string;
  address: string;
  treatment: string;
  notes?: string;
  photoUrl?: string;
  photoUrls?: string[];
  photos?: { url: string }[];
  signature?: string;
  rooms?: Array<string | { name: string; note?: string }>;
  baitBoxesPlaced?: string;
  poisonUsed?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  logbookEntryTechnicians?: { technician: { name: string } }[];
  followUpDate?: string;
  internalNotes?: string;
  productAmount?: string;
  recommendation?: string;
  baitStations?: BaitStationForm[];
  price?: number;
}

function isRenderableImageSrc(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('/')
  );
}

function parsePhotoUrls(photoUrl?: string, photoUrls?: string[], photos?: { url: string }[]): string[] {
  if (Array.isArray(photos) && photos.length > 0) {
    return photos.map((photo) => photo.url).filter((url) => Boolean(url) && isRenderableImageSrc(url)).slice(0, 4);
  }
  if (Array.isArray(photoUrls) && photoUrls.length > 0) {
    return photoUrls.filter((url) => isRenderableImageSrc(url)).slice(0, 4);
  }
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string' && isRenderableImageSrc(value)).slice(0, 4);
    }
  } catch {
    // Not JSON; treat as single URL.
  }
  return isRenderableImageSrc(photoUrl) ? [photoUrl] : [];
}

function supabaseImageLoader({ src }: { src: string }): string {
  return src;
}

function renderRoomDetails(rooms?: Array<string | { name: string; note?: string }>) {
  if (!rooms?.length) return null;
  return (
    <div className="mt-4 grid gap-3">
      {rooms.map((room, index) => {
        const name = typeof room === 'string' ? room : room.name;
        const note = typeof room === 'string' ? '' : room.note;
        return (
          <div key={`room-${index}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-semibold text-navy">{name}</p>
            {note ? <p className="mt-1 text-sm text-zinc-600 whitespace-pre-line">{note}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

type Tab = 'technicians' | 'logbook' | 'settings';

// ========== PlanModal Component ==========
const PlanModal = ({
  onClose,
  onSubscribe,
}: {
  onClose: () => void;
  onSubscribe: (plan: 'pro' | 'business' | 'enterprise') => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
    onClick={onClose}
    onKeyDown={(event) => {
      if (event.key === 'Escape') onClose();
    }}
    tabIndex={-1}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
      className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
        <h2 id="plan-modal-title" className="text-xl font-bold text-navy sm:text-2xl">Choose Your Plan</h2>
        <Button size="sm" variant="secondary" onClick={onClose} className="px-3 py-2" ariaLabel="Close plan selector">
          ✕
        </Button>
      </div>
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        {/* Pro */}
        <div className="flex h-full flex-col rounded-xl border-2 border-blue-200 p-6 transition-all hover:border-blue-300 hover:shadow-lg">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-semibold text-blue-700">Recommended</span>
          </div>
          <h3 className="text-xl font-bold text-navy mb-2">Pro</h3>
          <div className="text-3xl font-bold text-primary-600 mb-4">£25<span className="text-xl">/month</span></div>
          <ul className="mb-6 space-y-2 text-sm text-zinc-600">
            <li>• Unlimited logbook entries</li>
            <li>• PDF compliance reports</li>
            <li>• Technician certifications</li>
            <li>• PWA offline mode</li>
          </ul>
          <Button
            onClick={() => {
              onClose();
              onSubscribe('pro');
            }}
            className="mt-auto w-full whitespace-normal text-center leading-tight"
          >
            Choose Pro (£25/mo)
          </Button>
        </div>
        {/* Business */}
        <div className="flex h-full flex-col rounded-xl border-2 border-gray-200 p-6 transition-all hover:border-gray-300 hover:shadow-lg">
          <h3 className="text-xl font-bold text-navy mb-2">Business</h3>
          <div className="text-3xl font-bold text-primary-600 mb-4">£50<span className="text-xl">/month</span></div>
          <ul className="mb-6 space-y-2 text-sm text-zinc-600">
            <li>• Everything in Pro</li>
            <li>• Multi-company support</li>
            <li>• Advanced reporting</li>
            <li>• API access</li>
            <li>• Priority support</li>
            <li>• Customer Lifetime Value (CLV) tracking with CLV/CAC ratio</li>
          </ul>
          <Button
            onClick={() => {
              onClose();
              onSubscribe('business');
            }}
            className="mt-auto w-full whitespace-normal text-center leading-tight"
          >
            Choose Business (£50/mo)
          </Button>
        </div>
        {/* Enterprise */}
        <div className="flex h-full flex-col rounded-xl border-2 border-amber-200 p-6 transition-all hover:border-amber-300 hover:shadow-lg">
          <h3 className="text-xl font-bold text-navy mb-2">Enterprise</h3>
          <div className="mb-4 text-3xl font-bold text-primary-600">£100<span className="text-xl">/month</span></div>
          <ul className="mb-6 space-y-2 text-sm text-zinc-600">
            <li>• Customer Lifetime Value (CLV) tracking with CLV/CAC ratio</li>
            <li>• Retention &amp; Churn analytics (Retention Rate + cancellation reasons)</li>
            <li>• Customer Satisfaction (CSAT) &amp; Net Promoter Score (NPS) with trend analysis</li>
            <li>• All Business capabilities plus bespoke integrations</li>
          </ul>
          <Button
            onClick={() => {
              onClose();
              onSubscribe('enterprise');
            }}
            className="mt-auto w-full whitespace-normal text-center leading-tight"
          >
            Choose Enterprise (£100/mo)
          </Button>
        </div>
      </div>
      <div className="text-center text-sm text-zinc-500 mb-4">Your subscription starts immediately.</div>
      <div className="flex gap-3 justify-center">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  </div>
);

// ========== Dashboard Component ==========

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoadState, setCompanyLoadState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [refreshKey, setRefreshKey] = useState(0);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [activeTab, setActiveTab] = useState<'technicians' | 'logbook' | 'settings'>('technicians');
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  /** Hides trial-ending modal for this tab session after user closes it (backdrop or action). */
  const [trialEndingUiDismissed, setTrialEndingUiDismissed] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [trialNoticeLevel, setTrialNoticeLevel] = useState<TrialNoticeLevel | null>(null);
  const [showTrialFeedbackModal, setShowTrialFeedbackModal] = useState(false);
  const [overdueBanner, setOverdueBanner] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [showCertModal, setShowCertModal] = useState(false);
  const [technicianCerts, setTechnicianCerts] = useState<Certification[]>([]);
  const [certFile, setCertFile] = useState<{ file: File; dataUrl: string; contentType: string } | null>(null);
  const [certExpiry, setCertExpiry] = useState('');
  const [certLoading, setCertLoading] = useState(false);
  const [inviteStatusByTechnician, setInviteStatusByTechnician] = useState<Record<string, string>>({});
  const router = useRouter();
  const { showToast } = useToast();
  const isPreviewMode = process.env.NODE_ENV === 'development' && router.query.preview === '1';
  const { loading: permissionsLoading, canSwitchToTechnician } = usePermissions();
  const canAdminUseTechnicianView = canSwitchToTechnician();

  const isPro = company
    ? checkPlan(company.plan ?? 'trial', ['pro', 'business', 'enterprise']) || company.subscriptionStatus === 'active'
    : false;

  const signupCheckoutNeeded = useMemo(() => {
    if (isPreviewMode) return false;

    const snapshot = subscription
      ? {
          plan: subscription.plan,
          subscriptionStatus: subscription.status,
          trialEndsAt: subscription.trialEndsAt,
          paymentGraceEndsAt: subscription.paymentGraceEndsAt,
        }
      : company
        ? {
            plan: company.plan,
            subscriptionStatus: company.subscriptionStatus,
            trialEndsAt: company.trialEndsAt,
          }
        : null;

    if (!snapshot) return false;
    return needsSignupCheckout(snapshot);
  }, [isPreviewMode, subscription, company]);

  const handleSignupCheckout = async () => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Checkout is disabled in preview mode.', 'info');
      return;
    }
    setLoadingCheckout(true);
    setAppError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoadingCheckout(false);
      router.push('/auth/signin');
      return;
    }
    const result = await startSignupCheckout(session.access_token);
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    setAppError(result.error);
    showToast('Checkout failed', result.error, 'error');
    setLoadingCheckout(false);
  };

  const handleAccountDeleted = async () => {
    await supabase.auth.signOut();
    showToast('Account deleted', 'Sorry to see you go.', 'success');
    router.push('/?accountDeleted=1');
  };

  const handleCertUpload = async () => {
    if (!selectedTechId || !certFile || !company) {
      showToast('Invalid upload', 'Select technician and file', 'error');
      return;
    }

    setCertLoading(true);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      showToast('Upload failed', 'Unable to verify your session. Please refresh and try again.', 'error');
      console.error('Cert upload failed: no session', sessionError);
      setCertLoading(false);
      return;
    }

    const sanitizedFileName = certFile.file.name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-._]/g, '');
    const filePath = `${selectedTechId}/cert-${Date.now()}-${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logbook-photos')
      .upload(filePath, certFile.file, {
        cacheControl: '3600',
        contentType: certFile.file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      showToast('Upload failed', uploadError.message || 'Storage upload failed', 'error');
      console.error('Cert upload failed:', uploadError);
      setCertLoading(false);
      return;
    }

    const res = await fetch('/api/technicians/certifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        technicianId: selectedTechId,
        expiryDate: certExpiry || undefined,
        fileUrl: filePath,
      }),
    });

    if (res.ok) {
      showToast('Success', 'Certification uploaded', 'success');
      setShowCertModal(false);
      setCertFile(null);
      setCertExpiry('');
      const certRes = await fetch(`/api/technicians/${selectedTechId}/certifications`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (certRes.ok) {
        setTechnicianCerts(await certRes.json());
      }
    } else {
      const err = await res.json().catch(() => ({ error: 'Server error' }));
      showToast('Upload failed', err.error || err.message || 'Try again', 'error');
      console.error('Cert upload error:', err, 'status', res.status);
    }
    setCertLoading(false);
  };

  const loadTechCerts = async (techId: string) => {
    if (!company?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/technicians/${techId}/certifications`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const certs = await res.json();
      const signedPromises = certs.map(async (cert: Certification) => {
        const path = cert.fileUrl; // already path
        const { data, error } = await supabase.storage
          .from('logbook-photos')
          .createSignedUrl(path, 3600);

        if (error || !data?.signedUrl) {
          console.error('Failed to create cert signed URL:', error);
          return {
            ...cert,
            signedUrl: cert.fileUrl,
          };
        }

        return { ...cert, signedUrl: data.signedUrl };
      });
      const certsWithSigned = await Promise.all(signedPromises);
      setTechnicianCerts(certsWithSigned);
      setSelectedTechId(techId);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    const getUser = async () => {
      setCompanyLoadState('loading');
      if (isPreviewMode) {
        setUser({ id: 'preview-user', email: 'preview@pesttrace.local' });
        setCompany({
          id: 'preview-company',
          name: 'Pest Trace Preview Co.',
          email: 'owner@preview.local',
          requireSignature: false,
          requirePhotos: false,
          notificationPreferences: {
            trialExpiry: true,
            renewal: true,
            certificationExpiry: true,
          },
          subscriptionStatus: 'active',
        });
        setTechnicians([
          { id: 'tech-1', name: 'John Smith', email: 'john@preview.local' },
          { id: 'tech-2', name: 'Sarah Johnson', email: 'sarah@preview.local' },
        ]);
        setSubscription({ status: 'active' });
        setCompanyLoadState('ready');
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
        router.replace(`/auth/verify?email=${encodeURIComponent(session.user.email ?? '')}`);
        return;
      }

      setUser(session.user);

      const companyPromise = fetch('/api/company', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const techniciansPromise = fetch('/api/technicians', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const subscriptionPromise = fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const technicianProfilePromise = fetch('/api/technician-profile', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const companyRes = await companyPromise;
      const companyData = await companyRes.json().catch(() => null);
      if (!companyRes.ok) {
        setAppError(companyData?.error || 'Unable to load company details.');
        showToast('Load failed', companyData?.error || 'Unable to load company details.', 'error');
        setCompanyLoadState('error');
        return;
      }

      const isOwner = isCompanyOwnerSession(session.user.email, companyData);
      if (!isOwner) {
        const technicianProfileRes = await technicianProfilePromise;
        if (technicianProfileRes.ok) {
          const rolePayload: { technician?: unknown } = await technicianProfileRes.json().catch(() => ({}));
          if (rolePayload.technician) {
            router.replace('/technician');
            return;
          }
        }
      }

      if (!companyData) {
        setCompanyLoadState('missing');
        return;
      }

      setCompany(companyData);
      setCompanyLoadState('ready');

      const [techRes, subRes] = await Promise.all([techniciansPromise, subscriptionPromise]);

      const techData = await techRes.json().catch(() => []);
      setTechnicians(Array.isArray(techData) ? techData : []);
      if (!techRes.ok) {
        setAppError(techData?.error || 'Unable to load technicians.');
        showToast('Load failed', techData?.error || 'Unable to load technicians.', 'error');
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
        const now = Date.now();
        const hasAccess = hasSubscriptionAccess({
          plan: subData.plan,
          subscriptionStatus: subData.status,
          trialEndsAt: subData.trialEndsAt,
          paymentGraceEndsAt: subData.paymentGraceEndsAt,
        });
        const trialExpiresAt = subData.trialEndsAt ? new Date(subData.trialEndsAt) : null;
        const graceDaysLeft = getGraceDaysLeft(
          {
            paymentGraceEndsAt: subData.paymentGraceEndsAt,
          },
          now
        );

        if (!hasAccess) {
          const checkoutNeeded = needsSignupCheckout({
            plan: subData.plan,
            subscriptionStatus: subData.status,
            trialEndsAt: subData.trialEndsAt,
            paymentGraceEndsAt: subData.paymentGraceEndsAt,
          });
          if (!checkoutNeeded) {
            router.replace('/upgrade');
            return;
          }
        }

        if (graceDaysLeft !== null && subData.status !== 'active') {
          setOverdueBanner(
            `Payment is overdue. You have ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'} remaining before service interruption.`
          );
        } else {
          setOverdueBanner(null);
        }

        if (
          graceDaysLeft === null &&
          subData.status !== 'active' &&
          trialExpiresAt &&
          trialExpiresAt.getTime() > now
        ) {
          const daysLeft = trialFullDaysRemaining({
            plan: subData.plan ?? 'trial',
            trialEndsAt: trialExpiresAt,
          });
          setTrialNoticeLevel(getTrialNoticeLevel(daysLeft));
        } else {
          setTrialNoticeLevel(null);
        }
      }

      const cleanedQuery = { ...router.query };
      const queryPlan = typeof router.query.upgradedPlan === 'string' ? router.query.upgradedPlan : undefined;

      if (queryPlan && (queryPlan === 'pro' || queryPlan === 'business' || queryPlan === 'enterprise')) {
        const planLabel = queryPlan.charAt(0).toUpperCase() + queryPlan.slice(1);
        const detail =
          queryPlan === 'enterprise'
            ? 'Enterprise reporting, retention analytics, and NPS tools are now available.'
            : queryPlan === 'business'
              ? 'Business reporting and analytics are now available.'
              : 'Pro reports and certifications are now available.';
        showToast('Subscription active', `You upgraded to ${planLabel}. ${detail}`, 'success');
        await router.replace('/reports');
        return;
      }

      if (router.query.session_id) {
        delete cleanedQuery.session_id;
        delete cleanedQuery.upgradedPlan;
        router.replace(
          { pathname: router.pathname, query: cleanedQuery },
          undefined,
          { shallow: true }
        );
      }
    };
    getUser();
  }, [isPreviewMode, router, router.isReady, showToast, router.query.session_id, router.query.upgradedPlan, refreshKey]);

  const activeTrialNoticeLevel = useMemo(() => {
    if (!company || company.plan !== 'trial') return null;
    return getTrialNoticeLevel(
      trialFullDaysRemaining({ plan: company.plan, trialEndsAt: company.trialEndsAt ?? null }),
    );
  }, [company]);

  const maybePromptTrialFeedback = async (noticeLevel: TrialNoticeLevel | null) => {
    if (!noticeLevel || noticeLevel > 3) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/trial-feedback', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return;
      const body = (await res.json()) as { submitted?: boolean; dismissedAt?: string | null };
      if (!body.submitted && !body.dismissedAt) {
        setShowTrialFeedbackModal(true);
      }
    } catch {
      /* non-blocking */
    }
  };

  const showTrialEndingModal = useMemo(() => {
    if (signupCheckoutNeeded) return false;
    if (trialEndingUiDismissed) return false;
    if (!activeTrialNoticeLevel) return false;
    if (typeof window === 'undefined') return false;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const dismissed = sessionStorage.getItem(TRIAL_NOTICE_SESSION_KEY);
      if (dismissed === `${today}:${activeTrialNoticeLevel}`) return false;
      if (sessionStorage.getItem('pesttraceTrialEndingModalDismissed') === today) return false;
    } catch {
      /* ignore */
    }
    return true;
  }, [activeTrialNoticeLevel, signupCheckoutNeeded, trialEndingUiDismissed]);

  const tabQuery = router.query.tab;
  const currentTab: Tab =
    tabQuery === 'technicians' || tabQuery === 'logbook' || tabQuery === 'settings'
      ? tabQuery
      : activeTab;

  useEffect(() => {
    if (permissionsLoading || typeof window === 'undefined') return;
    if (!canAdminUseTechnicianView) return;
    if (window.localStorage.getItem('admin_tech_message_shown') === 'true') return;
    showToast(
      'Technician access enabled',
      "As a business admin, you can also log your own technician reports. Use the 'Log reports as technician' link in your dashboard.",
      'info',
    );
    window.localStorage.setItem('admin_tech_message_shown', 'true');
  }, [canAdminUseTechnicianView, permissionsLoading, showToast]);

  const handleSignOut = async () => {
    if (isPreviewMode) {
      router.push('/auth/signin');
      return;
    }
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  const handleSubscribe = async (plan: 'pro' | 'business' | 'enterprise') => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Checkout is disabled in preview mode.', 'info');
      return;
    }
    setLoadingCheckout(true);
    setAppError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    const token = session.access_token;

    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    });
    const data = await parseApiBody(res, 'Checkout failed.');
    const checkoutUrl = typeof data.url === 'string' ? data.url : undefined;
    const checkoutErr = typeof data.error === 'string' ? data.error : undefined;
    if (res.ok && checkoutUrl) {
      window.location.href = checkoutUrl;
    } else {
      setAppError(checkoutErr || 'Unable to start checkout. Please try again.');
      showToast('Checkout failed', checkoutErr || 'Unable to start checkout. Please try again.', 'error');
      setLoadingCheckout(false);
    }
  };

  const handleManageSubscription = async () => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Billing portal is disabled in preview mode.', 'info');
      return;
    }
    setLoadingPortal(true);
    setAppError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    const token = session.access_token;

    const res = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ intent: 'manage' }),
    });
    const data = await parseApiBody(res, 'Billing portal failed.');
    const portalUrl = typeof data.url === 'string' ? data.url : undefined;
    if (res.ok && portalUrl) {
      window.location.href = portalUrl;
    } else {
      const hosts =
        Array.isArray(data.attemptedReturnHosts) && data.attemptedReturnHosts.every((h) => typeof h === 'string')
          ? (data.attemptedReturnHosts as string[]).join(', ')
          : '';
      const detail = [
        typeof data.error === 'string' ? data.error : undefined,
        typeof data.hint === 'string' ? data.hint : undefined,
        hosts ? `Tried hosts: ${hosts}` : undefined,
      ]
        .filter(Boolean)
        .join(' — ');
      setAppError(detail || 'Unable to open customer portal.');
      showToast('Portal failed', detail || 'Unable to open customer portal.', 'error');
      setLoadingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Billing portal is disabled in preview mode.', 'info');
      return;
    }
    setLoadingPortal(true);
    setAppError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    const token = session.access_token;

    const res = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ intent: 'cancel' }),
    });
    const data = await parseApiBody(res, 'Cancellation flow failed.');
    const cancelPortalUrl = typeof data.url === 'string' ? data.url : undefined;
    if (res.ok && cancelPortalUrl) {
      window.location.href = cancelPortalUrl;
    } else {
      const hosts =
        Array.isArray(data.attemptedReturnHosts) && data.attemptedReturnHosts.every((h) => typeof h === 'string')
          ? (data.attemptedReturnHosts as string[]).join(', ')
          : '';
      const detail = [
        typeof data.error === 'string' ? data.error : undefined,
        typeof data.hint === 'string' ? data.hint : undefined,
        hosts ? `Tried hosts: ${hosts}` : undefined,
      ]
        .filter(Boolean)
        .join(' — ');
      setAppError(detail || 'Unable to open cancellation flow.');
      showToast('Cancel plan', detail || 'Unable to open Stripe billing.', 'error');
      setLoadingPortal(false);
    }
  };

  const handleUpdateCompanySettings = async (settings: {
    name: string;
    phone?: string;
    address?: string;
    website?: string;
    vatNumber?: string;
    country?: string;
    requireSignature: boolean;
    requirePhotos: boolean;
    defaultReportRangeDays: number;
    notificationPreferences: {
      trialExpiry: boolean;
      renewal: boolean;
      certificationExpiry: boolean;
      enterprise?: {
        accountManager?: {
          name?: string;
          email?: string;
          phone?: string;
        };
        security?: {
          ipAllowlistEnabled?: boolean;
          allowedIps?: string[];
          requireVerifiedEmail?: boolean;
        };
      };
    };
  }) => {
    if (!company) return;

    setSavingSettings(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      setSavingSettings(false);
      return;
    }

    const payload = {
      ...settings,
      notificationPreferences: {
        ...settings.notificationPreferences,
      },
    };

    const res = await fetch('/api/company', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await parseApiBody(res, 'Settings save failed.');
    if (res.ok) {
      setCompany(data as unknown as Company);
      showToast('Saved', 'Company settings updated successfully.', 'success');
    } else {
      const msg = typeof data.error === 'string' ? data.error : 'Unable to update company settings.';
      setAppError(msg);
      showToast('Save failed', msg, 'error');
    }
    setSavingSettings(false);
  };

  const handleAddTechnician = async (name: string, email: string) => {
    if (isPreviewMode) {
      setTechnicians((prev) => [...prev, { id: `preview-${Date.now()}`, name, email }]);
      showToast('Preview mode', 'Technician added locally in preview mode.', 'success');
      return true;
    }
    setAppError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return false;
    }
    const token = session.access_token;

    const res = await fetch('/api/technicians', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email }),
    });
    if (res.ok) {
      const newTech = await res.json();
      setTechnicians([...technicians, newTech]);
      showToast('Technician added', `${newTech.name} was added.`, 'success');
      try {
        const inviteRes = await fetch('/api/technicians/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ technicianId: newTech.id }),
        });
        if (inviteRes.ok) {
          const inviteBody = await inviteRes.json().catch(() => ({} as { success?: boolean; inviteLink?: string; warning?: string }));
          if (inviteBody.success) {
            setInviteStatusByTechnician((prev) => ({
              ...prev,
              [newTech.id]: new Date().toISOString(),
            }));
            showToast(
              'Invite sent',
              `Setup email sent to ${newTech.email}. They can set a password and sign in as technician.`,
              'success',
            );
          } else {
            if (inviteBody.inviteLink && typeof navigator !== 'undefined' && navigator.clipboard) {
              await navigator.clipboard.writeText(inviteBody.inviteLink).catch(() => undefined);
            }
            showToast(
              'Technician added',
              `${newTech.name} was added. Email sending is unavailable, so the invite link has been generated${inviteBody.inviteLink ? ' and copied (if browser allowed).' : '.'}`,
              'info',
            );
          }
        } else {
          const inviteErr = await inviteRes.json().catch(() => ({ error: 'Invite not sent' }));
          showToast(
            'Technician added',
            `${newTech.name} was added. Invite email was not sent: ${inviteErr.error || 'Unknown error'}.`,
            'info',
          );
        }
      } catch {
        showToast(
          'Technician added',
          `${newTech.name} was added. Invite email could not be sent right now.`,
          'info',
        );
      }
      return true;
    } else {
      const err = await res.json();
      setAppError(err.error || 'Unable to add technician');
      showToast('Add failed', err.error || 'Unable to add technician', 'error');
      return false;
    }
  };

  const handleRemoveTechnician = async (technicianId: string) => {
    if (isPreviewMode) {
      setTechnicians((prev) => prev.filter((t) => t.id !== technicianId));
      showToast('Preview mode', 'Technician removed locally in preview mode.', 'success');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    const previous = technicians;
    setTechnicians((prev) => prev.filter((t) => t.id !== technicianId));
    const token = session.access_token;
    const res = await fetch(`/api/technicians?id=${technicianId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      showToast('Technician removed', 'The technician was removed.', 'success');
    } else {
      setTechnicians(previous);
      const err = await res.json().catch(() => ({ error: 'Remove failed' }));
      showToast('Remove failed', err.error || 'Unable to remove technician.', 'error');
    }
  };

  const handleInviteTechnician = async (technicianId: string) => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Invite sending is disabled in preview mode.', 'info');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    const optimisticInviteAt = new Date().toISOString();
    setInviteStatusByTechnician((prev) => ({
      ...prev,
      [technicianId]: optimisticInviteAt,
    }));
    const res = await fetch('/api/technicians/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ technicianId }),
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({} as { success?: boolean; inviteLink?: string }));
      const tech = technicians.find((item) => item.id === technicianId);
      if (body.success) {
        setInviteStatusByTechnician((prev) => ({
          ...prev,
          [technicianId]: new Date().toISOString(),
        }));
        showToast(
          'Invite sent',
          `Invite email sent${tech?.email ? ` to ${tech.email}` : ''}.`,
          'success',
        );
      } else {
        setInviteStatusByTechnician((prev) => {
          const next = { ...prev };
          delete next[technicianId];
          return next;
        });
        if (body.inviteLink && typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(body.inviteLink).catch(() => undefined);
        }
        showToast(
          'Invite email failed',
          `Transactional email could not send (ensure RESEND_API_KEY and RESEND_FROM_EMAIL are set on Vercel). Invite link copied to clipboard when possible.`,
          'error',
        );
      }
      return;
    }
    const err = await res.json().catch(() => ({ error: 'Invite failed' }));
    setInviteStatusByTechnician((prev) => {
      const next = { ...prev };
      if (next[technicianId] === optimisticInviteAt) {
        delete next[technicianId];
      }
      return next;
    });
    showToast('Invite failed', err.error || 'Unable to send technician invite.', 'error');
  };

  const handleCopyInviteLink = async (technicianId: string) => {
    const tech = technicians.find((item) => item.id === technicianId);
    if (!tech?.email) {
      showToast('Copy failed', 'Technician email is missing.', 'error');
      return;
    }
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteLink = `${base}/auth/signup?role=technician&email=${encodeURIComponent(tech.email)}`;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      showToast('Copy unavailable', 'Clipboard is not available in this browser.', 'info');
      return;
    }
    await navigator.clipboard.writeText(inviteLink);
    showToast('Invite link copied', `Share the setup link with ${tech.email}.`, 'success');
  };

if (!user || companyLoadState === 'loading') return (
  <div className="min-h-screen flex items-center justify-center p-8">
    <Skeleton className="h-12 w-64 mb-4" />
    <div className="animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 p-8 rounded-2xl shadow-sm">
      <Skeleton className="h-8 w-64 mx-auto mb-4" />
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  </div>
);

  return (
    <div className="min-h-screen overflow-x-hidden bg-offwhite page-fade-in">
      <OnboardingTour />
      <div className="flex min-w-0 lg:pl-0">
        <Sidebar 
          activeTab={currentTab as string} 
          onTabChange={(tab: string) => setActiveTab(tab as Tab)} 
          onSignOut={handleSignOut}
          role="owner"
          previewMode={isPreviewMode}
        />
        <main className="min-w-0 flex-1 p-4 pt-24 sm:p-6 sm:pt-24 lg:p-8 lg:pt-24">
          <ErrorBoundary>
            {companyLoadState === 'error' && !company ? (
              <Card className="mx-auto max-w-2xl border-red-200 bg-red-50">
                <div className="space-y-3 p-5 text-red-900">
                  <p className="text-lg font-semibold">Unable to load your dashboard data</p>
                  <p className="text-sm">{appError || 'Please retry. If this keeps happening, check API/DB environment settings.'}</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAppError(null);
                      setCompanyLoadState('loading');
                      setRefreshKey((prev) => prev + 1);
                    }}
                  >
                    Retry loading dashboard
                  </Button>
                </div>
              </Card>
            ) : company ? (
              signupCheckoutNeeded ? (
                <SignupCheckoutGate
                  trialEndsAt={subscription?.trialEndsAt ?? company.trialEndsAt ?? null}
                  loading={loadingCheckout}
                  onCheckout={() => {
                    void handleSignupCheckout();
                  }}
                />
              ) : (
              <>
                <div className="mb-6 rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
                  <h1 className="text-4xl font-bold text-navy">
                    {currentTab === 'technicians' ? 'Technician Management' : currentTab === 'logbook' ? 'Treatment Logbook' : 'Settings'}
                  </h1>

                <p className="mt-1 text-zinc-600">
                  {currentTab === 'technicians'
                    ? 'Manage your team and track certification status'
                    : currentTab === 'logbook'
                    ? 'Record pest control treatments and maintain compliance records'
                    : 'Manage account and billing preferences'}
                </p>
                {canAdminUseTechnicianView ? (
                  <div className="mt-4">
                    <Link
                      href="/technician"
                      data-testid="admin-log-reports-link"
                      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Log reports as technician
                    </Link>
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Plan</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-900">
                      {formatOwnerBillingPlanLabel({
                        plan: company.plan,
                        subscriptionStatus: company.subscriptionStatus,
                      }).toUpperCase()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Team Size</p>
                    <p className="mt-1 text-sm font-semibold text-blue-900">{technicians.length} technicians</p>
                  </div>
                  <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-purple-700">Subscription</p>
                    <p className="mt-1 text-sm font-semibold text-purple-900">{subscription?.status || company.subscriptionStatus || 'trial'}</p>
                  </div>
                </div>
              </div>
              {trialNoticeLevel ? (
                <Card className="mb-6 border-blue-200 bg-blue-50">
                  <div className="flex flex-col gap-4 p-4 text-blue-900 sm:flex-row sm:items-center sm:justify-between">
                    <div>{trialNoticeMessage(trialNoticeLevel)}</div>
                    <Button variant="primary" onClick={() => router.push('/upgrade')}>
                      Upgrade now
                    </Button>
                  </div>
                </Card>
              ) : null}
              {overdueBanner ? (
                <Card className="mb-6 border-amber-200 bg-amber-50">
                  <div className="flex flex-col gap-4 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                    <div>{overdueBanner}</div>
                    <Button variant="primary" onClick={() => router.push('/upgrade')}>
                      Fix billing
                    </Button>
                  </div>
                </Card>
              ) : null}
              {appError && (
                <Card className="mb-6 border-red-200 bg-red-50">
                  <div className="text-red-800 p-4">{appError}</div>
                </Card>
              )}
              {currentTab === 'technicians' && (
              <>
                <OnboardingChecklist />
                <TechniciansTab 
                  technicians={technicians} 
                  plan={company.plan}
                  onAddTechnician={handleAddTechnician} 
                  onRemoveTechnician={(id) => setConfirmRemoveId(id)} 
                  onInviteTechnician={handleInviteTechnician}
                  onCopyInviteLink={handleCopyInviteLink}
                  inviteStatusByTechnician={inviteStatusByTechnician}
                  isPro={isPro}
                  setSelectedTechId={setSelectedTechId}
                  setShowCertModal={setShowCertModal}
                  onLoadTechCerts={loadTechCerts}
                />
                <DashboardEnhancements
                  plan={company.plan}
                  enterprisePreview={canUseEnterprisePreview({
                    plan: company.plan,
                    trialEndsAt: company.trialEndsAt ?? null,
                  })}
                />
              </>
              )}
              {currentTab === 'logbook' && (
                <LogbookTab
                  companyId={company.id}
                  technicians={technicians}
                  showTechnicianLogLink={canAdminUseTechnicianView}
                />
              )}
              {currentTab === 'settings' && (
                <SettingsTab 
                  key={`${company.id}-${company.subscriptionStatus}-${company.plan ?? 'none'}`}
                  company={company} 
                  subscription={subscription} 
                  onSubscribe={() => setShowPlanModal(true)}
                  onManageSubscription={handleManageSubscription} 
                  onCancelSubscription={handleCancelSubscription}
                  onUpdateCompanySettings={handleUpdateCompanySettings}
                  showToast={showToast}
                  onAccountDeleted={handleAccountDeleted}
                  previewMode={isPreviewMode}
                  savingSettings={savingSettings}
                  checkoutLoading={loadingCheckout} 
                  portalLoading={loadingPortal} 
                />
              )}
            </>
              )
          ) : companyLoadState === 'missing' ? (
            <CompanySetupTab />
          ) : null}
          </ErrorBoundary>
        </main>
      </div>
      {showTrialEndingModal && company?.plan === 'trial' ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTrialEndingUiDismissed(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTrialEndingUiDismissed(true);
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="trial-ending-title"
            className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="trial-ending-title" className="text-xl font-bold text-navy">
              {activeTrialNoticeLevel ? trialNoticeModalTitle(activeTrialNoticeLevel) : 'Your trial ends soon'}
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              {activeTrialNoticeLevel
                ? trialNoticeMessage(activeTrialNoticeLevel)
                : 'Upgrade to keep Enterprise preview analytics, retention insights, and NPS tools after your trial.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    const today = new Date().toISOString().slice(0, 10);
                    sessionStorage.setItem('pesttraceTrialEndingModalDismissed', today);
                    if (activeTrialNoticeLevel) {
                      sessionStorage.setItem(TRIAL_NOTICE_SESSION_KEY, `${today}:${activeTrialNoticeLevel}`);
                    }
                  } catch {
                    /* ignore */
                  }
                  setTrialEndingUiDismissed(true);
                  void maybePromptTrialFeedback(activeTrialNoticeLevel);
                }}
              >
                Remind me tomorrow
              </Button>
              <Button variant="primary" onClick={() => router.push('/upgrade')}>
                View plans
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <TrialFeedbackModal
        open={showTrialFeedbackModal}
        onClose={() => setShowTrialFeedbackModal(false)}
      />
      <ConfirmDialog
        open={Boolean(confirmRemoveId)}
        title="Remove technician?"
        description="This action cannot be easily undone."
        confirmLabel="Remove"
        onCancel={() => setConfirmRemoveId(null)}
        onConfirm={() => {
          if (confirmRemoveId) {
            handleRemoveTechnician(confirmRemoveId);
            setConfirmRemoveId(null);
          }
        }}
      />

      {showPlanModal && (
        <PlanModal
          onClose={() => setShowPlanModal(false)}
          onSubscribe={handleSubscribe}
        />
      )}
      {/* Certification Modal */}
      {showCertModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCertModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setShowCertModal(false);
          }}
          tabIndex={-1}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cert-modal-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 id="cert-modal-title" className="flex-1 text-center text-2xl font-bold text-navy">Upload Certification</h2>
              <Button size="sm" variant="secondary" onClick={() => setShowCertModal(false)} ariaLabel="Close certification modal">
                ✕
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label block mb-2">Technician</label>
                <p className="text-lg font-semibold">{technicians.find(t => t.id === selectedTechId)?.name}</p>
              </div>
              <div className="form-group">
                <label htmlFor="cert-file" className="form-label">Certification File (PDF/Image)</label>
                <input
                  id="cert-file"
                  type="file"
                  accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files && files[0]) {
                      const originalFile = files[0];
                      const contentType = originalFile.type;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = reader.result as string;
                        setCertFile({ file: originalFile, dataUrl: base64, contentType });
                      };
                      reader.readAsDataURL(originalFile);
                    } else {
                      setCertFile(null);
                    }
                  }}
                  className="form-input"
                />
              </div>
              {certFile ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">Ready to upload</p>
                  <p className="text-sm text-slate-600">{certFile.file.name}</p>
                  {certFile.contentType.startsWith('image/') ? (
                    <Image
                      src={certFile.dataUrl}
                      alt="Certification preview"
                      width={400}
                      height={220}
                      className="mt-3 w-full max-w-xl rounded-2xl border border-slate-200 object-contain"
                      unoptimized
                    />
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Document selected; it will be available for download after upload.
                    </p>
                  )}
                </div>
              ) : null}
              <FormInput
                label="Expiry Date (optional)"
                id="cert-expiry"
                type="date"
                value={certExpiry}
                onChange={(e) => setCertExpiry(e.target.value)}
              />
              <Button 
                onClick={handleCertUpload} 
                disabled={!certFile || certLoading || !isPro}
                className="w-full"
                size="lg"
              >
                {certLoading ? 'Uploading...' : 'Upload Certification'}
              </Button>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-navy mb-3">Existing Certifications ({technicianCerts.length})</h3>
              {technicianCerts.length === 0 ? (
                <p className="text-gray-500 text-sm">No certifications uploaded yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {technicianCerts.map((cert) => {
                    const isExpired = cert.expiryDate && new Date(cert.expiryDate) < new Date();
                    return (
                      <div key={cert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{new Date(cert.uploadedAt).toLocaleDateString()}</p>
                          <p className={`text-sm ${isExpired ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                            {cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : 'No expiry'}
                          </p>
                        </div>
                        <a
                          href={`/api/storage/download?path=${encodeURIComponent(cert.fileUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700"
                        >
                          📥 Download
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Sub-Components ==========
function CompanySetupTab() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showToast('Authentication required', 'You must be logged in', 'error');
      setLoading(false);
      return;
    }
    const token = session.access_token;

    const res = await fetch('/api/company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error creating company' }));
      showToast('Setup failed', err.error || 'Error creating company', 'error');
      setLoading(false);
      return;
    }

    const checkout = await startSignupCheckout(token);
    if (checkout.ok) {
      window.location.href = checkout.url;
      return;
    }
    showToast('Checkout failed', checkout.error, 'error');
    window.location.reload();
  };

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-navy mb-3">Welcome to Pest Trace!</h2>
          <div className="mx-auto h-1 w-12 bg-primary-500 rounded-full mb-4"></div>
          <p className="text-zinc-600">
            Set up your company, then add a card to start your free trial. You won&apos;t be charged until the trial ends.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Company Name"
            id="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter company name"
            required
          />
          <Button type="submit" disabled={loading} size="lg">
            {loading ? 'Continuing…' : 'Continue to secure checkout'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SignupCheckoutGate({
  trialEndsAt,
  loading,
  onCheckout,
}: {
  trialEndsAt: string | null;
  loading: boolean;
  onCheckout: () => void;
}) {
  const trialEndLabel = formatTrialChargeDate(trialEndsAt);

  return (
    <div className="mx-auto max-w-lg" data-testid="signup-checkout-gate">
      <Card>
        <div className="space-y-4 p-2 text-center">
          <h2 className="text-2xl font-bold text-navy">Add your card to start your trial</h2>
          <p className="text-sm text-zinc-600">
            A card is required to activate your Pest Trace Pro trial. Your card will be saved securely
            {trialEndLabel ? (
              <> and you won&apos;t be charged until {trialEndLabel}.</>
            ) : (
              <> and you won&apos;t be charged until your free trial ends.</>
            )}
          </p>
          <Button type="button" size="lg" disabled={loading} onClick={onCheckout}>
            {loading ? 'Redirecting…' : 'Continue to secure checkout'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface Certification {
  id: string;
  fileUrl: string;
  signedUrl?: string;
  expiryDate?: string;
  uploadedAt: string;
}

function TechniciansTab({ technicians, plan, onAddTechnician, onRemoveTechnician, onInviteTechnician, onCopyInviteLink, inviteStatusByTechnician, isPro, setSelectedTechId, setShowCertModal, onLoadTechCerts }: {
  technicians: Technician[];
  plan?: string | null;
  onAddTechnician: (name: string, email: string) => Promise<boolean>;
  onRemoveTechnician: (id: string) => void;
  onInviteTechnician: (id: string) => Promise<void>;
  onCopyInviteLink: (id: string) => Promise<void>;
  inviteStatusByTechnician: Record<string, string>;
  isPro: boolean;
  setSelectedTechId: (id: string) => void;
  setShowCertModal: (open: boolean) => void;
  onLoadTechCerts: (techId: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = getTechnicianLimit(plan);
  const limitReached = limit !== null && technicians.length >= limit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const added = await onAddTechnician(name, email);
    if (added) {
      setName('');
      setEmail('');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-navy mb-2">Add New Technician</h2>
          <div className="mx-auto h-1 w-16 bg-primary-500 rounded-full"></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Workflow: add technician, then click <span className="font-semibold text-slate-800">Send Invite</span>.
          They receive a setup link and sign in via technician one-time code.
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Plan allowance: {formatTechnicianLimit(plan)}</p>
          <p className="mt-1">
            Usage: {technicians.length}
            {limit === null ? ' technicians' : ` / ${limit} technicians`}
          </p>
          {limitReached ? (
            <p className="mt-2 font-semibold">Technician limit reached for current plan. Upgrade to add more.</p>
          ) : null}
        </div>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <FormInput label="Full Name" id="tech-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required />
          </div>
          <div className="sm:col-span-5">
            <FormInput label="Email Address" id="tech-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <Button type="submit" disabled={loading || limitReached}>{loading ? 'Adding...' : 'Add Technician'}</Button>
          </div>
        </form>
      </Card>

      {technicians.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-zinc-600 text-lg">No technicians yet. Add your first technician above.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {technicians.map((tech) => (
            <Card key={tech.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-navy">{tech.name}</h3>
                <p className="text-zinc-600">{tech.email}</p>
                {inviteStatusByTechnician[tech.id] ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Invite last sent {new Date(inviteStatusByTechnician[tech.id]).toLocaleString()}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">No invite sent yet</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={async () => {
                    await onLoadTechCerts(tech.id);
                    setSelectedTechId(tech.id);
                    setShowCertModal(true);
                  }}
                  disabled={!isPro}
                >
                  {isPro ? 'Manage Certification' : 'Pro Required'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => onRemoveTechnician(tech.id)}>Remove</Button>
                <Button variant="secondary" size="sm" onClick={() => void onInviteTechnician(tech.id)}>
                  {inviteStatusByTechnician[tech.id] ? 'Resend Invite' : 'Send Invite'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void onCopyInviteLink(tech.id)}>
                  Copy Invite Link
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LogbookTab({
  companyId,
  technicians,
  showTechnicianLogLink,
}: {
  companyId: string;
  technicians: Technician[];
  showTechnicianLogLink: boolean;
}) {
  return (
    <LogbookEntries
      companyId={companyId}
      technicians={technicians}
      allowCreate={false}
      showTechnicianLogLink={showTechnicianLogLink}
    />
  );
}

function LogbookEntries({
  companyId,
  technicians,
  allowCreate,
  showTechnicianLogLink = false,
}: {
  companyId: string;
  technicians: Technician[];
  allowCreate: boolean;
  showTechnicianLogLink?: boolean;
}) {
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LogbookEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    const fetchEntries = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/logbook-entries?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
        setFilteredEntries(data);
      }
      setLoading(false);
    };
    fetchEntries();
  }, [companyId]);

  useEffect(() => {
    const lowerSearch = search.toLowerCase();
    setFilteredEntries(entries.filter(entry => 
      entry.clientName.toLowerCase().includes(lowerSearch) || 
      entry.address.toLowerCase().includes(lowerSearch)
    ));
  }, [search, entries]);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, entries.length]);

  const fetchImageAsBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const mime = response.headers.get('content-type') || 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    } catch {
      return '';
    }
  };

  const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    doc.setFontSize(20);
    doc.text('Pest Trace Compliance Report', 105, 50, { align: 'center' });
    doc.setFontSize(12);
    doc.text(new Date().toLocaleDateString(), 105, 70, { align: 'center' });
    doc.text(`Company ID: ${companyId}`, 105, 85, { align: 'center' });
    doc.addPage();
    
    let y = 20;
    for (const [index, entry] of filteredEntries.entries()) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.text(`${index + 1}. ${entry.clientName}`, 15, y);
      y += 5;
      doc.setFontSize(10);
      doc.text(`Address: ${entry.address}`, 15, y);
      y += 4;
      doc.text(`Date: ${new Date(entry.date).toLocaleDateString()}`, 15, y);
      y += 4;
      doc.text(`Treatment: ${entry.treatment}`, 15, y);
      if (entry.rooms) doc.text(`Rooms: ${entry.rooms.join(', ')}`, 15, y + 4);
      y += 4;
      if (entry.baitBoxesPlaced) doc.text(`Bait Boxes: ${entry.baitBoxesPlaced}`, 15, y);
      y += 4;
      if (entry.poisonUsed) doc.text(`Poison: ${entry.poisonUsed}`, 15, y);
      y += 4;
      if (entry.status) doc.text(`Status: ${entry.status}`, 15, y);
      y += 8;
      if (entry.notes) {
        const notesLines = doc.splitTextToSize(entry.notes, 170);
        doc.text(notesLines, 15, y);
        y += notesLines.length * 4 + 5;
      } else {
        y += 5;
      }

      const photoUrls = parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos);
      if (photoUrls.length > 0) {
        y += 5;
        doc.text('Photos:', 15, y);
        y += 8;
        for (const [photoIndex, photoUrl] of photoUrls.slice(0, 4).entries()) {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          try {
            const base64 = await fetchImageAsBase64(photoUrl);
            if (base64) {
              doc.addImage(base64, 'JPEG', 15, y, 60, 45);
              doc.text(`Photo ${photoIndex + 1}`, 80, y + 10);
            }
          } catch {
            doc.text(`Photo ${photoIndex + 1} (unavailable)`, 15, y);
          }
          y += 50;
        }
        y += 5;
      }
    }
    
    doc.save(`pesttrace-compliance-${Date.now()}.pdf`);
  };

  if (loading) return <div>Loading entries...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-navy mb-2">Logbook Entries</h2>
          <div className="mx-auto h-1 w-16 bg-primary-500 rounded-full mb-4"></div>
          <p className="text-zinc-600">{filteredEntries.length} entries</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entries..."
          className="form-input w-full sm:w-72 border-zinc-300 rounded-xl px-4 py-3"
        />
        <Button onClick={exportToPDF} variant="secondary" size="lg">📥 Export PDF</Button>
      </div>
      {allowCreate ? (
        <Card>
          <AddLogbookEntryForm
            companyId={companyId}
            technicians={technicians}
            onAdd={(entry) => {
              setEntries((prevEntries) => [entry, ...prevEntries]);
              setFilteredEntries((prevFiltered) => {
                if (!search.trim()) return [entry, ...prevFiltered];
                const lowerSearch = search.toLowerCase();
                return entry.clientName.toLowerCase().includes(lowerSearch) || entry.address.toLowerCase().includes(lowerSearch)
                  ? [entry, ...prevFiltered]
                  : prevFiltered;
              });
            }}
          />
        </Card>
      ) : (
        <Card className="border-blue-200 bg-blue-50">
          <div className="space-y-3 p-4 text-sm text-blue-900">
            <p>
              <strong>Review and export</strong> logbook records here. This view is read-only for business admins.
            </p>
            <p>
              <strong>Create new entries</strong> in the Technician workspace — field jobs are logged there so records stay tied to the right technician.
            </p>
            {showTechnicianLogLink ? (
              <Link href="/technician" className="inline-flex font-semibold text-primary-700 underline">
                Log a job as technician
              </Link>
            ) : (
              <Link href="/dashboard?tab=technicians" className="inline-flex font-semibold text-primary-700 underline">
                Set up technicians in your team
              </Link>
            )}
          </div>
        </Card>
      )}
      {filteredEntries.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-zinc-600 text-lg">No logbook entries yet.</p>
        </Card>
      ) : (
        <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm" open>
          <summary className="cursor-pointer list-none rounded-2xl px-5 py-4 transition hover:bg-zinc-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Saved logs</span>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                {filteredEntries.length} records
              </span>
            </div>
          </summary>
          <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
            <div className="space-y-4">
              {filteredEntries.slice(0, visibleCount).map((entry) => {
                const photoUrls = parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos);
                return (
                <details key={entry.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/40 p-4" open={false}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-navy">{entry.clientName}</h3>
                        <p className="mt-1 text-sm text-zinc-600">{entry.address}</p>
                        <p className="mt-1 text-xs text-zinc-500">{new Date(entry.date).toLocaleDateString()}</p>
                      </div>
                      <span className="inline-flex w-fit rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">
                        {entry.treatment}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    {renderRoomDetails(entry.rooms)}
                    {entry.notes && <p className="mt-3 text-sm text-zinc-700">{entry.notes}</p>}
                    {photoUrls.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {photoUrls.map((url) => (
                          <Image
                            key={url}
                            loader={supabaseImageLoader}
                            src={url}
                            alt="Job photo"
                            width={600}
                            height={300}
                            className="h-auto max-h-[400px] w-full rounded-2xl border object-contain shadow-sm transition-shadow hover:shadow-md"
                            unoptimized
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )})}
            </div>
            {filteredEntries.length > visibleCount ? (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => setVisibleCount((prev) => prev + 20)}>
                  Load more logs
                </Button>
              </div>
            ) : null}
          </div>
        </details>
      )}
    </div>
  );
}

function AddLogbookEntryForm({ companyId, technicians, onAdd }: {
  companyId: string;
  technicians: Technician[];
  onAdd: (entry: LogbookEntry) => void;
}) {
  const [date, setDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [productAmount, setProductAmount] = useState('');
  const [recommendation, setRecommendation] = useState('');
  interface RoomForm {
    name: string;
    note: string;
  }
  const [rooms, setRooms] = useState<RoomForm[]>([]);
  const [baitBoxesPlaced, setBaitBoxesPlaced] = useState('');
  const [poisonUsed, setPoisonUsed] = useState('');
  const [baitStations, setBaitStations] = useState<BaitStationForm[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawing = useRef(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { isOnline } = useOfflineQueue();
  const draftKey = `owner-logbook-draft:${companyId}`;

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.date === 'string') setDate(draft.date);
      if (typeof draft.clientName === 'string') setClientName(draft.clientName);
      if (typeof draft.address === 'string') setAddress(draft.address);
      if (typeof draft.treatment === 'string') setTreatment(draft.treatment);
      if (typeof draft.notes === 'string') setNotes(draft.notes);
      if (typeof draft.technicianId === 'string') setTechnicianId(draft.technicianId);
      if (typeof draft.followUpDate === 'string') setFollowUpDate(draft.followUpDate);
      if (typeof draft.internalNotes === 'string') setInternalNotes(draft.internalNotes);
      if (typeof draft.productAmount === 'string') setProductAmount(draft.productAmount);
      if (typeof draft.recommendation === 'string') setRecommendation(draft.recommendation);
    } catch {
      // Ignore invalid draft payload.
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        date,
        clientName,
        address,
        treatment,
        notes,
        technicianId,
        followUpDate,
        internalNotes,
        productAmount,
        recommendation,
      }),
    );
  }, [draftKey, date, clientName, address, treatment, notes, technicianId, followUpDate, internalNotes, productAmount, recommendation]);

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    // Calculate scale factor between display size and internal canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl('');
  };

  const beginSignature = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const continueSignature = (x: number, y: number) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const finishSignature = (pointerId?: number) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (pointerId != null && canvas.hasPointerCapture && canvas.releasePointerCapture) {
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    }
    setSignatureDataUrl(canvas.toDataURL('image/png'));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasPoint(event.clientX, event.clientY);
    if (!coords) return;
    beginSignature(coords.x, coords.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasPoint(event.clientX, event.clientY);
    if (!coords) return;
    continueSignature(coords.x, coords.y);
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    finishSignature(event.pointerId);
    event.preventDefault();
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    finishSignature(event.pointerId);
    event.preventDefault();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    const coords = getCanvasPoint(touch.clientX, touch.clientY);
    if (!coords) return;
    beginSignature(coords.x, coords.y);
    event.preventDefault();
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    const coords = getCanvasPoint(touch.clientX, touch.clientY);
    if (!coords) return;
    continueSignature(coords.x, coords.y);
    event.preventDefault();
  };

  const handleTouchEnd = () => {
    finishSignature();
  };

  const addBaitStation = () => {
    setBaitStations([...baitStations, { stationId: '', location: '', baitType: '', amount: '' }]);
  };

  const updateBaitStation = (index: number, field: keyof BaitStationForm, value: string) => {
    const newStations = [...baitStations];
    newStations[index] = { ...newStations[index], [field]: value } as BaitStationForm;
    setBaitStations(newStations);
  };

  const removeBaitStation = (index: number) => {
    setBaitStations(baitStations.filter((_, i) => i !== index));
  };

  const addRoom = () => {
    setRooms([...rooms, { name: '', note: '' }]);
  };

  const updateRoom = (index: number, field: keyof RoomForm, value: string) => {
    const newRooms = [...rooms];
    newRooms[index] = { ...newRooms[index], [field]: value } as RoomForm;
    setRooms(newRooms);
  };

  const removeRoom = (index: number) => {
    setRooms(rooms.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !date || !clientName || !address || !treatment || !technicianId) {
      showToast('Missing fields', 'Please fill all required fields', 'error');
      return;
    }
    
    const validBaitStations = baitStations.filter(station => 
      station.stationId.trim() && station.location.trim()
    );

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? null;
    const canUploadPhotos = Boolean(accessToken) && isOnline;

    const photoFiles = photoInputRef.current?.files
      ? Array.from(photoInputRef.current.files).slice(0, 4)
      : [];
    const uploadedPhotoPaths: string[] = [];

    if (!canUploadPhotos && photoFiles.length > 0) {
      showToast(
        'Offline photo upload',
        'Photos require an internet connection. Save the entry now and add photos when back online.',
        'info'
      );
    }

    if (canUploadPhotos && photoFiles.length > 0) {
      const uploadResults = await Promise.all(
        photoFiles.map(async (file, i) => {
          const safeName = file.name.replace(/[^\w.\-]+/g, '_') || 'photo.jpg';
          const filePath = `private/${companyId}/${technicianId}/${Date.now()}-${i}-${safeName}`;
          const { error } = await supabase.storage
            .from('logbook-photos')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });
          return { filePath, error };
        }),
      );

      const failedUpload = uploadResults.find((result) => result.error);
      if (failedUpload?.error) {
        showToast('Photo upload failed', failedUpload.error.message, 'error');
        setLoading(false);
        return;
      }

      uploadedPhotoPaths.push(...uploadResults.map((result) => result.filePath));
    }
    
    const roomsPayload = rooms
      .map((room) => ({ name: room.name.trim(), note: room.note.trim() }))
      .filter((room) => room.name.length > 0);

    const payload = {
      companyId,
      date,
      clientName,
      address,
      treatment,
      notes: notes || undefined,
      technicianIds: [technicianId],
      rooms: roomsPayload.length > 0 ? roomsPayload : undefined,
      baitBoxesPlaced: baitBoxesPlaced || undefined,
      poisonUsed: poisonUsed || undefined,
      followUpDate: followUpDate || undefined,
      internalNotes: internalNotes || undefined,
      productAmount: productAmount || undefined,
      recommendation: recommendation || undefined,
      signature: signatureDataUrl || undefined,
      ...(uploadedPhotoPaths.length > 0 && {
        photoUrls: uploadedPhotoPaths,
        photoUrl: uploadedPhotoPaths[0],
      }),
      ...(validBaitStations.length > 0 && { baitStations: validBaitStations }),
    };

    const resetForm = () => {
      setDate('');
      setClientName('');
      setAddress('');
      setTreatment('');
      setNotes('');
      setTechnicianId('');
      setFollowUpDate('');
      setInternalNotes('');
      setProductAmount('');
      setRecommendation('');
      setRooms([]);
      setBaitBoxesPlaced('');
      setPoisonUsed('');
      setBaitStations([]);
      if (photoInputRef.current) photoInputRef.current.value = '';
      localStorage.removeItem(draftKey);
    };

    if (isOnline && accessToken) {
      const res = await fetch('/api/logbook-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const entry = (await res.json()) as LogbookEntry;
        onAdd(entry);
        resetForm();
        showToast('Entry saved', 'Logbook entry saved successfully!', 'success');
        setLoading(false);
        return;
      }

      const error = (await res.json().catch(() => ({}))) as { error?: string };
      showToast('Save failed', error.error || 'Error adding entry', 'error');
      setLoading(false);
      return;
    }

    if (!accessToken) {
      showToast('Sign in required', 'Please sign in again to save entries.', 'error');
      setLoading(false);
      return;
    }

    // Offline: queue write for replay
    try {
      await fetch('/api/offline/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ operation: 'CREATE', tableName: 'logbook_entries', data: payload }),
      });
    } catch {
      // Ignore network failures; local queue banner will indicate queued writes.
    }

    // Always queue locally so it survives page reloads.
    // Reuse the offline queue hook via a lightweight call to the IndexedDB wrapper.
    const { queueOperation } = await import('../lib/offline/db');
    const userId = session?.user?.id;
    if (userId) {
      await queueOperation(userId, 'CREATE', 'logbook_entries', payload);
    }

    onAdd({
      id: `offline-${Date.now()}`,
      date,
      clientName,
      address,
      treatment,
      notes: notes || undefined,
      photoUrl: undefined,
      photoUrls: undefined,
      photos: [],
      signature: signatureDataUrl || undefined,
      rooms: roomsPayload,
      baitBoxesPlaced: baitBoxesPlaced || undefined,
      poisonUsed: poisonUsed || undefined,
      followUpDate: followUpDate || undefined,
      internalNotes: internalNotes || undefined,
      productAmount: productAmount || undefined,
      recommendation: recommendation || undefined,
    });
    resetForm();
    showToast('Saved offline', 'Entry queued and will sync when you reconnect.', 'success');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput label="Date" id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <FormInput label="Client Name" id="entry-client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" required />
      <FormInput label="Address" id="entry-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Job address" required />
      <FormInput label="Treatment" id="entry-treatment" value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. Rodent control" required />
              <div className="md:col-span-2 mb-6 p-4 bg-gray-50 rounded-xl">
                <label className="form-label block mb-3 font-semibold">Rooms</label>
                {rooms.length === 0 ? (
                  <Button type="button" variant="secondary" onClick={addRoom} size="sm">
                    + Add Room
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {rooms.map((room, index) => (
                      <div key={index} className="space-y-3 p-4 bg-white rounded-lg border shadow-sm max-w-3xl">
                        <FormInput 
                          label="Room Name" 
                          id={`room-${index}`}
                          value={room.name} 
                          onChange={(e) => updateRoom(index, 'name', e.target.value)} 
                          placeholder="Kitchen" 
                        />
                        <FormInput
                          label="Room Notes"
                          id={`room-note-${index}`}
                          as="textarea"
                          value={room.note}
                          onChange={(e) => updateRoom(index, 'note', e.target.value)}
                          placeholder="Notes about treatment or observations in this room"
                        />
                        <Button type="button" variant="danger" size="sm" onClick={() => removeRoom(index)} className="self-start">Remove</Button>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={addRoom} size="sm">+ Add Another Room</Button>
                  </div>
                )}
              </div>
      <FormInput label="Bait Boxes Placed" id="entry-bait-boxes" value={baitBoxesPlaced} onChange={(e) => setBaitBoxesPlaced(e.target.value)} placeholder="Yes, 6 boxes" />
      <FormInput label="Poison Used" id="entry-poison-used" value={poisonUsed} onChange={(e) => setPoisonUsed(e.target.value)} placeholder="e.g. Bromadiolone" />
      <FormInput
        label="Technician"
        id="entry-technician"
        as="select"
        value={technicianId || ''}
        onChange={(e) => setTechnicianId(e.target.value)}
        required
        options={[{ value: '', label: 'Select technician' }, ...technicians.map((tech) => ({ value: tech.id, label: tech.name }))]}
      />
      <div className="md:col-span-2">
        <FormInput label="Notes" id="entry-notes" as="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Treatment substances, observations..." />
      </div>
      <FormInput label="Follow-up Date" id="follow-up-date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
      <div className="md:col-span-2">
        <FormInput label="Internal Notes" id="internal-notes" as="textarea" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal use only..." />
      </div>
      <FormInput label="Product Amount" id="product-amount" value={productAmount} onChange={(e) => setProductAmount(e.target.value)} placeholder="e.g. 2kg" />
      <div className="md:col-span-2 mb-6 p-4 bg-gray-50 rounded-xl">
        <label className="form-label block mb-3 font-semibold">Bait Stations</label>
        {baitStations.length === 0 ? (
          <Button type="button" variant="secondary" onClick={addBaitStation} size="sm">
            + Add Bait Station
          </Button>
        ) : (
          <div className="space-y-3">
            {baitStations.map((station, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-white rounded-lg border shadow-sm">
                <FormInput label="Station ID" id={`station-id-${index}`} value={station.stationId} onChange={(e) => updateBaitStation(index, 'stationId', e.target.value)} placeholder="BS001" />
                <FormInput label="Location" id={`station-location-${index}`} value={station.location} onChange={(e) => updateBaitStation(index, 'location', e.target.value)} placeholder="Kitchen" />
                <FormInput label="Bait Type" id={`station-bait-type-${index}`} value={station.baitType || ''} onChange={(e) => updateBaitStation(index, 'baitType', e.target.value)} placeholder="Wax block" />
                <FormInput label="Amount" id={`station-amount-${index}`} value={station.amount || ''} onChange={(e) => updateBaitStation(index, 'amount', e.target.value)} placeholder="50g" />
                <Button type="button" variant="danger" size="sm" onClick={() => removeBaitStation(index)} className="self-start">Remove</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addBaitStation} size="sm">+ Add Another Bait Station</Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="form-group">
          <label htmlFor="logbook-photos" className="form-label">Photos (optional, up to 4)</label>
          <input
            ref={photoInputRef}
            id="logbook-photos"
            type="file"
            multiple
            accept="image/*"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <div className="flex items-center justify-between">
            <label className="form-label mb-0">E-Signature</label>
            {signatureDataUrl && (
              <button type="button" onClick={clearSignature} className="text-sm text-red-600 hover:text-red-800 font-medium">Clear Signature</button>
            )}
          </div>
          <div className="rounded-lg border-2 border-gray-300 overflow-hidden bg-white shadow-sm">
            <canvas
              ref={canvasRef}
              width={800}
              height={200}
              className="signature-canvas w-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerCancel}
              onPointerCancel={handlePointerCancel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Draw signature (optional)</p>
          {signatureDataUrl && (
            <Image src={signatureDataUrl} alt="Signature preview" width={600} height={240} className="mt-3 h-24 w-full max-w-xs rounded-2xl border border-gray-200 object-contain" unoptimized />
          )}
        </div>
      </div>
      <div className="md:col-span-2 pt-2">
        <Button type="submit" size="lg" disabled={loading}>{loading ? 'Saving entry...' : 'Save Logbook Entry'}</Button>
      </div>
    </form>
  );
}
