import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Button from '../components/ui/Button';
import GrowthDashboard from '../components/super-admin/GrowthDashboard';
import PestTraceIntelligencePanel from '../components/super-admin/PestTraceIntelligencePanel';
import { getSupabaseAdmin } from '../lib/supabase-admin';
import { getSuperAdminCookieName, verifySuperAdminToken } from '../lib/superAdminAuth';
import { billingRowsByNormalizedEmail, mergeUserBilling } from '../lib/superAdmin/billingForUserEmails';
import type { UserRoleStats } from '../lib/superAdmin/countUserRoleStats';
import { countUserRoleStats } from '../lib/superAdmin/countUserRoleStats';
import { listAuthUsersForAdmin } from '../lib/superAdmin/listAuthUsersForAdmin';
import type { UserBillingRow } from '../lib/superAdmin/billingForUserEmails';
import { useToast } from '../components/ui/ToastProvider';

type SuperAdminUser = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  role: string;
  bannedUntil: string | null;
  isProtected: boolean;
} & UserBillingRow;

function formatPlanLabel(plan: string | null): string {
  if (!plan?.trim()) return '—';
  const p = plan.toLowerCase();
  if (p === 'trial') return 'Trial';
  if (p === 'business') return 'Business';
  if (p === 'enterprise') return 'Enterprise';
  return plan;
}

function formatSubscriptionLabel(user: SuperAdminUser): string {
  const st = (user.billingSubscriptionStatus ?? '').toLowerCase();
  if (!user.billingPlan && !user.billingSubscriptionStatus) return '—';

  const labels: Record<string, string> = {
    active: 'Active',
    trialing: 'Trialing',
    trial: 'Trial',
    past_due: 'Past due',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
    incomplete: 'Incomplete',
    incomplete_expired: 'Incomplete (expired)',
  };
  const main = labels[st] ?? user.billingSubscriptionStatus ?? '—';

  const bits: string[] = [main];
  if (user.billingCancelAtPeriodEnd && user.billingPeriodEndAt) {
    bits.push(`access until ${new Date(user.billingPeriodEndAt).toLocaleDateString()}`);
  } else if (st === 'trial' && user.billingTrialEndsAt) {
    bits.push(`ends ${new Date(user.billingTrialEndsAt).toLocaleDateString()}`);
  } else if ((st === 'active' || st === 'trialing') && user.billingPeriodEndAt) {
    bits.push(`renews ${new Date(user.billingPeriodEndAt).toLocaleDateString()}`);
  }

  return bits.join(' · ');
}

type AuditEntry = {
  id: string;
  action: string;
  created_at: string;
  new_values?: { action?: string; role?: string; bannedUntil?: string | null } | null;
};

type MarketingLeadRow = {
  email: string;
  fullName: string | null;
  businessName: string | null;
  createdAt: string;
};

