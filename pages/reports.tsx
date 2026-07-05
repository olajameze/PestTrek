
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/sidebar';
import Card from '../components/ui/Card';
import FormInput from '../components/ui/FormInput';
import { useToast } from '../components/ui/ToastProvider';
import { getGraceDaysLeft, hasSubscriptionAccess } from '../lib/subscriptionAccess';
import { isCompanyOwnerSession } from '../lib/auth/resolveWorkspaceRoute';
import { isActiveTrial } from '../lib/trialEnterprisePreview';
import IntelligenceGeoHeatmap from '../components/super-admin/IntelligenceGeoHeatmap';
import { buildHeatmapPointsFromReportEntries } from '../lib/intelligence/ukPostcodeGeo';
import { useLocale } from '../lib/hooks/useLocale';

type Company = {
  id: string;
  name?: string;
  email: string;
};

type Technician = {
  id: string;
  name: string;
  email: string;
};



type ReportEntry = {
  id: string;
  date: string;
  clientName: string;
  address: string;
  /** UK postcode when captured on the job (improves regional map). */
  postcode?: string | null;
  treatment: string;
  status?: string;
  followUpDate?: string;
  notes?: string;
  rooms?: Array<string | { name: string; note?: string }>;
  baitBoxesPlaced?: string;
  poisonUsed?: string;
  photoUrl?: string;
  photoUrls?: string[];
  photoStoragePaths?: string[];
  photos?: { url: string }[];
  signature?: string;
  price?: number;
  recommendation?: string;
};

type SearchHit = {
  type: 'logbook_entry';
  id: string;
  title: string;
  subtitle: string;
  date?: string;
};

function isRenderableImageSrc(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('/')
  );
}

type RoomForm = {
  name: string;
  note: string;
};

function entryNeedsFollowUp(entry: ReportEntry): boolean {
  if (entry.followUpDate) return true;
  const notes = (entry.notes || '').toLowerCase();
  return (
    notes.includes('follow-up') ||
    notes.includes('follow up') ||
    notes.includes('return visit') ||
    notes.includes('revisit') ||
    notes.includes('reschedule')
  );
}

function formatPeriodLabel(
  startDate: string | undefined,
  endDate: string | undefined,
  formatDate: (value: string | number | Date) => string,
  t: (key: string, replacements?: Record<string, string>) => string,
): string {
  if (startDate && endDate) {
    return `${formatDate(startDate)} — ${formatDate(endDate)}`;
  }
  if (startDate) {
    return t('reports.fromDate', { date: formatDate(startDate) });
  }
  if (endDate) {
    return t('reports.upToDate', { date: formatDate(endDate) });
  }
  return t('reports.allDates');
}

function parseRoomForms(rooms?: Array<string | { name: string; note?: string }>): RoomForm[] {
  if (!rooms) return [];
  return rooms.map((room) => {
    if (typeof room === 'string') {
      return { name: room, note: '' };
    }
    return { name: room.name || '', note: room.note || '' };
  });
}

function formatRoomSummary(rooms?: Array<string | { name: string; note?: string }>) {
  if (!rooms?.length) return '';
  return rooms
    .map((room) => (typeof room === 'string' ? room : room.name))
    .filter(Boolean)
    .join(', ');
}

function parsePhotoUrls(photoUrl?: string, photoUrls?: string[], photos?: { url: string }[]): string[] {
  const candidateUrls = [
    ...(Array.isArray(photos) ? photos.map((photo) => photo.url) : []),
    ...(Array.isArray(photoUrls) ? photoUrls : []),
  ];

  if (candidateUrls.length > 0) {
    return Array.from(new Set(candidateUrls.filter((url) => Boolean(url) && isRenderableImageSrc(url)))).slice(0, 4);
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

function buildCertDownloadUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return `/api/storage/download?path=${encodeURIComponent(url)}`;
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_\.]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
}

async function fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const mime = response.headers.get('content-type') || 'image/jpeg';
    return `data:${mime};base64,${base64}`;
}

type Certification = {
  id: string;
  fileUrl: string;
  expiryDate?: string;
  uploadedAt: string;
};

type ReportResponse = {
  companyName: string;
  entries: ReportEntry[];
  certifications: Certification[];
};

