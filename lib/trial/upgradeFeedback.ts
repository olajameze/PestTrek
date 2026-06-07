export const TRIAL_UPGRADE_FEEDBACK_REASONS = [
  'too_expensive',
  'missing_features',
  'using_another_system',
  'not_enough_time',
  'just_evaluating',
  'other',
] as const;

export type TrialUpgradeFeedbackReason = (typeof TRIAL_UPGRADE_FEEDBACK_REASONS)[number];

export function isTrialUpgradeFeedbackReason(value: string): value is TrialUpgradeFeedbackReason {
  return (TRIAL_UPGRADE_FEEDBACK_REASONS as readonly string[]).includes(value);
}

export const TRIAL_FEEDBACK_REASON_LABELS: Record<TrialUpgradeFeedbackReason, string> = {
  too_expensive: 'Too expensive',
  missing_features: 'Missing features',
  using_another_system: 'Using another system',
  not_enough_time: 'Not enough time',
  just_evaluating: 'Just evaluating',
  other: 'Other',
};

export function parseTrialFeedbackDismissedAt(notificationPreferences: unknown): string | null {
  if (!notificationPreferences || typeof notificationPreferences !== 'object' || Array.isArray(notificationPreferences)) {
    return null;
  }
  const value = (notificationPreferences as Record<string, unknown>).trialFeedbackDismissedAt;
  return typeof value === 'string' ? value : null;
}

export function withTrialFeedbackDismissed(notificationPreferences: unknown, at: string): Record<string, unknown> {
  const base =
    notificationPreferences && typeof notificationPreferences === 'object' && !Array.isArray(notificationPreferences)
      ? (notificationPreferences as Record<string, unknown>)
      : {};
  return { ...base, trialFeedbackDismissedAt: at };
}
