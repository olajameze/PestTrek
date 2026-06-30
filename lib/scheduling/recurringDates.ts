import type { RecurrenceIntervalType } from './types';
import { parseExceptionDates } from './repositories/recurringRepository';

export function addInterval(date: Date, intervalType: RecurrenceIntervalType, intervalDays: number | null): Date {
  const next = new Date(date.getTime());
  switch (intervalType) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'fortnightly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'custom':
      next.setDate(next.getDate() + (intervalDays ?? 7));
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

export function generateOccurrenceDates(params: {
  anchorStart: Date;
  horizonEnd: Date;
  seriesEnd: Date | null;
  intervalType: RecurrenceIntervalType;
  intervalDays: number | null;
  exceptionDates: string[];
}): Date[] {
  const { anchorStart, horizonEnd, seriesEnd, intervalType, intervalDays, exceptionDates } = params;
  const exceptionSet = new Set(exceptionDates);
  const dates: Date[] = [];
  let cursor = new Date(anchorStart.getTime());
  const hardEnd = seriesEnd && seriesEnd.getTime() < horizonEnd.getTime() ? seriesEnd : horizonEnd;

  while (cursor.getTime() <= hardEnd.getTime()) {
    const dayKey = cursor.toISOString().slice(0, 10);
    if (!exceptionSet.has(dayKey)) {
      dates.push(new Date(cursor.getTime()));
    }
    cursor = addInterval(cursor, intervalType, intervalDays);
    if (dates.length > 500) break;
  }
  return dates;
}

export function extractExceptionDates(raw: unknown): string[] {
  return parseExceptionDates(raw);
}

export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
