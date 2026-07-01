import { useMemo } from 'react';
import { useRouter } from 'next/router';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TodaySchedule from './TodaySchedule';
import AuditReadinessCentre from './AuditReadinessCentre';
import ComplianceAlertsWidget from './ComplianceAlertsWidget';
import ComplianceMonitor from './ComplianceMonitor';
import ChemicalLog from './ChemicalLog';
import ActivationDashboard from './ActivationDashboard';
import UrgentAlerts from './UrgentAlerts';
import FollowUpQueue from './FollowUpQueue';
import CustomerLifetimeValue from './CustomerLifetimeValue';
import RetentionChurn from './RetentionChurn';
import CSATScore from './CSATScore';
import SchedulingTodayJobs from './SchedulingTodayJobs';
import SchedulingUpcomingJobs from './SchedulingUpcomingJobs';
import SchedulingUnassignedJobs from './SchedulingUnassignedJobs';
import SchedulingOverdueJobs from './SchedulingOverdueJobs';
import { useUserPlan } from '../../lib/auth/plan';
import { useDateRange } from '../../lib/hooks/useDateRange';
import { useDashboardData } from '../../lib/hooks/useDashboardData';
import { useToast } from '../ui/ToastProvider';
import type { NextBestAction } from '../../lib/api/mockDashboardData';
import type { FollowUpQueueItem } from '../../lib/followUpQueue';

interface DashboardEnhancementsProps {
  plan?: string;
  /** Enterprise-tier dashboard cards while on active trial (without changing `plan`). */
  enterprisePreview?: boolean;
}

export default function DashboardEnhancements({ plan, enterprisePreview = false }: DashboardEnhancementsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const userPlan = useUserPlan(plan);
  const { range, setRange, options } = useDateRange();
  const { data, loading, refresh } = useDashboardData(range);

  const showAnalytics = userPlan === 'business' || userPlan === 'enterprise' || enterprisePreview;
  const showEnterprise = userPlan === 'enterprise' || enterprisePreview;
  const showScheduling = userPlan === 'business' || userPlan === 'enterprise' || enterprisePreview;

  const planDescription = useMemo(() => {
    if (userPlan === 'enterprise') return 'Enterprise analytics are available.';
    if (enterprisePreview && userPlan === 'trial') {
      return 'Enterprise analytics are included as a preview during your trial. Subscribe to keep them after trial ends.';
    }
    if (userPlan === 'business') return 'Business customers have CLV tracking and ratio insights.';
    return 'Upgrade to Business to unlock customer analytics and retention reporting.';
  }, [userPlan, enterprisePreview]);

  const openReports = (query: Record<string, string>) => {
    router.push({ pathname: '/reports', query });
  };

  const handleUrgentAlertAction = (alert?: { action?: { type: 'open_reports' | 'open_technicians'; search?: string; followUpOnly?: boolean } }) => {
    if (!alert?.action) {
      openReports({});
      return;
    }

    if (alert.action.type === 'open_technicians') {
      router.push('/dashboard?tab=technicians');
      return;
    }

    const query: Record<string, string> = {};
    if (alert.action.search) query.search = alert.action.search;
    if (alert.action.followUpOnly) query.followUpOnly = '1';
    openReports(query);
  };
  const handleNextBestAction = (action: NextBestAction['action']) => {
    if (action.type === 'open_technicians') {
      router.push('/dashboard?tab=technicians');
      return;
    }
    const query: Record<string, string> = {};
    if (action.search) query.search = action.search;
    if (action.followUpOnly) query.followUpOnly = '1';
    openReports(query);
  };

  const handleScheduleMapClick = () => {
    const today = new Date().toISOString().slice(0, 10);
    openReports({ startDate: today, endDate: today });
  };

  const handleComplianceDrilldown = () => {
    openReports({ followUpOnly: '1' });
  };

  const handleChemicalDetails = () => {
    showToast('Tip', 'Use report search to find jobs by treatment or poison used.', 'info');
    openReports({});
  };

  const handleFollowUpEntry = (item: FollowUpQueueItem) => {
    openReports({ followUpOnly: '1', search: item.clientName });
  };

  const handleFollowUpViewAll = () => {
    openReports({ followUpOnly: '1' });
  };

  return (
    <section aria-labelledby="dashboard-enhancements-heading" className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Dashboard insights</p>
            <h2 id="dashboard-enhancements-heading" className="text-2xl font-semibold text-navy">Operational & customer visibility</h2>
            <p className="mt-2 text-sm text-slate-600">
              Operational metrics are computed from your logbook, certifications, and company rules. Business and Enterprise plans unlock the customer analytics cards below
              {enterprisePreview ? ' (Enterprise preview on your trial).' : '.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {options.map((option) => (
              <Button
                key={option}
                variant={range === option ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setRange(option)}
                className="min-w-[70px]"
                aria-pressed={range === option}
              >
                Last {option}d
              </Button>
            ))}
            <Button size="sm" variant="secondary" onClick={() => refresh()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      <ActivationDashboard />

      <FollowUpQueue
        queue={data?.followUpQueue}
        loading={loading}
        onOpenEntry={handleFollowUpEntry}
        onViewAll={handleFollowUpViewAll}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <UrgentAlerts alerts={data?.urgentAlerts ?? []} loading={loading} onActionClick={handleUrgentAlertAction} />
        <TodaySchedule schedule={data?.todaySchedule} loading={loading} onMapClick={handleScheduleMapClick} />
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy">Next best actions</h3>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Priority queue</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.nextBestActions ?? []).map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => handleNextBestAction(item.action)}
              >
                Open action
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ComplianceMonitor compliance={data?.compliance} loading={loading} onTrendClick={handleComplianceDrilldown} />
        <ChemicalLog chemicalLog={data?.chemicalLog ?? []} loading={loading} onRowClick={handleChemicalDetails} />
      </div>

      <AuditReadinessCentre auditReadiness={data?.auditReadiness} loading={loading} canExport={showScheduling} />
      {showScheduling ? <ComplianceAlertsWidget /> : null}

      {showScheduling ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SchedulingTodayJobs appointments={data?.schedulingWidgets?.todayJobs ?? []} loading={loading} />
          <SchedulingUpcomingJobs appointments={data?.schedulingWidgets?.upcomingJobs ?? []} loading={loading} />
          <SchedulingUnassignedJobs appointments={data?.schedulingWidgets?.unassignedJobs ?? []} loading={loading} />
          <SchedulingOverdueJobs appointments={data?.schedulingWidgets?.overdueJobs ?? []} loading={loading} />
        </div>
      ) : null}

      <details className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm" open>
        <summary className="cursor-pointer text-lg font-semibold text-navy">Customer & retention analytics</summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">{planDescription}</p>
          {showAnalytics ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <CustomerLifetimeValue customerValue={data?.customerValue} loading={loading} />
              {showEnterprise ? <RetentionChurn retention={data?.retention} loading={loading} /> : null}
              {showEnterprise ? <CSATScore csat={data?.csat} loading={loading} /> : null}
            </div>
          ) : (
            <Card className="border-dashed border-slate-300 bg-slate-50 text-slate-700">
              <p className="text-sm font-medium text-slate-900">Customer analytics are locked.</p>
              <p className="mt-2 text-sm">Upgrade to Business or Enterprise to view CLV tracking, retention analytics, and CSAT trends.</p>
            </Card>
          )}
        </div>
      </details>
    </section>
  );
}
