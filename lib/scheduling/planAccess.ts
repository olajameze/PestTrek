import { checkPlan } from '../planGuard';

const SMART_SCHEDULING_PLANS = ['business', 'enterprise'] as const;

export function canUseSmartScheduling(plan: string | null | undefined): boolean {
  return checkPlan(plan ?? 'trial', [...SMART_SCHEDULING_PLANS]);
}

export function smartSchedulingPlanError(): string {
  return 'Smart Scheduling is available on Business and Enterprise plans. Upgrade to unlock.';
}
