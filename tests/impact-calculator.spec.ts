import { expect, test } from '@playwright/test';
import {
  calculateImpact,
  IMPACT_CALCULATOR_DEFAULTS,
  normalizeJobsToMonthly,
} from '../lib/marketing/impactCalculator';

test.describe('Impact calculator math', () => {
  test('calculateImpact with defaults', () => {
    const result = calculateImpact(IMPACT_CALCULATOR_DEFAULTS);
    expect(result.hoursSavedPerMonth).toBe(8);
    expect(result.labourSavingsGbp).toBe(176);
    expect(result.extraJobsCapacity).toBe(8);
    expect(result.planCostGbp).toBe(25);
    expect(result.netRoiMonthlyGbp).toBe(151);
    expect(result.netRoiYearlyGbp).toBe(1812);
  });

  test('calculateImpact with zero jobs', () => {
    const result = calculateImpact({ ...IMPACT_CALCULATOR_DEFAULTS, jobsPerMonth: 0 });
    expect(result.hoursSavedPerMonth).toBe(0);
    expect(result.labourSavingsGbp).toBe(0);
    expect(result.extraJobsCapacity).toBe(0);
    expect(result.netRoiMonthlyGbp).toBe(-25);
  });

  test('normalizeJobsToMonthly scales by range', () => {
    expect(normalizeJobsToMonthly(7, 7)).toBe(30);
    expect(normalizeJobsToMonthly(0, 30)).toBe(0);
    expect(normalizeJobsToMonthly(10, 0)).toBe(0);
  });
});
