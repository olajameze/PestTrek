import { expect, test } from '@playwright/test';
import { buildFollowUpQueue, startOfLocalDay } from '../lib/followUpQueue';

const baseNow = startOfLocalDay(new Date('2026-06-10T12:00:00Z')).getTime();

function entry(
  id: string,
  followUpDate: Date | null,
  overrides: Partial<{ notes: string | null; status: string | null }> = {},
) {
  return {
    id,
    clientName: `Client ${id}`,
    address: '1 Test St',
    treatment: 'Rodent',
    followUpDate,
    notes: overrides.notes ?? null,
    status: overrides.status ?? 'open',
  };
}

test.describe('follow-up queue', () => {
  test('buckets overdue, today, and upcoming within seven days', () => {
    const result = buildFollowUpQueue(
      [
        entry('overdue', new Date('2026-06-08T10:00:00Z')),
        entry('today', new Date('2026-06-10T15:00:00Z')),
        entry('upcoming', new Date('2026-06-14T09:00:00Z')),
        entry('later', new Date('2026-06-20T09:00:00Z')),
      ],
      baseNow,
    );

    expect(result.overdue.map((row) => row.id)).toEqual(['overdue']);
    expect(result.today.map((row) => row.id)).toEqual(['today']);
    expect(result.upcoming.map((row) => row.id)).toEqual(['upcoming']);
    expect(result.totalOpen).toBe(3);
  });

  test('includes open entries with follow-up notes but no date in upcoming', () => {
    const result = buildFollowUpQueue(
      [entry('notes-only', null, { notes: 'Needs follow-up visit' })],
      baseNow,
    );

    expect(result.upcoming).toHaveLength(1);
    expect(result.totalOpen).toBe(1);
  });

  test('ignores completed jobs', () => {
    const result = buildFollowUpQueue(
      [entry('done', new Date('2026-06-08T10:00:00Z'), { status: 'completed' })],
      baseNow,
    );

    expect(result.totalOpen).toBe(0);
  });
});
