import { supabase } from '../supabase';
import type {
  AppointmentDTO,
  CalendarView,
  CreateAppointmentInput,
  MoveAppointmentInput,
  RecurrenceScope,
  RecurrenceIntervalType,
  TechnicianWorkloadDTO,
} from '../scheduling/types';

async function authFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function fetchCalendar(view: CalendarView, anchor: Date) {
  const params = new URLSearchParams({
    view,
    start: anchor.toISOString(),
  });
  return authFetch(`/api/scheduling/calendar?${params.toString()}`) as Promise<{
    view: CalendarView;
    start: string;
    end: string;
    appointments: AppointmentDTO[];
  }>;
}

export async function createAppointment(input: CreateAppointmentInput) {
  const data = await authFetch('/api/scheduling/appointments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data as { appointment: AppointmentDTO };
}

export async function updateAppointment(
  id: string,
  input: Partial<CreateAppointmentInput> & { status?: AppointmentDTO['status'] },
  scope: RecurrenceScope = 'occurrence',
) {
  const data = await authFetch(`/api/scheduling/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, scope }),
  });
  return data as { appointment: AppointmentDTO };
}

export async function moveAppointment(id: string, input: MoveAppointmentInput) {
  const data = await authFetch(`/api/scheduling/appointments/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data as { appointment: AppointmentDTO };
}

export async function deleteAppointment(id: string, scope: RecurrenceScope = 'occurrence') {
  return authFetch(`/api/scheduling/appointments/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ scope }),
  });
}

export async function assignTechnicianToAppointment(appointmentId: string, technicianId: string) {
  const data = await authFetch(`/api/scheduling/appointments/${appointmentId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ technicianId }),
  });
  return data as { appointment: AppointmentDTO };
}

export async function fetchTechnicians() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  const companyRes = await fetch('/api/technicians', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!companyRes.ok) return [] as Array<{ id: string; name: string; email: string }>;
  const data = await companyRes.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchTeamWorkload(start: Date, end: Date, technicianId: string) {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  return authFetch(`/api/scheduling/technicians/${technicianId}/schedule?${params.toString()}`) as Promise<{
    appointments: AppointmentDTO[];
    workload: TechnicianWorkloadDTO | null;
    teamWorkload: TechnicianWorkloadDTO[];
  }>;
}

export async function createRecurringSeries(input: {
  intervalType: RecurrenceIntervalType;
  intervalDays?: number | null;
  anchorStart: string;
  endsAt?: string | null;
  clientName: string;
  address: string;
  postcode?: string | null;
  treatment?: string | null;
  notes?: string | null;
  durationMinutes?: number;
  technicianIds?: string[];
}) {
  return authFetch('/api/scheduling/recurring', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type { AppointmentDTO, CalendarView, RecurrenceScope };
