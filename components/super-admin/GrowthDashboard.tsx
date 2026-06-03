'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '../ui/Button';
import type { GrowthMetrics } from '../../lib/superAdmin/queryGrowthMetrics';

function planLabel(plan: string | null): string {
  if (!plan?.trim()) return '—';
  const p = plan.toLowerCase();
  if (p === 'trial') return 'Trial';
  if (p === 'business') return 'Business';
  if (p === 'enterprise') return 'Enterprise';
  return plan;
}

function statusLabel(st: string | null): string {
  if (!st?.trim()) return '—';
  return st.replace(/_/g, ' ');
}

type GrowthDashboardProps = {
  onOpenUserByEmail?: (email: string) => void;
};

export default function GrowthDashboard({ onOpenUserByEmail }: GrowthDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<GrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trialEmailPreview, setTrialEmailPreview] = useState<{
    pendingCount: number;
    alreadySentCount: number;
  } | null>(null);
  const [trialEmailSending, setTrialEmailSending] = useState(false);
  const [trialEmailResult, setTrialEmailResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/super-admin/growth', { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/auth/super-admin');
          return;
        }
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      setData((await res.json()) as GrowthMetrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load growth metrics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadTrialEmailPreview = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/trial-upgrade-emails', { credentials: 'same-origin' });
      if (!res.ok) return;
      const body = (await res.json()) as { pendingCount?: number; alreadySentCount?: number };
      setTrialEmailPreview({
        pendingCount: body.pendingCount ?? 0,
        alreadySentCount: body.alreadySentCount ?? 0,
      });
    } catch {
      setTrialEmailPreview(null);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadTrialEmailPreview();
  }, [load, loadTrialEmailPreview]);

  const sendTrialEndedEmails = async (dryRun: boolean) => {
    if (!dryRun) {
      const n = trialEmailPreview?.pendingCount ?? 0;
      if (
        !window.confirm(
          `Send the trial-ended upgrade email to ${n} business owner(s)? Each address is only emailed once unless you use force resend from the API.`,
        )
      ) {
        return;
      }
    }
    setTrialEmailSending(true);
    setTrialEmailResult('');
    try {
      const res = await fetch('/api/super-admin/trial-upgrade-emails', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Send failed');
      const sent = (body as { sent?: number }).sent ?? 0;
      const failed = (body as { failed?: unknown[] }).failed ?? [];
      setTrialEmailResult(
        dryRun
          ? `Dry run: ${(body as { eligible?: number }).eligible ?? 0} recipient(s) would be emailed.`
          : `Sent ${sent} email(s).${failed.length ? ` ${failed.length} failed — check server logs.` : ''}`,
      );
      await loadTrialEmailPreview();
    } catch (e) {
      setTrialEmailResult(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setTrialEmailSending(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
        Loading growth metrics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { funnel } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          Revenue and onboarding signals — marketing signups linked to billing and logbook activity.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <section className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-navy">Trial ended — upgrade emails</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Sends a respectful message to business owners whose free trial has ended and who are not on a paid
          plan. Respects Settings → &quot;Trial expiry&quot; notifications. Each company is emailed once.
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          {trialEmailPreview != null
            ? `${trialEmailPreview.pendingCount} pending · ${trialEmailPreview.alreadySentCount} already sent`
            : 'Loading recipient count…'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={trialEmailSending}
            onClick={() => void sendTrialEndedEmails(true)}
          >
            Preview count (dry run)
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={trialEmailSending || (trialEmailPreview?.pendingCount ?? 0) === 0}
            onClick={() => void sendTrialEndedEmails(false)}
          >
            {trialEmailSending ? 'Sending…' : 'Send upgrade emails'}
          </Button>
        </div>
        {trialEmailResult ? <p className="mt-3 text-sm text-zinc-700">{trialEmailResult}</p> : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Marketing signups</p>
          <p className="mt-2 text-2xl font-bold text-navy">{funnel.marketingSignups}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Companies</p>
          <p className="mt-2 text-2xl font-bold text-navy">{funnel.companies}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Paid / active</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{funnel.activePaid}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-800">Trialing</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{funnel.trialing}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-red-700">Past due</p>
          <p className="mt-2 text-2xl font-bold text-red-900">{funnel.pastDue}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">With logbook</p>
          <p className="mt-2 text-2xl font-bold text-navy">{funnel.withLogbook}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-700">Marketing, no logbook</p>
          <p className="mt-2 text-2xl font-bold text-violet-900">{funnel.marketingWithoutLogbook}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-navy">Trials ending (14 days)</h3>
          <p className="mt-1 text-xs text-zinc-500">Companies on trial/trialing with trial end within the next two weeks.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Trial ends</th>
                  <th className="py-2 pr-3">Logbooks</th>
                  <th className="py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {data.trialsEndingSoon.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-zinc-500">
                      None in this window.
                    </td>
                  </tr>
                ) : (
                  data.trialsEndingSoon.map((row) => (
                    <tr key={row.email} className="border-t border-zinc-100">
                      <td className="break-all py-2 pr-3">{row.email}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        <span suppressHydrationWarning>
                          {new Date(row.trialEndsAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{row.logbookCount}</td>
                      <td className="py-2">
                        {onOpenUserByEmail ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-emerald-700 hover:underline"
                            onClick={() => onOpenUserByEmail(row.email)}
                          >
                            Users tab
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-navy">Past due billing</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {data.pastDueCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-zinc-500">
                      No past_due companies.
                    </td>
                  </tr>
                ) : (
                  data.pastDueCompanies.map((row) => (
                    <tr key={row.email} className="border-t border-zinc-100">
                      <td className="break-all py-2 pr-3">{row.email}</td>
                      <td className="py-2 pr-3">{planLabel(row.plan)}</td>
                      <td className="py-2">
                        {onOpenUserByEmail ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-emerald-700 hover:underline"
                            onClick={() => onOpenUserByEmail(row.email)}
                          >
                            Users tab
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-navy">Companies with zero logbook entries</h3>
        <p className="mt-1 text-xs text-zinc-500">Signed-up businesses that have not logged field work yet.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {data.zeroLogbookCompanies.map((row) => (
                <tr key={row.email} className="border-t border-zinc-100">
                  <td className="break-all py-2 pr-3">{row.email}</td>
                  <td className="py-2 pr-3">{statusLabel(row.subscriptionStatus)}</td>
                  <td className="whitespace-nowrap py-2 pr-3">
                    <span suppressHydrationWarning>
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="py-2">
                    {onOpenUserByEmail ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                        onClick={() => onOpenUserByEmail(row.email)}
                      >
                        Users tab
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200/80 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-navy">Marketing signups × billing × logbook</h3>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Logbooks</th>
                <th className="px-4 py-3">Captured</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody>
              {data.marketingLeads.map((row) => (
                <tr key={row.email} className="border-t border-zinc-100">
                  <td className="break-all px-4 py-3">{row.email}</td>
                  <td className="max-w-[12rem] break-words px-4 py-3">{row.businessName ?? '—'}</td>
                  <td className="px-4 py-3">{planLabel(row.billingPlan)}</td>
                  <td className="px-4 py-3">{statusLabel(row.billingSubscriptionStatus)}</td>
                  <td className="px-4 py-3">{row.logbookCount}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span suppressHydrationWarning>{new Date(row.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    {onOpenUserByEmail ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-violet-700 hover:underline"
                        onClick={() => onOpenUserByEmail(row.email)}
                      >
                        Find user
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
