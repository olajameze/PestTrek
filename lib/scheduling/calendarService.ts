import type { PrismaClient } from '@prisma/client';
import { listAppointments } from './appointmentService';
import type { AppointmentDTO, CalendarView } from './types';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function resolveCalendarRange(view: CalendarView, anchor: Date): { start: Date; end: Date } {
  switch (view) {
    case 'day':
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case 'week':
      return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
    case 'month':
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    default:
      return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
  }
}

export async function getCalendarAppointments(
  prisma: PrismaClient,
  companyId: string,
  view: CalendarView,
  anchor: Date,
  technicianId?: string,
): Promise<{ view: CalendarView; start: string; end: string; appointments: AppointmentDTO[] }> {
  const { start, end } = resolveCalendarRange(view, anchor);
  const appointments = await listAppointments(prisma, companyId, start, end, technicianId);
  return {
    view,
    start: start.toISOString(),
    end: end.toISOString(),
    appointments,
  };
}
