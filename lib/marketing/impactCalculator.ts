import { formatGbpPrice, MARKETING_PLAN_PRICES_GBP, type MarketingPlanKey } from './pricing';

export type ImpactPlanKey = MarketingPlanKey;

export type ImpactCalculatorInputs = {
  jobsPerMonth: number;
  minutesSavedPerJob: number;
  hourlyRateGbp: number;
  averageJobValueGbp: number;
  planKey: ImpactPlanKey;
  /** Minutes assumed per completed job when estimating extra capacity. */
  minutesPerJob?: number;
};

export type ImpactCalculatorResults = {
  hoursSavedPerMonth: number;
  labourSavingsGbp: number;
  extraJobsCapacity: number;
  extraRevenueGbp: number;
  planCostGbp: number;
  netRoiMonthlyGbp: number;
  netRoiYearlyGbp: number;
};

export const IMPACT_CALCULATOR_DEFAULTS: ImpactCalculatorInputs = {
  jobsPerMonth: 40,
  minutesSavedPerJob: 12,
  hourlyRateGbp: 22,
  averageJobValueGbp: 135,
  planKey: 'pro',
  minutesPerJob: 60,
};

/** Scale logbook job counts from a dashboard date range to an approximate monthly figure. */
export function normalizeJobsToMonthly(jobsInRange: number, rangeDays: number): number {
  if (rangeDays <= 0 || jobsInRange <= 0) return 0;
  return Math.max(0, Math.round((jobsInRange * 30) / rangeDays));
}

export function planKeyFromCompanyPlan(plan: string | null | undefined): ImpactPlanKey {
  const value = (plan || 'pro').toLowerCase();
  if (value === 'enterprise') return 'enterprise';
  if (value === 'business') return 'business';
  return 'pro';
}

export function calculateImpact(inputs: ImpactCalculatorInputs): ImpactCalculatorResults {
  const jobsPerMonth = Math.max(0, inputs.jobsPerMonth);
  const minutesSavedPerJob = Math.max(0, inputs.minutesSavedPerJob);
  const hourlyRateGbp = Math.max(0, inputs.hourlyRateGbp);
  const averageJobValueGbp = Math.max(0, inputs.averageJobValueGbp);
  const minutesPerJob = Math.max(1, inputs.minutesPerJob ?? IMPACT_CALCULATOR_DEFAULTS.minutesPerJob ?? 60);
  const planCostGbp = MARKETING_PLAN_PRICES_GBP[inputs.planKey];

  const hoursSavedPerMonth = Math.round(((jobsPerMonth * minutesSavedPerJob) / 60) * 10) / 10;
  const labourSavingsGbp = Math.round(hoursSavedPerMonth * hourlyRateGbp);
  const extraJobsCapacity = Math.floor((hoursSavedPerMonth * 60) / minutesPerJob);
  const extraRevenueGbp = Math.round(extraJobsCapacity * averageJobValueGbp);
  const netRoiMonthlyGbp = labourSavingsGbp - planCostGbp;
  const netRoiYearlyGbp = netRoiMonthlyGbp * 12;

  return {
    hoursSavedPerMonth,
    labourSavingsGbp,
    extraJobsCapacity,
    extraRevenueGbp,
    planCostGbp,
    netRoiMonthlyGbp,
    netRoiYearlyGbp,
  };
}

export function formatImpactSummary(
  results: ImpactCalculatorResults,
  jobsPerMonth: number,
): string {
  return `${jobsPerMonth} jobs → ${results.hoursSavedPerMonth} hrs saved → ${formatGbpPrice(results.labourSavingsGbp)} saved → ${results.extraJobsCapacity} extra jobs possible`;
}
