import { test, expect } from '@playwright/test';
import { generateOccurrenceDates } from '../lib/scheduling/recurringDates';

test.describe('scheduling recurring dates', () => {
  test('generates weekly occurrences within horizon', () => {
    const anchor = new Date('2026-06-01T09:00:00.000Z');
    const horizon = new Date('2026-06-22T09:00:00.000Z');
    const dates = generateOccurrenceDates({
      anchorStart: anchor,
      horizonEnd: horizon,
      seriesEnd: null,
      intervalType: 'weekly',
      intervalDays: null,
      exceptionDates: [],
    });
    expect(dates.length).toBeGreaterThanOrEqual(3);
    expect(dates[0].toISOString()).toBe(anchor.toISOString());
  });

  test('skips exception dates', () => {
    const anchor = new Date('2026-06-01T09:00:00.000Z');
    const horizon = new Date('2026-06-15T09:00:00.000Z');
    const dates = generateOccurrenceDates({
      anchorStart: anchor,
      horizonEnd: horizon,
      seriesEnd: null,
      intervalType: 'weekly',
      intervalDays: null,
      exceptionDates: ['2026-06-08'],
    });
    expect(dates.some((date) => date.toISOString().startsWith('2026-06-08'))).toBe(false);
  });
});