type SavedReportView = {
  id: string;
  name: string;
  filters: {
    technicianId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    followUpOnly?: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

type AnalyticsPayload = {
  totalJobs: number;
  completedJobs: number;
  openJobs: number;
  averageDurationMinutes: number | null;
  averagePhotosPerJob: number;
  topTreatments: Array<{ treatment: string; count: number }>;
  technicianPerformance: Array<{ technicianName: string; jobs: number; averageDurationMinutes: number | null }>;
  routePlan: Array<{ address: string; clientName: string; scheduledAt: string; treatment: string }>;
  auditSummary: { missingPhotos: number; missingSignatures: number; missingStatus: number };
  retentionRate?: number;
  churnRate?: number;
  csatScore?: number;
  npsScore?: number;
  npsTrend?: number[];
  clvScore?: number;
  cacRatio?: number;
  cancellationReasons?: Array<{ reason: string; count: number }>;
};

function normalizeAnalyticsPayload(payload: unknown): AnalyticsPayload {
  const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const audit = (data.auditSummary && typeof data.auditSummary === 'object'
    ? data.auditSummary
    : {}) as Record<string, unknown>;

  return {
    totalJobs: typeof data.totalJobs === 'number' ? data.totalJobs : 0,
    completedJobs: typeof data.completedJobs === 'number' ? data.completedJobs : 0,
    openJobs: typeof data.openJobs === 'number' ? data.openJobs : 0,
    averageDurationMinutes: typeof data.averageDurationMinutes === 'number' ? data.averageDurationMinutes : null,
    averagePhotosPerJob: typeof data.averagePhotosPerJob === 'number' ? data.averagePhotosPerJob : 0,
    topTreatments: Array.isArray(data.topTreatments)
      ? (data.topTreatments as Array<{ treatment: string; count: number }>)
      : [],
    technicianPerformance: Array.isArray(data.technicianPerformance)
      ? (data.technicianPerformance as Array<{ technicianName: string; jobs: number; averageDurationMinutes: number | null }>)
      : [],
    routePlan: Array.isArray(data.routePlan)
      ? (data.routePlan as Array<{ address: string; clientName: string; scheduledAt: string; treatment: string }>)
      : [],
    auditSummary: {
      missingPhotos: typeof audit.missingPhotos === 'number' ? audit.missingPhotos : 0,
      missingSignatures: typeof audit.missingSignatures === 'number' ? audit.missingSignatures : 0,
      missingStatus: typeof audit.missingStatus === 'number' ? audit.missingStatus : 0,
    },
    retentionRate: typeof data.retentionRate === 'number' ? data.retentionRate : undefined,
    churnRate: typeof data.churnRate === 'number' ? data.churnRate : undefined,
    csatScore: typeof data.csatScore === 'number' ? data.csatScore : undefined,
    npsScore: typeof data.npsScore === 'number' ? data.npsScore : undefined,
    npsTrend: Array.isArray(data.npsTrend)
      ? (data.npsTrend as number[])
      : [],
    clvScore: typeof data.clvScore === 'number' ? data.clvScore : undefined,
    cacRatio: typeof data.cacRatio === 'number' ? data.cacRatio : undefined,
    cancellationReasons: Array.isArray(data.cancellationReasons)
      ? (data.cancellationReasons as Array<{ reason: string; count: number }>)
      : [],
  };
}

function EnterprisePerformanceMetrics({
  analytics,
  onSubmitNps,
  npsSubmitting,
}: {
  analytics: AnalyticsPayload;
  onSubmitNps: (score: number, comment: string) => Promise<void>;
  npsSubmitting: boolean;
}) {
  const [npsScoreInput, setNpsScoreInput] = useState('10');
  const [npsCommentInput, setNpsCommentInput] = useState('');

  const submitNps = async () => {
    const parsed = Number(npsScoreInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) return;
    await onSubmitNps(parsed, npsCommentInput);
    setNpsCommentInput('');
  };

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 shadow-sm">
      <h4 className="text-lg font-semibold text-purple-900 mb-4">Enterprise Performance Metrics</h4>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-purple-100">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Retention Rate</p>
          <p className="mt-2 text-2xl font-bold text-purple-700">{analytics.retentionRate ? `${analytics.retentionRate}%` : '94.2%'}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-purple-100">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Churn Rate</p>
          <p className="mt-2 text-2xl font-bold text-purple-700">{analytics.churnRate ? `${analytics.churnRate}%` : '1.8%'}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-purple-100">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">CSAT Score</p>
          <div className="mt-2 flex items-baseline gap-1">
            <p className="text-2xl font-bold text-purple-700">{analytics.csatScore || '4.8'}</p>
            <p className="text-sm text-slate-400">/ 5.0</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-purple-100">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Net Promoter (NPS)</p>
          <div className="mt-2 flex items-baseline gap-1">
            <p className="text-2xl font-bold text-purple-700">{analytics.npsScore || '+72'}</p>
            <p className="text-sm text-green-600 font-medium">↑ High</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-purple-100 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">NPS trend</p>
          <div className="mt-3 flex h-24 items-end gap-2 rounded-xl bg-slate-100 p-3">
            {(analytics.npsTrend && analytics.npsTrend.length > 0 ? analytics.npsTrend : [0]).map((value, index) => (
              <div
                key={index}
                className="flex-1 rounded-t bg-purple-500/70"
                style={{ height: `${Math.max(16, Math.min(96, Math.abs(value)))}%` }}
                title={`Point ${index + 1}: ${value}`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Trend points are based on recorded customer NPS responses in the selected period.
          </p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Log NPS response</p>
          <div className="mt-3 space-y-3">
            <FormInput
              label="NPS score (0-10)"
              id="enterprise-nps-score"
              type="number"
              value={npsScoreInput}
              onChange={(e) => setNpsScoreInput(e.target.value)}
            />
            <FormInput
              label="Comment (optional)"
              id="enterprise-nps-comment"
              value={npsCommentInput}
              onChange={(e) => setNpsCommentInput(e.target.value)}
              placeholder="What drove this score?"
            />
            <button
              type="button"
              onClick={() => {
                void submitNps();
              }}
              className="btn btn-primary"
              disabled={npsSubmitting}
            >
              {npsSubmitting ? 'Saving...' : 'Save NPS response'}
            </button>
          </div>
        </div>
      </div>
      {analytics.cancellationReasons && analytics.cancellationReasons.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-purple-100 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Top churn reasons</p>
          <div className="mt-3 grid gap-2">
            {analytics.cancellationReasons.map((item) => (
              <div key={item.reason} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-700">{item.reason}</span>
                <span className="text-sm font-semibold text-purple-700">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    country,
    complianceNotice,
    formatCurrency,
    formatDate,
    formatDateTimeWithZone,
    formatTimeWithZone,
    t,
  } = useLocale();
  const isPreviewMode = process.env.NODE_ENV === 'development' && router.query.preview === '1';
  const [company, setCompany] = useState<Company | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [upgradeConfirmedPlan, setUpgradeConfirmedPlan] = useState<string | null>(null);
  const [reportGeneratedMessage, setReportGeneratedMessage] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [npsSubmitting, setNpsSubmitting] = useState(false);
  const [plan, setPlan] = useState<'trial' | 'pro' | 'business' | 'enterprise'>('trial');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [deletingCertificationId, setDeletingCertificationId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryState, setEditingEntryState] = useState<{
    date: string;
    clientName: string;
    address: string;
    treatment: string;
    notes: string;
    rooms: RoomForm[];
    baitBoxesPlaced: string;
    poisonUsed: string;
    editPhotos: Array<{ storagePath: string; previewUrl: string }>;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPhotoUploading, setEditPhotoUploading] = useState(false);
  const [updatedEntryMessage, setUpdatedEntryMessage] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedReportView[]>([]);
  const [savedViewName, setSavedViewName] = useState('');
  const [savingView, setSavingView] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [overdueBanner, setOverdueBanner] = useState<string | null>(null);

  const reportsTrialPreview = useMemo(() => isActiveTrial({ plan, trialEndsAt }), [plan, trialEndsAt]);

  useEffect(() => {
    const loadUserData = async () => {
      if (isPreviewMode) {
        const mockTechs = [
          { id: 'tech-1', name: 'John Smith', email: 'john@preview.local' },
          { id: 'tech-2', name: 'Sarah Johnson', email: 'sarah@preview.local' },
          { id: 'tech-3', name: 'Mike Williams', email: 'mike@preview.local' },
        ];
        setCompany({ id: 'preview-company', name: 'Pest Trace Preview Co.', email: 'owner@preview.local' });
        setTechnicians(mockTechs);
        setSelectedTechnician(mockTechs[0].id);
        setIsOwner(true);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }

      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const companyRes = await fetch('/api/company', { headers: authHeaders });
      const companyData = companyRes.ok ? await companyRes.json().catch(() => null) : null;

      if (isCompanyOwnerSession(session.user.email, companyData)) {
        setCompany(companyData);

        const subRes = await fetch('/api/subscription', { headers: authHeaders });
        if (subRes.ok) {
          const subData = await subRes.json();
          const queryPlan = typeof router.query.upgradedPlan === 'string' ? router.query.upgradedPlan : undefined;
          setPlan(
            queryPlan && (queryPlan === 'pro' || queryPlan === 'business' || queryPlan === 'enterprise')
              ? queryPlan
              : subData.plan || 'trial',
          );
          setTrialEndsAt(subData.trialEndsAt ? String(subData.trialEndsAt) : null);
          if (
            !hasSubscriptionAccess({
              plan: subData.plan,
              subscriptionStatus: subData.status,
              trialEndsAt: subData.trialEndsAt,
              paymentGraceEndsAt: subData.paymentGraceEndsAt,
              paymentFailedAt: subData.paymentFailedAt,
            })
          ) {
            router.replace('/upgrade');
            return;
          }
          const daysLeft = getGraceDaysLeft({ paymentGraceEndsAt: subData.paymentGraceEndsAt });
          setOverdueBanner(
            daysLeft !== null
              ? `Payment is overdue. You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining before service interruption.`
              : null,
          );
        } else {
          const queryPlan = typeof router.query.upgradedPlan === 'string' ? router.query.upgradedPlan : undefined;
          if (queryPlan && (queryPlan === 'pro' || queryPlan === 'business' || queryPlan === 'enterprise')) {
            setPlan(queryPlan);
          }
          setTrialEndsAt(companyData.trialEndsAt ? String(companyData.trialEndsAt) : null);
        }

        const techRes = await fetch('/api/technicians', { headers: authHeaders });
        const techData: unknown = await techRes.json().catch(() => null);
        const techList = Array.isArray(techData) ? techData : [];
        setTechnicians(techList);
        setSelectedTechnician(techList[0]?.id ?? '');
        if (!techRes.ok) {
          const msg =
            techData &&
            typeof techData === 'object' &&
            'error' in techData &&
            typeof (techData as { error?: string }).error === 'string'
              ? (techData as { error: string }).error
              : 'Unable to load technicians.';
          showToast('Load failed', msg, 'error');
        }
        setIsOwner(true);
        setLoading(false);
        return;
      }

      const technicianProfileRes = await fetch('/api/technician-profile', { headers: authHeaders });
      if (technicianProfileRes.ok) {
        const techData = await technicianProfileRes.json();
        if (techData.technician) {
          setCompany({
            id: techData.technician.companyId,
            name: techData.technician.companyName,
            email: techData.technician.companyId,
          });
          const subRes = await fetch('/api/subscription', { headers: authHeaders });
          if (subRes.ok) {
            const subData = await subRes.json();
            const queryPlan = typeof router.query.upgradedPlan === 'string' ? router.query.upgradedPlan : undefined;
            setPlan(
              queryPlan && (queryPlan === 'pro' || queryPlan === 'business' || queryPlan === 'enterprise')
                ? queryPlan
                : subData.plan || 'trial',
            );
            setTrialEndsAt(subData.trialEndsAt ? String(subData.trialEndsAt) : null);
            if (
              !hasSubscriptionAccess({
                plan: subData.plan,
                subscriptionStatus: subData.status,
                trialEndsAt: subData.trialEndsAt,
                paymentGraceEndsAt: subData.paymentGraceEndsAt,
              })
            ) {
              router.replace('/upgrade');
              return;
            }
            const daysLeft = getGraceDaysLeft({ paymentGraceEndsAt: subData.paymentGraceEndsAt });
            setOverdueBanner(
              daysLeft !== null
                ? `Payment is overdue. You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining before service interruption.`
                : null,
            );
          } else {
            const queryPlan = typeof router.query.upgradedPlan === 'string' ? router.query.upgradedPlan : undefined;
            if (queryPlan && (queryPlan === 'pro' || queryPlan === 'business' || queryPlan === 'enterprise')) {
              setPlan(queryPlan);
            }
          }
          setTechnicians([
            { id: techData.technician.id, name: techData.technician.name, email: techData.technician.email },
          ]);
          setSelectedTechnician(techData.technician.id);
          setIsOwner(false);
          setLoading(false);
          return;
        }
      }

      router.push('/dashboard');
    };

    loadUserData();
  }, [isPreviewMode, router, showToast]);

  useEffect(() => {
    if (!router.isReady) return;
    const queryPlan = typeof router.query.upgradedPlan === 'string' ? router.query.upgradedPlan : undefined;
    const querySessionId = typeof router.query.session_id === 'string' ? router.query.session_id : undefined;
    if (!queryPlan) return;

    setUpgradeConfirmedPlan(queryPlan);
    if (queryPlan === 'pro' || queryPlan === 'business' || queryPlan === 'enterprise') {
      setPlan(queryPlan);
    }

    const planLabel = queryPlan.charAt(0).toUpperCase() + queryPlan.slice(1);
    const upgradeBlurb =
      queryPlan === 'enterprise'
        ? 'Enterprise reporting, analytics, and NPS tools are available.'
        : queryPlan === 'business'
          ? 'Business reporting and analytics are available on this page.'
          : 'Enhanced reporting is available on this page.';
    showToast('Subscription upgraded', `Your plan is now ${planLabel}. ${upgradeBlurb}`, 'success');

    const refreshSubscriptionPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (querySessionId) {
        await fetch('/api/checkout/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ sessionId: querySessionId }),
        }).catch(() => undefined);
      }

      const res = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const subData = await res.json();
      if (subData.plan) {
        setPlan(subData.plan);
      }
      if (subData.trialEndsAt !== undefined) {
        setTrialEndsAt(subData.trialEndsAt ? String(subData.trialEndsAt) : null);
      }
    };

    refreshSubscriptionPlan();
    const refreshTimer = window.setTimeout(refreshSubscriptionPlan, 3000);

    const cleanedQuery = { ...router.query };
    delete cleanedQuery.upgradedPlan;
    delete cleanedQuery.session_id;
    router.replace(
      { pathname: router.pathname, query: cleanedQuery },
      undefined,
      { shallow: true }
    );

    return () => window.clearTimeout(refreshTimer);
  }, [router, showToast]);

  const fetchAnalytics = async (technicianId: string) => {
    setAnalyticsLoading(true);
    setAnalytics(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    const analyticsParams = new URLSearchParams({ technicianId });
    if (startDate) analyticsParams.set('startDate', startDate);
    if (endDate) analyticsParams.set('endDate', endDate);
    const analyticsUrl = `/api/analytics?${analyticsParams.toString()}`;
    const res = await fetch(analyticsUrl, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      setAnalyticsLoading(false);
      return;
    }

    const result = await res.json();
    setAnalytics(normalizeAnalyticsPayload(result));
    setAnalyticsLoading(false);
  };

  const submitEnterpriseNps = async (score: number, comment: string) => {
    setNpsSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      setNpsSubmitting(false);
      return;
    }

    const res = await fetch('/api/enterprise/nps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ score, comment }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unable to save NPS response.' }));
      showToast('NPS save failed', error.error || 'Unable to save NPS response.', 'error');
      setNpsSubmitting(false);
      return;
    }
    showToast('NPS saved', 'Customer NPS response has been recorded.', 'success');
    if (selectedTechnician) {
      await fetchAnalytics(selectedTechnician);
    }
    setNpsSubmitting(false);
  };

  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<'all' | 'follow-up'>('all');
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [quickSearchLoading, setQuickSearchLoading] = useState(false);
  const [quickSearchResults, setQuickSearchResults] = useState<SearchHit[]>([]);
  const [quickSearchFocusedIndex, setQuickSearchFocusedIndex] = useState(0);

  useEffect(() => {
    if (!router.isReady) return;

    const querySearch = typeof router.query.search === 'string' ? router.query.search : '';
    const queryStartDate = typeof router.query.startDate === 'string' ? router.query.startDate : '';
    const queryEndDate = typeof router.query.endDate === 'string' ? router.query.endDate : '';
    const queryFollowUpOnly =
      router.query.followUpOnly === '1' ||
      router.query.followUpOnly === 'true';

    if (querySearch) setSearch(querySearch);
    if (queryStartDate) setStartDate(queryStartDate);
    if (queryEndDate) setEndDate(queryEndDate);
    if (queryFollowUpOnly) setJobFilter('follow-up');
  }, [router.isReady, router.query.search, router.query.startDate, router.query.endDate, router.query.followUpOnly]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuickSearchOpen(true);
        setQuickSearchQuery(search.trim());
      } else if (event.key === 'Escape') {
        setQuickSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [search]);

  useEffect(() => {
    if (!quickSearchOpen) return;
    const timeout = window.setTimeout(async () => {
      const term = quickSearchQuery.trim();
      if (!term) {
        setQuickSearchResults([]);
        setQuickSearchFocusedIndex(0);
        return;
      }
      setQuickSearchLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setQuickSearchResults([]);
        setQuickSearchLoading(false);
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setQuickSearchLoading(false);
        return;
      }
      const data = (await res.json().catch(() => [])) as SearchHit[];
      setQuickSearchResults(Array.isArray(data) ? data : []);
      setQuickSearchFocusedIndex(0);
      setQuickSearchLoading(false);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [quickSearchOpen, quickSearchQuery]);

  const visibleEntries = useMemo(
    () =>
      report
        ? report.entries.filter((entry) => (jobFilter === 'follow-up' ? entryNeedsFollowUp(entry) : true))
        : [],
    [report, jobFilter],
  );
  const reportHeatmapPoints = useMemo(
    () => buildHeatmapPointsFromReportEntries(visibleEntries),
    [visibleEntries],
  );
  const clientTimeline = useMemo(() => {
    const map = new Map<string, ReportEntry[]>();
    for (const entry of visibleEntries) {
      const current = map.get(entry.clientName) ?? [];
      current.push(entry);
      map.set(entry.clientName, current);
    }
    return [...map.entries()]
      .map(([client, items]) => ({
        client,
        items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }))
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 8);
  }, [visibleEntries]);

  useEffect(() => {
    setSelectedEntryIds((prev) => prev.filter((id) => visibleEntries.some((entry) => entry.id === id)));
  }, [visibleEntries]);

  useEffect(() => {
    const loadSavedViews = async () => {
      if (!isOwner || isPreviewMode) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/report-views', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      setSavedViews(Array.isArray(data) ? data : []);
    };
    if (!loading) {
      loadSavedViews();
    }
  }, [isOwner, loading, isPreviewMode]);

  const buildCurrentFilters = () => ({
    technicianId: selectedTechnician || undefined,
    search: search.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    followUpOnly: jobFilter === 'follow-up',
  });

  const applySavedView = (view: SavedReportView) => {
    setSelectedTechnician(view.filters.technicianId || selectedTechnician);
    setSearch(view.filters.search || '');
    setStartDate(view.filters.startDate || '');
    setEndDate(view.filters.endDate || '');
    setJobFilter(view.filters.followUpOnly ? 'follow-up' : 'all');
    showToast('View applied', `Loaded "${view.name}".`, 'success');
  };

  const saveCurrentView = async () => {
    if (!isOwner) return;
    const name = savedViewName.trim();
    if (!name) {
      showToast('Name required', 'Give this saved view a name first.', 'error');
      return;
    }
    setSavingView(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.push('/auth/signin');
      return;
    }
    const res = await fetch('/api/report-views', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name,
        filters: buildCurrentFilters(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unable to save view.' }));
      showToast('Save failed', err.error || 'Unable to save view.', 'error');
      setSavingView(false);
      return;
    }
    const created = (await res.json().catch(() => null)) as SavedReportView | null;
    if (created) {
      setSavedViews((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
    }
    setSavedViewName('');
    setSavingView(false);
    showToast('Saved', 'Report view saved for quick reuse.', 'success');
  };

  const deleteSavedView = async (viewId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.push('/auth/signin');
      return;
    }
    const res = await fetch(`/api/report-views?id=${encodeURIComponent(viewId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      showToast('Delete failed', 'Unable to remove saved view.', 'error');
      return;
    }
    setSavedViews((prev) => prev.filter((view) => view.id !== viewId));
    showToast('Deleted', 'Saved view removed.', 'success');
  };

  const runBulkAction = async (action: 'set_status' | 'delete', status?: 'open' | 'completed' | 'cancelled') => {
    if (!isOwner) return;
    if (!selectedEntryIds.length) {
      showToast('No selection', 'Select one or more jobs first.', 'error');
      return;
    }
    setBulkActionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.push('/auth/signin');
      return;
    }
    const res = await fetch('/api/logbook-entries/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action,
        status,
        entryIds: selectedEntryIds,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bulk action failed.' }));
      showToast('Bulk action failed', err.error || 'Bulk action failed.', 'error');
      setBulkActionLoading(false);
      return;
    }
    setReport((prev) => {
      if (!prev) return prev;
      if (action === 'delete') {
        return {
          ...prev,
          entries: prev.entries.filter((entry) => !selectedEntryIds.includes(entry.id)),
        };
      }
      return {
        ...prev,
        entries: prev.entries.map((entry) =>
          selectedEntryIds.includes(entry.id)
            ? { ...entry, status: status || entry.status }
            : entry,
        ),
      };
    });
    const affected = selectedEntryIds.length;
    setSelectedEntryIds([]);
    setBulkActionLoading(false);
    showToast('Bulk action complete', `${affected} job(s) updated.`, 'success');
  };

  const fetchReport = async () => {
    if (!selectedTechnician) {
      showToast('Missing filters', 'Select a technician first.', 'error');
      return;
    }

    setFetching(true);
    setReportGeneratedMessage(null);
    const reportParams = new URLSearchParams({ technicianId: selectedTechnician });
    if (startDate) reportParams.set('startDate', startDate);
    if (endDate) reportParams.set('endDate', endDate);
    let apiUrl = `/api/reports?${reportParams.toString()}`;
    if (search.trim()) {
      apiUrl += `&search=${encodeURIComponent(search.trim())}`;
    }
    if (jobFilter === 'follow-up') {
      apiUrl += '&followUpOnly=1';
    }

    if (isPreviewMode) {
      const selectedName = technicians.find((t) => t.id === selectedTechnician)?.name || 'Technician';
      const previewReport = {
        companyName: company?.name || 'Pest Trace Preview Co.',
        entries: [
          {
            id: 'entry-1',
            date: startDate || new Date().toISOString(),
            clientName: 'Riverside Restaurant',
            address: '45 High Street, Manchester',
            treatment: 'Rodenticide Bait Stations',
            notes: 'Installed 6 bait stations and reviewed prevention advice.',
            photoUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200',
            photoUrls: ['https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200'],
          },
          {
            id: 'entry-2',
            date: endDate || new Date().toISOString(),
            clientName: 'City Warehouse Ltd',
            address: '12 Industrial Estate, Leeds',
            treatment: 'Rodent Monitoring',
            notes: 'Quarterly inspection complete with no active findings.',
            photoUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
            photoUrls: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200'],
          },
        ],
        certifications: [
          {
            id: 'cert-1',
            fileUrl: '#',
            uploadedAt: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      };
      setReport(previewReport);
      setReportGeneratedMessage(`Preview report ready with ${previewReport.entries.length} jobs and ${previewReport.certifications.length} certifications.`);
      showToast('Preview mode', `Generated preview report for ${selectedName}.`, 'info');
      setFetching(false);
      return;
    }

    setFetching(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (!res.ok) {
      const error = await res.json();
      showToast('Report failed', error.error || 'Failed to load report', 'error');
      setFetching(false);
      return;
    }

    const result = await res.json();
    setReport(result);
    setReportGeneratedMessage(
      `Report ready with ${result.entries.length} jobs, ${result.certifications.length} certifications, and ${result.entries.reduce((count: number, entry: ReportEntry) => count + parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos).length, 0)} photos.`
    );
    if (Array.isArray(result.entries) && result.entries.length > 0) {
      void fetch('/api/activation/report-generated', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }).catch(() => undefined);
    }
    if (plan === 'business' || plan === 'enterprise' || reportsTrialPreview) {
      await fetchAnalytics(selectedTechnician);
    } else {
      setAnalytics(null);
    }
    setFetching(false);
  };

  const openQuickSearch = () => {
    setQuickSearchOpen(true);
    setQuickSearchQuery(search.trim());
  };

  const applyQuickSearchHit = (hit: SearchHit) => {
    setSearch(hit.title);
    setQuickSearchOpen(false);
    showToast('Search applied', `Using "${hit.title}" in report filters.`, 'success');
  };

  const deleteReportEntry = async (entryId: string) => {
    if (!confirm('Delete this job from the report? This cannot be undone.')) return;
    setDeletingEntryId(entryId);
    const previousReport = report;
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.filter((entry) => entry.id !== entryId),
      };
    });

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/logbook-entries/${entryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (!res.ok) {
      setReport(previousReport);
      const error = await res.json().catch(() => ({ error: 'Failed to delete report entry' }));
      showToast('Delete failed', error.error || 'Failed to delete report entry', 'error');
      setDeletingEntryId(null);
      return;
    }
    showToast('Deleted', 'Job removed from report successfully.', 'success');
    setDeletingEntryId(null);
  };

  const deleteCertification = async (certId: string) => {
    if (!confirm('Delete this certificate? This cannot be undone.')) return;
    setDeletingCertificationId(certId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.push('/auth/signin');
      return;
    }

    const res = await fetch(`/api/certifications/${certId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Failed to delete certificate' }));
      showToast('Delete failed', data.error || 'Failed to delete certificate', 'error');
      setDeletingCertificationId(null);
      return;
    }

    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        certifications: prev.certifications.filter((cert) => cert.id !== certId),
      };
    });

    showToast('Deleted', 'Certificate removed successfully.', 'success');
    setDeletingCertificationId(null);
  };

  const clearEditingEntry = () => {
    setEditingEntryState((prev) => {
      if (prev?.editPhotos) {
        for (const p of prev.editPhotos) {
          if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
        }
      }
      return null;
    });
    setEditingEntryId(null);
  };

  const startEditingEntry = (entry: ReportEntry) => {
    setEditingEntryState((prev) => {
      if (prev?.editPhotos) {
        for (const p of prev.editPhotos) {
          if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
        }
      }
      const paths = entry.photoStoragePaths ?? [];
      const previews = parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos);
      const editPhotos = paths.map((storagePath, i) => ({
        storagePath,
        previewUrl: previews[i] || '',
      }));
      const rawDate = entry.date || '';
      const dateInput = rawDate.includes('T') ? rawDate.slice(0, 10) : rawDate.slice(0, 10);
      return {
        date: dateInput,
        clientName: entry.clientName,
        address: entry.address,
        treatment: entry.treatment,
        notes: entry.notes || '',
        rooms: parseRoomForms(entry.rooms),
        baitBoxesPlaced: entry.baitBoxesPlaced || '',
        poisonUsed: entry.poisonUsed || '',
        editPhotos,
      };
    });
    setEditingEntryId(entry.id);
  };

  const updateEditingRoom = (index: number, field: keyof RoomForm, value: string) => {
    if (!editingEntryState) return;
    const nextRooms = [...editingEntryState.rooms];
    nextRooms[index] = { ...nextRooms[index], [field]: value };
    setEditingEntryState({ ...editingEntryState, rooms: nextRooms });
  };

  const addEditingRoom = () => {
    if (!editingEntryState) return;
    setEditingEntryState({
      ...editingEntryState,
      rooms: [...editingEntryState.rooms, { name: '', note: '' }],
    });
  };

  const removeEditingRoom = (index: number) => {
    if (!editingEntryState) return;
    const nextRooms = editingEntryState.rooms.filter((_, i) => i !== index);
    setEditingEntryState({ ...editingEntryState, rooms: nextRooms });
  };

  const removeEditPhotoSlot = (index: number) => {
    if (!editingEntryState) return;
    const target = editingEntryState.editPhotos[index];
    if (target?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
    const next = editingEntryState.editPhotos.filter((_, i) => i !== index);
    setEditingEntryState({ ...editingEntryState, editPhotos: next });
  };

  const handleEditPhotosChange = async (files: FileList | null) => {
    if (isPreviewMode) {
      showToast('Preview mode', 'Photo uploads are disabled in preview mode.', 'info');
      return;
    }
    if (!files?.length || !editingEntryState || !company?.id || !selectedTechnician) return;
    const remaining = 4 - editingEntryState.editPhotos.length;
    if (remaining <= 0) {
      showToast('Photo limit', 'You can attach up to four photos per job.', 'info');
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    setEditPhotoUploading(true);
    const additions: Array<{ storagePath: string; previewUrl: string }> = [];
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      const sanitizedFileName = file.name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-._]/g, '');
      const filePath = `${company.id}/${selectedTechnician}/${Date.now()}-${index}-${sanitizedFileName}`;
      const previewUrl = URL.createObjectURL(file);
      const { error: uploadError } = await supabase.storage.from('logbook-photos').upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) {
        URL.revokeObjectURL(previewUrl);
        showToast('Upload failed', uploadError.message, 'error');
        setEditPhotoUploading(false);
        return;
      }
      additions.push({ storagePath: filePath, previewUrl });
    }
    setEditingEntryState({
      ...editingEntryState,
      editPhotos: [...editingEntryState.editPhotos, ...additions],
    });
    setEditPhotoUploading(false);
  };

  const saveEditedEntry = async () => {
    if (!editingEntryId || !editingEntryState) return;
    if (!selectedTechnician) {
      showToast('Save failed', 'Select a technician before saving.', 'error');
      return;
    }

    setSavingEdit(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setSavingEdit(false);
      router.push('/auth/signin');
      return;
    }

    const roomsPayload = editingEntryState.rooms
      .map((room) => ({ name: room.name.trim(), note: room.note.trim() }))
      .filter((room) => room.name.length > 0);

    const photoUrlsPayload = editingEntryState.editPhotos.map((p) => p.storagePath).filter(Boolean);

    const res = await fetch(`/api/logbook-entries/${editingEntryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        date: editingEntryState.date,
        clientName: editingEntryState.clientName,
        address: editingEntryState.address,
        treatment: editingEntryState.treatment,
        notes: editingEntryState.notes || undefined,
        technicianIds: [selectedTechnician],
        rooms: roomsPayload.length > 0 ? roomsPayload : undefined,
        baitBoxesPlaced: editingEntryState.baitBoxesPlaced || undefined,
        poisonUsed: editingEntryState.poisonUsed || undefined,
        photoUrls: photoUrlsPayload,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unable to save edit' }));
      showToast('Save failed', error.error || 'Failed to save report entry', 'error');
      setSavingEdit(false);
      return;
    }

    for (const p of editingEntryState.editPhotos) {
      if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
    }

    showToast('Updated', 'Report entry updated successfully.', 'success');
    setUpdatedEntryMessage('Report entry updated successfully.');
    setEditingEntryId(null);
    setEditingEntryState(null);
    setSavingEdit(false);

    await fetchReport();

    window.setTimeout(() => {
      setUpdatedEntryMessage(null);
    }, 4500);
  };

  const downloadPdf = async () => {
    if (!report || !company) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    const captionWidth = contentWidth - 8;
    let y = 24;

    const addHeader = () => {
      doc.setFillColor(14, 55, 121);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text(company.name || company.email, margin, 14);
      doc.setFontSize(10);
      doc.text('Compliance Report • Pest Trace', margin, 24);
      doc.setFontSize(10);
      doc.text(`Period: ${formatPeriodLabel(startDate, endDate, formatDate, t)}`, pageWidth - margin, 14, { align: 'right' });
      const technicianName = technicians.find((t) => t.id === selectedTechnician)?.name || 'All technicians';
      doc.text(`Technician: ${technicianName}`, pageWidth - margin, 24, { align: 'right' });
      y = 36;
    };

    const addFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
        doc.setPage(pageIndex);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${formatDate(new Date())}`, margin, pageHeight - 10);
        doc.text(`Page ${pageIndex} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 24) {
        doc.addPage();
        addHeader();
      }
    };

    addHeader();

    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text('Report overview', margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(75, 85, 99);
    const summaryItems = [
      `Total jobs included: ${report.entries.length}`,
      `Photos included: ${report.entries.reduce((count, entry) => count + parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos).length, 0)}`,
      `Certifications included: ${report.certifications.length}`,
    ];
    summaryItems.forEach((item) => {
      doc.text(item, margin, y);
      y += 7;
    });

    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    for (const entry of report.entries) {
      const entryPhotos = parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos).slice(0, 3);
      const details = [
        entry.rooms && `Rooms: ${entry.rooms.join(', ')}`,
        entry.baitBoxesPlaced && `Bait Boxes: ${entry.baitBoxesPlaced}`,
        entry.poisonUsed && `Poison Used: ${entry.poisonUsed}`,
      ].filter(Boolean) as string[];
      const notesLines = entry.notes ? doc.splitTextToSize(`Notes: ${entry.notes}`, captionWidth) : [];
      const headerHeight = 8 + 7 + 8;
      const detailHeights = details.reduce((sum, detail) => {
        const detailLines = doc.splitTextToSize(detail, captionWidth);
        return sum + detailLines.length * 6 + 3;
      }, 0);
      const notesHeight = notesLines.length > 0 ? notesLines.length * 6 + 6 : 0;
      const imageHeight = entryPhotos.length > 0 ? 36 + 8 : 0;
      const blockHeight = headerHeight + detailHeights + notesHeight + imageHeight + 24;
      ensureSpace(blockHeight + 10);

      doc.setFillColor(249, 250, 253);
      doc.roundedRect(margin, y, contentWidth, blockHeight, 6, 6, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, blockHeight, 6, 6, 'S');

      let entryY = y + 10;
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text(`${formatDateTimeWithZone(entry.date)} · ${entry.clientName}`, margin + 6, entryY);
      entryY += 8;

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Address: ${entry.address}`, margin + 6, entryY);
      entryY += 7;
      doc.text(`Treatment: ${entry.treatment || 'N/A'}`, margin + 6, entryY);
      entryY += 8;

      details.forEach((detail) => {
        const detailLines = doc.splitTextToSize(detail, captionWidth);
        doc.text(detailLines, margin + 6, entryY);
        entryY += detailLines.length * 6 + 3;
      });

      if (notesLines.length > 0) {
        entryY += 4;
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        doc.text(notesLines, margin + 6, entryY);
        entryY += notesHeight;
      }

      if (entryPhotos.length > 0) {
        const imageTop = entryY + 6;
        const imageWidth = Math.min((contentWidth - 14 - (entryPhotos.length - 1) * 4) / entryPhotos.length, 60);
        let imageX = margin + 6;
        for (const photoUrl of entryPhotos) {
          try {
            const base64 = await fetchImageAsBase64(photoUrl);
            if (base64) {
              doc.addImage(base64, 'JPEG', imageX, imageTop, imageWidth, imageHeight);
            }
          } catch {
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text('Photo unavailable', imageX, imageTop + 10);
          }
          imageX += imageWidth + 4;
        }
        entryY = imageTop + imageHeight + 8;
      }

      y += blockHeight + 10;
    }

    if (report.certifications.length > 0) {
      ensureSpace(60);
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text('Certifications', margin, y);
      y += 10;
      doc.setFontSize(11);
      doc.setTextColor(75, 85, 99);

      report.certifications.forEach((cert) => {
        ensureSpace(24);
        const certName = cert.fileUrl.split('/').pop() || cert.fileUrl;
        const certLines = doc.splitTextToSize(
          `Uploaded: ${formatDateTimeWithZone(cert.uploadedAt)} · Expiry: ${cert.expiryDate ? formatDateTimeWithZone(cert.expiryDate) : t('reports.noExpiry')}`,
          captionWidth,
        );
        const certLineHeight = doc.getTextDimensions(certLines).h;
        doc.text(certLines, margin + 6, y);
        y += certLineHeight;
        const fileLines = doc.splitTextToSize(`File: ${certName}`, captionWidth);
        const fileLineHeight = doc.getTextDimensions(fileLines).h;
        doc.text(fileLines, margin + 6, y);
        y += fileLineHeight + 8;
      });
    }

    addFooter();
    const technicianName = technicians.find((t) => t.id === selectedTechnician)?.name || 'report';
    const filename = `pesttrace-report-${sanitizeFilename(technicianName) || 'report'}.pdf`;
    const pdfBlob = doc.output('blob');
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);

    showToast('Report downloaded', 'Your printable A4 report has been generated successfully.', 'success');

    const { data: { session: pdfSession } } = await supabase.auth.getSession();
    void fetch('/api/activation/report-generated', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pdfSession?.access_token}` },
    }).catch(() => undefined);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-offwhite">Loading report tools...</div>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-offwhite">
      <div className="flex min-w-0">
        <Sidebar role={isOwner ? 'owner' : 'technician'} activeTab="reports" onSignOut={async () => {
          if (isPreviewMode) {
            router.push('/auth/signin');
            return;
          }
          await supabase.auth.signOut();
          router.push('/auth/signin');
        }} />
        <div className="min-w-0 flex-1 px-4 pb-6 pt-20 sm:px-6 sm:pb-8 sm:pt-24 lg:px-8">
      <div className="min-w-0 max-w-6xl space-y-6">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-navy mb-3">{t('reports.pageTitle')}</h1>
            <div className="mx-auto h-1 w-16 bg-primary-500 rounded-full mb-4"></div>
            <p className="text-sm text-gray-600">{t('reports.pageSubtitle')}</p>
          </div>
        </div>
        {overdueBanner ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
            <p className="font-semibold">{overdueBanner}</p>
            <p className="mt-1">Update payment details from billing to avoid interruption.</p>
          </div>
        ) : null}

        {upgradeConfirmedPlan ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-sm">
            <p className="font-semibold">Your subscription has been upgraded to {upgradeConfirmedPlan}.</p>
            <p className="mt-1">Enhanced reporting and compliance tools are now available on this page.</p>
          </div>
        ) : null}

        {reportGeneratedMessage ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-100 p-5 text-sm text-slate-800 shadow-sm">
            <p className="font-semibold">Report ready</p>
            <p className="mt-1">{reportGeneratedMessage}</p>
          </div>
        ) : null}

        {updatedEntryMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950 shadow-sm">
            <p className="font-semibold">Changes saved</p>
            <p className="mt-1">{updatedEntryMessage}</p>
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="form-group">
              <label htmlFor="search" className="form-label">Search reports</label>
              <div className="flex gap-2">
                <input
                  id="search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Client, address, treatment..."
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={openQuickSearch}
                  className="btn btn-secondary btn-sm whitespace-nowrap px-3"
                  aria-label="Open quick search palette"
                >
                  Ctrl/Cmd+K
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchReport}
              className="btn btn-primary hover-lift h-fit"
              disabled={fetching}
            >
              {fetching ? (
                <>
                  <span className="spinner"></span>
                  <span>Fetching...</span>
                </>
              ) : (
                'Fetch Report'
              )}
            </button>
          </div>
          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Advanced filters
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {!isOwner ? (
                <div className="form-group">
                  <label className="form-label">Technician</label>
                  <div className="form-input bg-white text-slate-700 px-3 py-2 rounded-xl">
                    {technicians[0]?.name || 'Loading...'}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="technician-select" className="form-label">Technician</label>
                  <select
                    id="technician-select"
                    value={selectedTechnician}
                    onChange={(e) => setSelectedTechnician(e.target.value)}
                    className="form-select"
                  >
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label htmlFor="start-date" className="form-label">Start date</label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-input bg-white"
                />
              </div>
              <div className="form-group">
                <label htmlFor="end-date" className="form-label">End date</label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-input bg-white"
                />
              </div>
            </div>
          </details>
          {isOwner ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="form-group lg:flex-1">
                  <label htmlFor="saved-view-name" className="form-label">Save current filters as</label>
                  <input
                    id="saved-view-name"
                    type="text"
                    value={savedViewName}
                    onChange={(event) => setSavedViewName(event.target.value)}
                    placeholder="e.g. Weekly follow-ups"
                    className="form-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveCurrentView}
                  disabled={savingView}
                  className="btn btn-secondary"
                >
                  {savingView ? 'Saving...' : 'Save View'}
                </button>
              </div>
              {savedViews.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {savedViews.map((view) => (
                    <div key={view.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-700 hover:text-slate-900"
                        onClick={() => applySavedView(view)}
                      >
                        {view.name}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800"
                        onClick={() => deleteSavedView(view.id)}
                        aria-label={`Delete saved view ${view.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {quickSearchOpen ? (
          <div className="fixed inset-0 z-[95] bg-black/35 p-4" onClick={() => setQuickSearchOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reports-quick-search-title"
              className="mx-auto mt-16 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-slate-200 px-4 py-3">
                <p id="reports-quick-search-title" className="text-sm font-semibold text-slate-800">
                  Quick Search (Ctrl/Cmd + K)
                </p>
                <input
                  autoFocus
                  value={quickSearchQuery}
                  onChange={(event) => setQuickSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setQuickSearchFocusedIndex((index) => Math.min(quickSearchResults.length - 1, index + 1));
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setQuickSearchFocusedIndex((index) => Math.max(0, index - 1));
                    } else if (event.key === 'Enter' && quickSearchResults[quickSearchFocusedIndex]) {
                      event.preventDefault();
                      applyQuickSearchHit(quickSearchResults[quickSearchFocusedIndex]);
                    }
                  }}
                  placeholder="Search client, address, treatment..."
                  className="form-input mt-2"
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {quickSearchLoading ? (
                  <p className="px-3 py-2 text-sm text-slate-500">Searching...</p>
                ) : quickSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">Type to search report records.</p>
                ) : (
                  quickSearchResults.map((hit, index) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => applyQuickSearchHit(hit)}
                      className={`w-full rounded-lg px-3 py-2 text-left ${
                        index === quickSearchFocusedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">{hit.title}</p>
                      <p className="text-xs text-slate-500">{hit.subtitle}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {report && (
          <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 space-y-6">
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex-1 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-navy mb-2">
                  {isOwner ? t('reports.resultsTitleOwner') : t('reports.resultsTitleTech')}
                </h2>
                <p className="text-sm text-slate-600">{t('reports.resultsSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={downloadPdf}
                className="btn btn-success hover-lift w-full px-5 py-3 sm:w-auto"
              >
                {t('reports.downloadPdf')}
              </button>
            </div>

            {/* Report Summary */}
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 sm:p-6">
              <div className="grid gap-2 sm:grid-cols-3 text-sm sm:text-base">
                <div>
                  <p className="text-gray-600">{t('reports.company')}</p>
                  <p className="font-semibold text-navy">{report.companyName}</p>
                </div>
                <div>
                  <p className="text-gray-600">{t('reports.technician')}</p>
                  <p className="font-semibold text-navy">{technicians.find((t) => t.id === selectedTechnician)?.name || ''}</p>
                </div>
                <div>
                  <p className="text-gray-600">{t('reports.period')}</p>
                  <p className="font-semibold text-navy">{formatPeriodLabel(startDate, endDate, formatDate, t)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.jobs')}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{visibleEntries.length}</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.photos')}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{visibleEntries.reduce((count, entry) => count + parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos).length, 0)}</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.certifications')}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{report.certifications.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-violet-700">{t('reports.complianceNoticeTitle')}</p>
              <p className="mt-2 text-sm font-medium text-violet-900">
                {complianceNotice}{country === 'EU' ? '' : ` (${country})`}
              </p>
            </div>

            {(plan === 'business' || plan === 'enterprise' || reportsTrialPreview) ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-navy">Business insights</h3>
                    <p className="text-sm text-slate-600">Advanced analytics, technician performance tracking, and route planning for your team.</p>
                  </div>
                  {analyticsLoading ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                      <span className="spinner" /> Loading analytics...
                    </span>
                  ) : null}
                </div>

                {analytics ? (
                  <div className="mt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total jobs</p>
                        <p className="mt-2 text-2xl font-semibold text-navy">{analytics.totalJobs}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Completed</p>
                        <p className="mt-2 text-2xl font-semibold text-navy">{analytics.completedJobs}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Open jobs</p>
                        <p className="mt-2 text-2xl font-semibold text-navy">{analytics.openJobs}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Avg duration</p>
                        <p className="mt-2 text-2xl font-semibold text-navy">{analytics.averageDurationMinutes !== null ? `${analytics.averageDurationMinutes} min` : 'N/A'}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h4 className="text-lg font-semibold text-navy">Regional job density</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        From UK postcodes on each job (or address). District-level positions — same engine as platform intelligence heatmaps.
                      </p>
                      <div className="mt-4">
                        <IntelligenceGeoHeatmap points={reportHeatmapPoints} cols={40} rows={28} />
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h4 className="text-lg font-semibold text-navy">Route optimization</h4>
                        <p className="text-sm text-slate-600 mt-2">A recommended sequence for upcoming jobs based on schedule.</p>
                        {analytics.routePlan.length === 0 ? (
                          <p className="mt-4 text-sm text-slate-500">No route data available for this range.</p>
                        ) : (
                          <ol className="mt-4 space-y-3">
                            {analytics.routePlan.map((stop, index) => (
                              <li key={`${stop.address}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-semibold text-slate-900">Stop {index + 1}</span>
                                  <span className="text-xs uppercase text-slate-500">{stop.scheduledAt}</span>
                                </div>
                                <p className="mt-2 text-base font-semibold text-navy">{stop.clientName}</p>
                                <p className="text-sm text-slate-600">{stop.address}</p>
                                <p className="mt-1 text-sm text-slate-500">{stop.treatment}</p>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h4 className="text-lg font-semibold text-navy">Technician performance</h4>
                        <p className="text-sm text-slate-600 mt-2">Team productivity based on completed work and job duration.</p>
                        <div className="mt-4 grid gap-3">
                          {analytics.technicianPerformance.slice(0, 4).map((tech) => (
                            <div key={tech.technicianName} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-sm font-semibold text-slate-900">{tech.technicianName}</p>
                              <p className="text-xs text-slate-500">Jobs: {tech.jobs}</p>
                              <p className="text-xs text-slate-500">Avg duration: {tech.averageDurationMinutes !== null ? `${tech.averageDurationMinutes} min` : 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
                      <h4 className="text-lg font-semibold text-navy">Security & compliance pulse</h4>
                      <div className="mt-3 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Missing photos</p>
                          <p className="mt-2 text-xl font-semibold text-navy">{analytics.auditSummary.missingPhotos}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Missing signatures</p>
                          <p className="mt-2 text-xl font-semibold text-navy">{analytics.auditSummary.missingSignatures}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Open jobs</p>
                          <p className="mt-2 text-xl font-semibold text-navy">{analytics.auditSummary.missingStatus}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                      <h4 className="text-lg font-semibold text-emerald-900">Revenue & Efficiency (Business Plan)</h4>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <p className="text-sm text-emerald-800">
                          Avg Customer Lifetime Value: <span className="font-bold">{formatCurrency(analytics.clvScore ?? 1240)}</span>
                        </p>
                        <p className="text-sm text-emerald-800">CLV/CAC Ratio: <span className="font-bold">{analytics.cacRatio || '3.2'}x</span></p>
                      </div>
                    </div>

                    {(plan === 'enterprise' || reportsTrialPreview) ? (
                      <EnterprisePerformanceMetrics
                        analytics={analytics}
                        onSubmitNps={submitEnterpriseNps}
                        npsSubmitting={npsSubmitting}
                      />
                    ) : null}
                  </div>

                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    Business analytics will appear after you fetch the report.
                  </div>
                )}
              </div>
            ) : (
              <Card className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-navy">Upgrade to Business</h3>
                    <p className="text-sm text-slate-600">Unlock advanced reporting, route optimization, and technician performance tracking.</p>
                  </div>
                  <button type="button" onClick={() => router.push('/upgrade')} className="btn btn-primary">
                    Upgrade to Business
                  </button>
                </div>
              </Card>
            )}

            {/* Jobs Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl sm:text-2xl font-bold text-navy">📋 Jobs ({visibleEntries.length})</h3>
                <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setJobFilter('all')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      jobFilter === 'all' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    All Jobs
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobFilter('follow-up')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      jobFilter === 'follow-up' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Needs Follow-up
                  </button>
                </div>
              </div>
              {isOwner && visibleEntries.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.length > 0 && selectedEntryIds.length === visibleEntries.length}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedEntryIds(visibleEntries.map((entry) => entry.id));
                            } else {
                              setSelectedEntryIds([]);
                            }
                          }}
                        />
                        Select all visible jobs
                      </label>
                      <span className="text-sm text-slate-500">{selectedEntryIds.length} selected</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={bulkActionLoading} onClick={() => runBulkAction('set_status', 'open')}>
                        Mark Open
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={bulkActionLoading} onClick={() => runBulkAction('set_status', 'completed')}>
                        Mark Completed
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={bulkActionLoading} onClick={() => runBulkAction('set_status', 'cancelled')}>
                        Mark Cancelled
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={bulkActionLoading} onClick={() => runBulkAction('delete')}>
                        {bulkActionLoading ? 'Applying...' : 'Delete Selected'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {visibleEntries.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-500">
                  {jobFilter === 'follow-up'
                    ? 'No follow-up jobs found for this range.'
                    : 'No jobs found for this range.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover-lift transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1">
                          {isOwner ? (
                            <label className="mb-2 inline-flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={selectedEntryIds.includes(entry.id)}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    setSelectedEntryIds((prev) => Array.from(new Set([...prev, entry.id])));
                                  } else {
                                    setSelectedEntryIds((prev) => prev.filter((id) => id !== entry.id));
                                  }
                                }}
                              />
                              Select
                            </label>
                          ) : null}
                          <h4 className="text-lg font-semibold text-navy">{entry.clientName}</h4>
                          <p className="text-sm text-gray-600">{entry.address}</p>
                          <p className="text-xs sm:text-sm text-gray-500 mt-1">
                            {t('reports.date')}: {formatDate(entry.date)}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {t('reports.time')}: {formatTimeWithZone(entry.date)}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="inline-flex max-w-full rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 break-words">{entry.treatment}</span>
                          <span className={`inline-flex max-w-full rounded-full border px-3 py-1 text-sm font-medium break-words ${entry.status?.trim().toLowerCase() === 'open' || !entry.status ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-emerald-200 bg-emerald-100 text-emerald-800'}`}>
                            {entry.status?.trim() ? entry.status : t('reports.open')}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditingEntry(entry)}
                            className="btn btn-secondary btn-sm"
                          >
                            {editingEntryId === entry.id ? 'Editing' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteReportEntry(entry.id)}
                            disabled={deletingEntryId === entry.id}
                            className="btn btn-danger btn-sm"
                          >
                            {deletingEntryId === entry.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm text-gray-600">
                        {entry.followUpDate && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs uppercase tracking-[0.24em] text-amber-700">{t('reports.followUpDate')}</p>
                            <p className="mt-1 font-semibold text-amber-900">{formatDateTimeWithZone(entry.followUpDate)}</p>
                          </div>
                        )}
                        {entry.rooms && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.rooms')}</p>
                            <p className="mt-1 font-semibold text-slate-900">{formatRoomSummary(entry.rooms) || 'No rooms added'}</p>
                          </div>
                        )}
                        {entry.baitBoxesPlaced && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.baitBoxes')}</p>
                            <p className="mt-1 font-semibold text-slate-900">{entry.baitBoxesPlaced}</p>
                          </div>
                        )}
                        {entry.poisonUsed && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.poisonUsed')}</p>
                            <p className="mt-1 font-semibold text-slate-900">{entry.poisonUsed}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm text-gray-600">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.notes')}</p>
                          <p className="mt-1 font-semibold text-slate-900">{entry.notes ? entry.notes.slice(0, 90) : 'No additional notes'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.photos')}</p>
                          <p className="mt-1 font-semibold text-slate-900">{parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos).length}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('reports.signature')}</p>
                          <p className="mt-1 font-semibold text-slate-900">{entry.signature ? 'Captured' : 'Not captured'}</p>
                        </div>
                      </div>
                      {entry.notes ? (
                        <p className="mt-4 text-gray-600 text-sm leading-6">{entry.notes}</p>
                      ) : null}
                      {(entry.status?.toLowerCase() === 'cancelled' || entry.status?.toLowerCase() === 'canceled') && entry.recommendation ? (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-rose-700">Cancellation reason</p>
                          <p className="mt-1 text-sm font-medium text-rose-900">{entry.recommendation}</p>
                        </div>
                      ) : null}
                      {editingEntryId === entry.id && editingEntryState ? (
                        <div className="mt-6 rounded-2xl border border-primary-200 bg-primary-50 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <h5 className="text-base font-semibold text-primary-900">Edit report entry</h5>
                            <button type="button" onClick={clearEditingEntry} className="text-sm text-primary-700 hover:text-primary-900">Cancel</button>
                          </div>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <FormInput label="Client Name" id={`edit-client-${entry.id}`} value={editingEntryState.clientName} onChange={(e) => setEditingEntryState({ ...editingEntryState, clientName: e.target.value })} />
                            <FormInput label="Address" id={`edit-address-${entry.id}`} value={editingEntryState.address} onChange={(e) => setEditingEntryState({ ...editingEntryState, address: e.target.value })} />
                            <FormInput label="Treatment" id={`edit-treatment-${entry.id}`} value={editingEntryState.treatment} onChange={(e) => setEditingEntryState({ ...editingEntryState, treatment: e.target.value })} />
                            <FormInput label="Date" id={`edit-date-${entry.id}`} type="date" value={editingEntryState.date} onChange={(e) => setEditingEntryState({ ...editingEntryState, date: e.target.value })} />
                          </div>
                          <div className="mt-4 grid gap-4">
                            <FormInput label="Job Notes" id={`edit-notes-${entry.id}`} as="textarea" value={editingEntryState.notes} onChange={(e) => setEditingEntryState({ ...editingEntryState, notes: e.target.value })} />
                          </div>
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="font-semibold text-slate-900">Job photos (up to 4)</p>
                            <p className="mt-1 text-xs text-slate-600">Add or remove images stored with this job. New uploads go to your company logbook bucket.</p>
                            <div className="mt-3 flex flex-wrap gap-3">
                              {editingEntryState.editPhotos.map((photo, photoIndex) => (
                                <div key={`${photo.storagePath}-${photoIndex}`} className="relative rounded-xl border border-slate-200 bg-slate-50 p-1 w-[120px]">
                                  {photo.previewUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={photo.previewUrl}
                                      alt=""
                                      className="h-24 w-full object-cover rounded-lg"
                                    />
                                  ) : (
                                    <div className="h-24 w-full rounded-lg bg-slate-200" title="Preview unavailable" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeEditPhotoSlot(photoIndex)}
                                    className="mt-1 w-full text-xs text-red-600 hover:text-red-800"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                            {editingEntryState.editPhotos.length < 4 ? (
                              <div className="mt-3">
                                <label htmlFor={`edit-photos-${entry.id}`} className="block text-sm font-medium text-slate-700">
                                  Add photos
                                </label>
                                <input
                                  id={`edit-photos-${entry.id}`}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-800"
                                  disabled={editPhotoUploading}
                                  onChange={(e) => void handleEditPhotosChange(e.target.files)}
                                />
                                {editPhotoUploading ? <p className="mt-2 text-xs text-slate-500">Uploading…</p> : null}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-4">
                            <div className="flex items-center justify-between gap-4 mb-3">
                              <p className="font-semibold text-slate-900">Room details</p>
                              <button type="button" onClick={addEditingRoom} className="text-sm text-primary-700 hover:text-primary-900">+ Add Room</button>
                            </div>
                            <div className="space-y-3">
                              {editingEntryState.rooms.map((room, roomIndex) => (
                                <div key={`edit-room-${roomIndex}`} className="rounded-2xl border border-slate-200 bg-white p-3 max-w-3xl">
                                  <FormInput label="Room Name" id={`edit-room-name-${entry.id}-${roomIndex}`} value={room.name} onChange={(e) => updateEditingRoom(roomIndex, 'name', e.target.value)} placeholder="Kitchen" />
                                  <FormInput label="Room Notes" id={`edit-room-note-${entry.id}-${roomIndex}`} as="textarea" value={room.note} onChange={(e) => updateEditingRoom(roomIndex, 'note', e.target.value)} placeholder="Treatment details for this room" />
                                  <button type="button" onClick={() => removeEditingRoom(roomIndex)} className="mt-2 text-sm text-red-600 hover:text-red-800">Remove room</button>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button type="button" onClick={saveEditedEntry} disabled={savingEdit} className="btn btn-primary btn-sm">
                              {savingEdit ? 'Saving...' : 'Save changes'}
                            </button>
                            <button type="button" onClick={clearEditingEntry} className="btn btn-secondary btn-sm">
                              Close
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {(() => {
                        const photoUrls = parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos);
                        if (photoUrls.length === 0) return null;
                        return (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-semibold text-gray-800">Job photos</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {photoUrls.map((url) => (
                                <div key={url} className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-slate-50">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`Job photo for ${entry.clientName}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-auto max-h-[400px] object-contain rounded-2xl transition-shadow"
                                />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {entry.signature ? (
                        <div className="mt-4">
                          <p className="text-sm text-gray-500 mb-2">Signature</p>
                          <Image
                            src={entry.signature}
                            alt="Job signature"
                            width={1200}
                            height={400}
                            className="w-full max-h-40 object-contain rounded-2xl border border-gray-200"
                            unoptimized
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl sm:text-2xl font-bold text-navy">🕒 {t('reports.timeline')}</h3>
              {clientTimeline.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-500">
                  Timeline appears when report entries are available.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {clientTimeline.map((timeline) => (
                    <div key={timeline.client} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-semibold text-slate-900">{timeline.client}</p>
                      <div className="mt-3 space-y-2">
                        {timeline.items.slice(0, 4).map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-xs text-slate-500">{formatDateTimeWithZone(item.date)}</p>
                            <p className="text-sm font-medium text-slate-800">{item.treatment}</p>
                            {item.status ? <p className="text-xs text-slate-600">{t('reports.status')}: {item.status}</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certifications Section */}
            <div className="space-y-4">
              <h3 className="text-xl sm:text-2xl font-bold text-navy">📜 {t('reports.certifications')} ({report.certifications.length})</h3>
              {report.certifications.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-500">
                  No certifications available for this technician.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {report.certifications.map((cert) => {
                    const certName = cert.fileUrl.split('/').pop() || 'certificate';
                    return (
                      <div key={cert.id} className="rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover-lift transition-shadow">
                        <p className="text-sm text-gray-600">Uploaded</p>
                        <p className="font-semibold text-gray-900">{formatDateTimeWithZone(cert.uploadedAt)}</p>
                        <p className="mt-3 text-sm text-gray-600">Expiry</p>
                        <p className="font-semibold text-gray-900">{cert.expiryDate ? formatDateTimeWithZone(cert.expiryDate) : t('reports.noExpiry')}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={buildCertDownloadUrl(cert.fileUrl)}
                            download={sanitizeFilename(certName) || 'certificate'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            📥 Download
                          </a>
                          <button
                            type="button"
                            disabled={deletingCertificationId === cert.id}
                            onClick={() => deleteCertification(cert.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {deletingCertificationId === cert.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
