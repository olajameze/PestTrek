'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  calculateImpact,
  formatImpactSummary,
  IMPACT_CALCULATOR_DEFAULTS,
  type ImpactCalculatorInputs,
  type ImpactPlanKey,
} from '../../lib/marketing/impactCalculator';
import { IMPACT_DISCLAIMER } from '../../lib/marketing/impactCalculatorCopy';
import { formatGbpPrice, MARKETING_PLAN_PRICES_GBP } from '../../lib/marketing/pricing';

type ImpactCalculatorProps = {
  variant: 'marketing' | 'dashboard';
  initialInputs?: Partial<ImpactCalculatorInputs>;
  prefilledFromData?: { jobsLabel: string; sourceNote: string };
  defaultPlan?: ImpactPlanKey;
  showPlanSelector?: boolean;
};

const PLAN_OPTIONS: { value: ImpactPlanKey; label: string }[] = [
  { value: 'pro', label: `Pro (${formatGbpPrice(MARKETING_PLAN_PRICES_GBP.pro)}/mo)` },
  { value: 'business', label: `Business (${formatGbpPrice(MARKETING_PLAN_PRICES_GBP.business)}/mo)` },
  {
    value: 'enterprise',
    label: `Enterprise (${formatGbpPrice(MARKETING_PLAN_PRICES_GBP.enterprise)}/mo)`,
  },
];

function mergeInputs(
  initial: Partial<ImpactCalculatorInputs> | undefined,
  defaultPlan: ImpactPlanKey,
): ImpactCalculatorInputs {
  return {
    ...IMPACT_CALCULATOR_DEFAULTS,
    planKey: defaultPlan,
    ...initial,
  };
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      />
    </label>
  );
}

export default function ImpactCalculator({
  variant,
  initialInputs,
  prefilledFromData,
  defaultPlan = 'pro',
  showPlanSelector = false,
}: ImpactCalculatorProps) {
  const [inputs, setInputs] = useState<ImpactCalculatorInputs>(() =>
    mergeInputs(initialInputs, defaultPlan),
  );

  const results = useMemo(() => calculateImpact(inputs), [inputs]);
  const summary = useMemo(
    () => formatImpactSummary(results, inputs.jobsPerMonth),
    [results, inputs.jobsPerMonth],
  );

  const isMarketing = variant === 'marketing';
  const shellClass = isMarketing
    ? 'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8'
    : 'rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm';

  const update = <K extends keyof ImpactCalculatorInputs>(key: K, value: ImpactCalculatorInputs[K]) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className={shellClass}>
      {prefilledFromData ? (
        <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">{prefilledFromData.jobsLabel}</p>
          <p className="mt-1 text-emerald-800">{prefilledFromData.sourceNote}</p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          id="impact-jobs"
          label="Jobs per month"
          value={inputs.jobsPerMonth}
          onChange={(value) => update('jobsPerMonth', value)}
        />
        <NumberField
          id="impact-minutes"
          label="Minutes saved per job (admin / paperwork)"
          value={inputs.minutesSavedPerJob}
          onChange={(value) => update('minutesSavedPerJob', value)}
        />
        <NumberField
          id="impact-hourly"
          label="Staff hourly rate (£)"
          value={inputs.hourlyRateGbp}
          onChange={(value) => update('hourlyRateGbp', value)}
        />
        <NumberField
          id="impact-job-value"
          label="Average value of an extra job (£)"
          value={inputs.averageJobValueGbp}
          onChange={(value) => update('averageJobValueGbp', value)}
        />
      </div>

      {showPlanSelector ? (
        <div className="mt-5">
          <label htmlFor="impact-plan" className="mb-1.5 block text-sm font-medium text-slate-700">
            Compare net ROI to plan
          </label>
          <select
            id="impact-plan"
            value={inputs.planKey}
            onChange={(e) => update('planKey', e.target.value as ImpactPlanKey)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Hours saved</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{results.hoursSavedPerMonth}</p>
          <p className="text-xs text-slate-500">per month</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Labour saved</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatGbpPrice(results.labourSavingsGbp)}</p>
          <p className="text-xs text-slate-500">per month</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Extra jobs</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{results.extraJobsCapacity}</p>
          <p className="text-xs text-slate-500">capacity / month</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Net ROI</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            {formatGbpPrice(results.netRoiMonthlyGbp)}
          </p>
          <p className="text-xs text-slate-500">
            per month ({formatGbpPrice(results.netRoiYearlyGbp)}/yr after {formatGbpPrice(results.planCostGbp)} plan)
          </p>
        </div>
      </div>

      <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        {summary}
        {results.extraRevenueGbp > 0 ? (
          <>
            {' '}
            · Potential extra revenue: {formatGbpPrice(results.extraRevenueGbp)}/month if hours convert to jobs.
          </>
        ) : null}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">{IMPACT_DISCLAIMER}</p>

      {isMarketing ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/signup"
            className="inline-flex justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
          >
            Start Free Trial
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex justify-center rounded-xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
          >
            View pricing
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600">
          Adjust assumptions above to model different scenarios.{' '}
          <Link href="/impact-calculator" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Open public calculator
          </Link>
        </p>
      )}
    </div>
  );
}
