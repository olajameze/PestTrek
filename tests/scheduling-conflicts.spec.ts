import { test, expect } from '@playwright/test';
import { intervalsOverlap } from '../lib/scheduling/conflictService';

test.describe('scheduling conflict detection', () => {
  test('detects overlapping intervals', () => {
    const aStart = new Date('2026-06-30T09:00:00.000Z');
    const aEnd = new Date('2026-06-30T10:00:00.000Z');
    const bStart = new Date('2026-06-30T09:30:00.000Z');
    const bEnd = new Date('2026-06-30T11:00:00.000Z');
    expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  test('allows adjacent non-overlapping intervals', () => {
    const aStart = new Date('2026-06-30T09:00:00.000Z');
    const aEnd = new Date('2026-06-30T10:00:00.000Z');
    const bStart = new Date('2026-06-30T10:00:00.000Z');
    const bEnd = new Date('2026-06-30T11:00:00.000Z');
    expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
