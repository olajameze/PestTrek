'use client';

import ImpactCalculator from '../impact/ImpactCalculator';
import Card from '../ui/Card';
import type { DashboardData } from '../../lib/api/mockDashboardData';
import { normalizeJobsToMonthly, planKeyFromCompanyPlan } from '../../lib/marketing/impactCalculator';

type ImpactCalculatorPanelProps = {
  impactContext: NonNullable<DashboardData['impactContext']>;
  plan: string;
  loading?: boolean;
};

export default function ImpactCalculatorPanel({
  impactContext,
  plan,
  loading = false,
}: ImpactCalculatorPanelProps) {
  const jobsPerMonth = normalizeJobsToMonthly(impactContext.jobsInRange, impactContext.rangeDays);
  const planKey = planKeyFromCompanyPlan(plan);

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">ROI from your logbook</p>
        <h3 className="text-lg font-semibold text-navy">Impact Calculator</h3>
        <p className="mt-2 text-sm text-slate-600">
          Estimates are pre-filled from jobs in your selected dashboard range. Adjust assumptions to model different scenarios.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading job data…</p>
      ) : (
        <ImpactCalculator
          variant="dashboard"
          defaultPlan={planKey}
          initialInputs={{
            jobsPerMonth,
            averageJobValueGbp: impactContext.averageJobValueGbp,
            planKey,
          }}
          prefilledFromData={{
            jobsLabel: `${impactContext.jobsInRange} jobs in the last ${impactContext.rangeDays} days`,
            sourceNote: `Normalized to approximately ${jobsPerMonth} jobs per month for ROI modelling.`,
          }}
        />
      )}
    </Card>
  );
}
