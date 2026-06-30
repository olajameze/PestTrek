import { test, expect } from '@playwright/test';
import { canUseSmartScheduling } from '../lib/scheduling/planAccess';

test.describe('scheduling plan access', () => {
  test('allows business and enterprise only', () => {
    expect(canUseSmartScheduling('business')).toBe(true);
    expect(canUseSmartScheduling('enterprise')).toBe(true);
    expect(canUseSmartScheduling('pro')).toBe(false);
    expect(canUseSmartScheduling('trial')).toBe(false);
  });
});