export default function SuperAdminPage({
  initialUsers,
  initialError,
  initialPage,
  initialPerPage,
  initialTotal,
  initialRoleStats,
}: SuperAdminPageProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [users, setUsers] = useState<SuperAdminUser[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [page, setPage] = useState(initialPage);
  const [perPage] = useState(initialPerPage);
  const [total, setTotal] = useState(initialTotal);
  const [roleStats, setRoleStats] = useState<UserRoleStats | null>(initialRoleStats);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'technician' | 'unknown'>('all');
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, 'admin' | 'technician'>>({});
  const [historyByUserId, setHistoryByUserId] = useState<Record<string, AuditEntry[]>>({});
  const [historyOpenByUserId, setHistoryOpenByUserId] = useState<Record<string, boolean>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'growth' | 'intelligence' | 'marketing'>('users');
  const [searchActive, setSearchActive] = useState(false);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [marketingLeads, setMarketingLeads] = useState<MarketingLeadRow[]>([]);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingError, setMarketingError] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const totals = roleStats ?? { total, admins: 0, technicians: 0, unknown: 0 };

  const visibleUsers = useMemo(() => {
    return users.filter((u) => (roleFilter === 'all' ? true : u.role === roleFilter));
  }, [users, roleFilter]);

  const loadUsers = useCallback(async (requestedPage = page, emailQuery = search) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(requestedPage),
      perPage: String(perPage),
      stats: '1',
    });
    const q = emailQuery.trim();
    if (q) params.set('email', q);
    const response = await fetch(`/api/super-admin/users?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 401) {
        router.replace('/auth/super-admin');
        setLoading(false);
        return;
      }
      const body = await response.json().catch(() => ({ error: 'Failed to load users' }));
      setError(body.error || 'Failed to load users');
      setLoading(false);
      return;
    }
    const body = await response.json();
    setUsers(Array.isArray(body.users) ? body.users : []);
    setPage(typeof body.page === 'number' ? body.page : requestedPage);
    setTotal(typeof body.total === 'number' ? body.total : total);
    setSearchActive(Boolean(body.searchActive));
    if (body.roleStats && typeof body.roleStats === 'object') {
      setRoleStats(body.roleStats as UserRoleStats);
    }
    setLoading(false);
  }, [page, perPage, search, total, router]);

  const openUserByEmail = (email: string) => {
    setSearch(email);
    setActiveTab('users');
    void loadUsers(1, email);
  };

  useEffect(() => {
    if (activeTab !== 'users') return;
    const t = window.setTimeout(() => {
      void loadUsers(1, search);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search, activeTab, loadUsers]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/super-admin/maintenance/snapshot');
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) {
          setHealthOk(Boolean(body?.sections?.systemHealth?.ok));
        }
      } catch {
        if (!cancelled) setHealthOk(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await fetch('/api/super-admin/logout', { method: 'POST' });
    router.replace('/auth/super-admin');
  };

  const runUserAction = async (
    userId: string,
    action: 'disable' | 'enable' | 'force_signout' | 'set_role' | 'delete',
    role?: 'admin' | 'technician',
  ) => {
    setActionTargetId(userId);
    setError('');
    try {
      const response =
        action === 'delete'
          ? await fetch(`/api/super-admin/users/${userId}`, { method: 'DELETE' })
          : await fetch(`/api/super-admin/users/${userId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action === 'set_role' ? { action, role } : { action }),
            });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Action failed' }));
        setError(body.error || 'Action failed');
      showToast('Action failed', body.error || 'Action failed', 'error');
      } else {
        const actionLabel =
          action === 'set_role'
            ? `Role updated to ${role}.`
            : action === 'force_signout'
              ? 'User has been signed out.'
              : action === 'disable'
                ? 'User has been disabled.'
                : action === 'enable'
                  ? 'User has been re-enabled.'
                  : 'User has been deleted.';
        showToast('Action complete', actionLabel, 'success');
        await loadUsers();
        if (historyOpenByUserId[userId]) {
          await loadHistory(userId);
        }
      }
    } finally {
      setActionTargetId(null);
    }
  };

  const loadHistory = async (userId: string) => {
    setHistoryLoadingId(userId);
    const response = await fetch(`/api/super-admin/audit?userId=${encodeURIComponent(userId)}&limit=10`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Unable to load history' }));
      setError(body.error || 'Unable to load history');
      setHistoryLoadingId(null);
      return;
    }
    const body = await response.json();
    setHistoryByUserId((prev) => ({
      ...prev,
      [userId]: Array.isArray(body.rows) ? body.rows : [],
    }));
    setHistoryLoadingId(null);
  };

  const toggleHistory = async (userId: string) => {
    const isOpen = historyOpenByUserId[userId] ?? false;
    const next = !isOpen;
    setHistoryOpenByUserId((prev) => ({ ...prev, [userId]: next }));
    if (next) {
      await loadHistory(userId);
    }
  };

  const loadMarketingSignups = useCallback(async () => {
    setMarketingLoading(true);
    setMarketingError('');
    try {
      const response = await fetch('/api/super-admin/marketing-signups');
      if (!response.ok) {
        if (response.status === 401) {
          router.replace('/auth/super-admin');
          return;
        }
        const body = await response.json().catch(() => ({ error: 'Failed to load marketing signups' }));
        const errMsg = typeof body.error === 'string' ? body.error : 'Failed to load marketing signups';
        const hint = typeof body.hint === 'string' ? body.hint : '';
        const details = typeof body.details === 'string' ? body.details : '';
        setMarketingError([errMsg, hint, details].filter(Boolean).join(' — '));
        setMarketingLeads([]);
        return;
      }
      const body = await response.json();
      setMarketingLeads(Array.isArray(body.leads) ? body.leads : []);
    } finally {
      setMarketingLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (activeTab === 'marketing') {
      void loadMarketingSignups();
    }
  }, [activeTab, loadMarketingSignups]);

  return (
    <div className="min-h-screen bg-offwhite px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl min-w-0 space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-navy">Super Admin</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Platform operations: user directory and anonymised intelligence (developer access only).
              </p>
              {healthOk != null ? (
                <p
                  className={`mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-semibold ${
                    healthOk
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${healthOk ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  {healthOk ? 'System health OK' : 'Check maintenance — health issues detected'}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => router.push('/super-admin/maintenance')}
                  >
                    Open tools
                  </button>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => void loadUsers()} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh users'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/super-admin/maintenance')}
              >
                Maintenance tools
              </Button>
              <Button variant="danger" size="sm" onClick={handleLogout}>Sign out</Button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'users'
                  ? 'bg-navy text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('growth')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'growth'
                  ? 'bg-amber-700 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              Growth
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('intelligence')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'intelligence'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              PestTrace Intelligence
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('marketing')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'marketing'
                  ? 'bg-violet-700 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              Marketing signups
            </button>
          </div>
        </div>

        {activeTab === 'growth' ? <GrowthDashboard onOpenUserByEmail={openUserByEmail} /> : null}

        {activeTab === 'intelligence' ? (
          <PestTraceIntelligencePanel />
        ) : null}

        {activeTab === 'marketing' ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-navy">Business admin marketing list</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Emails captured when a business owner completes OTP signup (welcome step). Use only in line with your privacy policy and UK GDPR/ePrivacy rules for marketing.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void loadMarketingSignups()} disabled={marketingLoading}>
                {marketingLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
            {marketingError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{marketingError}</div>
            ) : null}
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-100">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {marketingLoading && marketingLeads.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                        Loading…
                      </td>
                    </tr>
                  ) : marketingLeads.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                        No signups recorded yet. Entries appear after new admins verify their email during registration.
                      </td>
                    </tr>
                  ) : (
                    marketingLeads.map((row) => (
                      <tr key={row.email} className="border-t border-zinc-100">
                        <td className="break-all px-4 py-3 text-zinc-800">{row.email}</td>
                        <td className="px-4 py-3 text-zinc-700">{row.fullName ?? '—'}</td>
                        <td className="max-w-[14rem] break-words px-4 py-3 text-zinc-700">{row.businessName ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                          <span suppressHydrationWarning>{new Date(row.createdAt).toLocaleString()}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === 'users' ? (
        <>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mt-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="sr-only">User filters</div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email..."
              className="form-input"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'technician' | 'unknown')}
              className="form-select"
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="technician">Technician</option>
              <option value="unknown">Unknown</option>
            </select>
            <div className="text-sm text-zinc-600 flex items-center">
              {searchActive
                ? `Search: ${visibleUsers.length} match(es) (server-wide)`
                : `Showing ${visibleUsers.length} on this page`}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Page {page} of {totalPages} ({total} total users)</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={loading || page <= 1}
                onClick={() => loadUsers(page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={loading || page >= totalPages}
                onClick={() => loadUsers(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Total users</p>
            <p className="mt-2 text-2xl font-bold text-navy">{totals.total}</p>
            <p className="mt-1 text-xs text-zinc-500">Platform-wide (not page slice)</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admins</p>
            <p className="mt-2 text-2xl font-bold text-navy">{totals.admins}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Technicians</p>
            <p className="mt-2 text-2xl font-bold text-navy">{totals.technicians}</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Subscription</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Email Verified</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last sign in</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const isDisabled =
                    Boolean(user.bannedUntil) && new Date(user.bannedUntil as string).getTime() > Date.now();
                  const roleDraft = roleDrafts[user.id] ?? (user.role === 'admin' ? 'admin' : 'technician');
                  const isProtected = user.isProtected;
                  return (
                  <Fragment key={user.id}>
                  <tr className="border-t border-zinc-100">
                    <td className="break-all px-4 py-3 text-zinc-800">{user.email || '—'}</td>
                    <td className="px-4 py-3 text-zinc-700">{user.role}</td>
                    <td className="max-w-[12rem] break-words px-4 py-3 text-zinc-700">
                      {user.billingCompanyName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{formatPlanLabel(user.billingPlan)}</td>
                    <td className="max-w-[14rem] break-words px-4 py-3 text-xs text-zinc-700">
                      <span suppressHydrationWarning>{formatSubscriptionLabel(user)}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{isDisabled ? 'Disabled' : 'Active'}</td>
                    <td className="px-4 py-3 text-zinc-700">{user.emailConfirmedAt ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      <span suppressHydrationWarning>
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <span suppressHydrationWarning>
                        {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[240px] flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                          size="sm"
                          variant={isDisabled ? 'success' : 'secondary'}
                          disabled={actionTargetId === user.id || isProtected}
                          onClick={() => runUserAction(user.id, isDisabled ? 'enable' : 'disable')}
                        >
                          {isDisabled ? 'Enable' : 'Disable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={actionTargetId === user.id || isProtected}
                          onClick={() => runUserAction(user.id, 'force_signout')}
                        >
                          Force sign-out
                        </Button>
                        <select
                          value={roleDraft}
                          onChange={(e) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [user.id]: e.target.value as 'admin' | 'technician',
                            }))
                          }
                          className="form-select !h-9 !min-h-[2.25rem] !py-1 !px-2 text-sm"
                        >
                          <option value="admin">Admin</option>
                          <option value="technician">Technician</option>
                        </select>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={actionTargetId === user.id || roleDraft === user.role || (isProtected && roleDraft !== 'admin')}
                          onClick={() => runUserAction(user.id, 'set_role', roleDraft)}
                        >
                          Apply role
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={historyLoadingId === user.id}
                          onClick={() => toggleHistory(user.id)}
                        >
                          {historyOpenByUserId[user.id] ? 'Hide history' : 'View history'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={actionTargetId === user.id || isProtected}
                          onClick={() => {
                            if (window.confirm(`Delete ${user.email}? This cannot be undone.`)) {
                              runUserAction(user.id, 'delete');
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                {historyOpenByUserId[user.id] ? (
                  <tr className="border-t border-zinc-100 bg-zinc-50/60">
                    <td colSpan={10} className="px-4 py-3">
                      {historyLoadingId === user.id ? (
                        <p className="text-sm text-zinc-500">Loading history...</p>
                      ) : (historyByUserId[user.id] ?? []).length === 0 ? (
                        <p className="text-sm text-zinc-500">No action history yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(historyByUserId[user.id] ?? []).map((entry) => (
                            <div key={entry.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
                              <p className="font-semibold text-zinc-900">
                                {entry.action} · {(entry.new_values?.action ?? 'update').replaceAll('_', ' ')}
                              </p>
                              <p className="mt-1 text-zinc-600">
                                <span suppressHydrationWarning>
                                  {new Date(entry.created_at).toLocaleString()}
                                </span>
                                {entry.new_values?.role ? ` · role=${entry.new_values.role}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
                </Fragment>
                )})}
              </tbody>
            </table>
          </div>
        </div>
        </>
        ) : null}
      </div>
    </div>
  );
}

