import { expect, test } from '@playwright/test';
import {
  ACTIVATION_MILESTONES,
  computeActivationScore,
  getNextRecommendedAction,
  isMilestoneComplete,
  normalizeCustomerKey,
  normalizeSiteKey,
} from '../lib/activation/companyActivation';

test.describe('activation progress helpers', () => {
  test('computeActivationScore returns 0 for empty row', () => {
    const row = {
      firstCustomerCreatedAt: null,
      firstSiteCreatedAt: null,
      firstJobCompletedAt: null,
      firstPhotoUploadedAt: null,
      firstReportGeneratedAt: null,
    };
    expect(computeActivationScore(row)).toBe(0);
  });

  test('computeActivationScore returns 100 when all milestones complete', () => {
    const now = new Date();
    const row = {
      firstCustomerCreatedAt: now,
      firstSiteCreatedAt: now,
      firstJobCompletedAt: now,
      firstPhotoUploadedAt: now,
      firstReportGeneratedAt: now,
    };
    expect(computeActivationScore(row)).toBe(100);
  });

  test('computeActivationScore returns 20 per completed milestone', () => {
    const row = {
      firstCustomerCreatedAt: new Date(),
      firstSiteCreatedAt: null,
      firstJobCompletedAt: null,
      firstPhotoUploadedAt: null,
      firstReportGeneratedAt: null,
    };
    expect(computeActivationScore(row)).toBe(20);
  });

  test('getNextRecommendedAction returns first incomplete milestone', () => {
    const row = {
      firstCustomerCreatedAt: new Date(),
      firstSiteCreatedAt: null,
      firstJobCompletedAt: null,
      firstPhotoUploadedAt: null,
      firstReportGeneratedAt: null,
    };
    const next = getNextRecommendedAction(row);
    expect(next?.milestone).toBe('first_site_created');
    expect(next?.label).toContain('site');
  });

  test('getNextRecommendedAction returns null when complete', () => {
    const now = new Date();
    const row = {
      firstCustomerCreatedAt: now,
      firstSiteCreatedAt: now,
      firstJobCompletedAt: now,
      firstPhotoUploadedAt: now,
      firstReportGeneratedAt: now,
    };
    expect(getNextRecommendedAction(row)).toBeNull();
  });

  test('isMilestoneComplete tracks all five milestones', () => {
    const row = {
      firstCustomerCreatedAt: new Date(),
      firstSiteCreatedAt: null,
      firstJobCompletedAt: null,
      firstPhotoUploadedAt: null,
      firstReportGeneratedAt: null,
    };
    expect(isMilestoneComplete(row, 'first_customer_created')).toBe(true);
    expect(isMilestoneComplete(row, 'first_report_generated')).toBe(false);
    expect(ACTIVATION_MILESTONES).toHaveLength(5);
  });

  test('normalizeCustomerKey lowercases and trims', () => {
    expect(normalizeCustomerKey('  Acme Ltd  ')).toBe('acme ltd');
  });

  test('normalizeSiteKey includes postcode when present', () => {
    expect(normalizeSiteKey('10 High St', 'sw1a 1aa')).toBe('10 high st|SW1A 1AA');
  });
});
