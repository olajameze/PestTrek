import { checkPlan } from '../planGuard';

const BUSINESS_PLANS = ['business', 'enterprise'] as const;
const ENTERPRISE_PLANS = ['enterprise'] as const;

export function canUseBusinessFeatures(plan: string | null | undefined): boolean {
  return checkPlan(plan ?? 'trial', [...BUSINESS_PLANS]);
}

export function canUseEnterpriseFeatures(plan: string | null | undefined): boolean {
  return checkPlan(plan ?? 'trial', [...ENTERPRISE_PLANS]);
}

export function businessPlanError(): string {
  return 'This feature is available on Business and Enterprise plans. Upgrade to unlock.';
}

export function enterprisePlanError(): string {
  return 'This feature is available on the Enterprise plan. Upgrade to unlock.';
}