type SuperAdminPageProps = {
  initialUsers: SuperAdminUser[];
  initialError: string;
  initialPage: number;
  initialPerPage: number;
  initialTotal: number;
  initialRoleStats: UserRoleStats | null;
};

export const getServerSideProps: GetServerSideProps<SuperAdminPageProps> = async (ctx) => {
  const token = ctx.req.cookies[getSuperAdminCookieName()];
  if (!verifySuperAdminToken(token)) {
    return {
      redirect: {
        destination: '/auth/super-admin',
        permanent: false,
      },
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      props: {
        initialUsers: [],
        initialError: 'Supabase admin client not configured',
        initialPage: 1,
        initialPerPage: 50,
        initialTotal: 0,
        initialRoleStats: null,
      },
    };
  }

  const page = 1;
  const perPage = 50;
  const protectedEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();

  try {
    const [listed, roleStats] = await Promise.all([
      listAuthUsersForAdmin(admin, { page, perPage }),
      countUserRoleStats(admin),
    ]);

    const baseUsers = listed.users.map((u) => ({
      ...u,
      isProtected: protectedEmail.length > 0 && u.email.trim().toLowerCase() === protectedEmail,
    }));

    const billingMap = await billingRowsByNormalizedEmail(baseUsers.map((u) => u.email));
    const users: SuperAdminUser[] = baseUsers.map((u) => mergeUserBilling(u, billingMap));

    return {
      props: {
        initialUsers: users,
        initialError: '',
        initialPage: listed.page,
        initialPerPage: listed.perPage,
        initialTotal: listed.total,
        initialRoleStats: roleStats,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load users';
    return {
      props: {
        initialUsers: [],
        initialError: msg,
        initialPage: 1,
        initialPerPage: perPage,
        initialTotal: 0,
        initialRoleStats: null,
      },
    };
  }
};

