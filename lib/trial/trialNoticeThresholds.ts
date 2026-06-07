export const TRIAL_NOTICE_DAYS = [7, 3, 1] as const;

export type TrialNoticeLevel = (typeof TRIAL_NOTICE_DAYS)[number];

export function getTrialNoticeLevel(daysRemaining: number | null): TrialNoticeLevel | null {
  if (daysRemaining === null) return null;
  if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
    return daysRemaining;
  }
  return null;
}

export function trialNoticeMessage(level: TrialNoticeLevel): string {
  if (level === 7) {
    return 'You have 7 days left on your PestTrace trial. Upgrade now to keep your logbook, reports, and dashboard insights.';
  }
  if (level === 3) {
    return 'Your trial ends in 3 days. Upgrade to avoid losing access to your compliance records and team tools.';
  }
  return 'Your trial ends tomorrow. Upgrade today to keep uninterrupted access to PestTrace.';
}

export function trialNoticeModalTitle(level: TrialNoticeLevel): string {
  if (level === 7) return 'One week left on your trial';
  if (level === 3) return 'Your trial ends in 3 days';
  return 'Your trial ends tomorrow';
}

export const TRIAL_NOTICE_SESSION_KEY = 'pesttraceTrialNoticeShown';
