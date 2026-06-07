import { expect, test } from '@playwright/test';
import {
  getTrialNoticeLevel,
  trialNoticeMessage,
  TRIAL_NOTICE_DAYS,
} from '../lib/trial/trialNoticeThresholds';

test.describe('trial notice thresholds', () => {
  test('TRIAL_NOTICE_DAYS includes 7, 3, and 1', () => {
    expect([...TRIAL_NOTICE_DAYS]).toEqual([7, 3, 1]);
  });

  test('getTrialNoticeLevel matches exact day thresholds only', () => {
    expect(getTrialNoticeLevel(7)).toBe(7);
    expect(getTrialNoticeLevel(3)).toBe(3);
    expect(getTrialNoticeLevel(1)).toBe(1);
    expect(getTrialNoticeLevel(5)).toBeNull();
    expect(getTrialNoticeLevel(14)).toBeNull();
    expect(getTrialNoticeLevel(null)).toBeNull();
  });

  test('trialNoticeMessage returns distinct copy per level', () => {
    expect(trialNoticeMessage(7)).toContain('7 days');
    expect(trialNoticeMessage(3)).toContain('3 days');
    expect(trialNoticeMessage(1)).toContain('tomorrow');
  });
});
