import type {
  CreateAppointmentInput,
  CreateRecurringInput,
  MoveAppointmentInput,
  RecurrenceIntervalType,
  RecurrenceScope,
} from './types';

const INTERVAL_TYPES: RecurrenceIntervalType[] = ['weekly', 'fortnightly', 'monthly', 'custom'];
const SCOPES: RecurrenceScope[] = ['occurrence', 'series'];

export function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} is required`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`Invalid ${field}`);
  }
  return parsed;
}

export function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseRequiredString(value: unknown, field: string): string {
  const parsed = parseOptionalString(value);
  if (!parsed) throw new ValidationError(`${field} is required`);
  return parsed;
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function parseRecurrenceScope(value: unknown): RecurrenceScope {
  if (typeof value === 'string' && SCOPES.includes(value as RecurrenceScope)) {
    return value as RecurrenceScope;
  }
  return 'occurrence';
}

export function parseIntervalType(value: unknown): RecurrenceIntervalType {
  if (typeof value === 'string' && INTERVAL_TYPES.includes(value as RecurrenceIntervalType)) {
    return value as RecurrenceIntervalType;
  }
  throw new ValidationError('Invalid interval type');
}

export function validateDateRange(start: Date, end: Date): void {
  if (end.getTime() <= start.getTime()) {
    throw new ValidationError('scheduledEnd must be after scheduledStart');
  }
}

export function validateCreateAppointment(body: unknown): CreateAppointmentInput {
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const scheduledStart = parseDate(row.scheduledStart, 'scheduledStart');
  const scheduledEnd = parseDate(row.scheduledEnd, 'scheduledEnd');
  validateDateRange(scheduledStart, scheduledEnd);
  return {
    clientName: parseRequiredString(row.clientName, 'clientName'),
    address: parseRequiredString(row.address, 'address'),
    postcode: parseOptionalString(row.postcode),
    treatment: parseOptionalString(row.treatment),
    notes: parseOptionalString(row.notes),
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
    technicianIds: parseStringArray(row.technicianIds),
    logbookEntryId: parseOptionalString(row.logbookEntryId),
  };
}

export function validateMoveAppointment(body: unknown): MoveAppointmentInput {
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const scheduledStart = parseDate(row.scheduledStart, 'scheduledStart');
  const scheduledEnd = parseDate(row.scheduledEnd, 'scheduledEnd');
  validateDateRange(scheduledStart, scheduledEnd);
  return {
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
    scope: parseRecurrenceScope(row.scope),
  };
}

export function validateCreateRecurring(body: unknown): CreateRecurringInput {
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const intervalType = parseIntervalType(row.intervalType);
  const intervalDays =
    typeof row.intervalDays === 'number' && row.intervalDays > 0 ? Math.floor(row.intervalDays) : null;
  if (intervalType === 'custom' && !intervalDays) {
    throw new ValidationError('intervalDays is required for custom interval');
  }
  const anchorStart = parseDate(row.anchorStart, 'anchorStart');
  const endsAt = row.endsAt ? parseDate(row.endsAt, 'endsAt') : null;
  return {
    intervalType,
    intervalDays,
    anchorStart: anchorStart.toISOString(),
    endsAt: endsAt?.toISOString() ?? null,
    clientName: parseRequiredString(row.clientName, 'clientName'),
    address: parseRequiredString(row.address, 'address'),
    postcode: parseOptionalString(row.postcode),
    treatment: parseOptionalString(row.treatment),
    notes: parseOptionalString(row.notes),
    durationMinutes:
      typeof row.durationMinutes === 'number' && row.durationMinutes > 0
        ? Math.floor(row.durationMinutes)
        : 60,
    technicianIds: parseStringArray(row.technicianIds),
  };
}

export class ValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
