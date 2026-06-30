import type { AppointmentDTO, TechnicianWorkloadDTO } from './types';

const demoTechnicians = [
  { id: 'demo-tech-1', name: 'Jamie Cole', email: 'jamie@demo.pesttrace.test' },
  { id: 'demo-tech-2', name: 'Priya Shah', email: 'priya@demo.pesttrace.test' },
];

function atHour(dayOffset: number, hour: number, durationMinutes: number): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getSchedulingDemoAppointments(): AppointmentDTO[] {
  const now = new Date().toISOString();
  const slots = [
    { clientName: 'Harper Farm', address: '16 Manor Rd, Bristol', day: 0, hour: 9, tech: demoTechnicians[0] },
    { clientName: 'Green & Sons', address: '4 Chapel St, Bath', day: 0, hour: 11, tech: demoTechnicians[1] },
    { clientName: 'Elm House', address: '22 Summer Ln, Bristol', day: 1, hour: 10, tech: demoTechnicians[0] },
    { clientName: 'Riverside Cafe', address: '8 Quay St, Bristol', day: 2, hour: 14, tech: demoTechnicians[1] },
    { clientName: 'Oak Veterinary', address: '3 Park Ave, Bath', day: 3, hour: 9, tech: demoTechnicians[0], status: 'completed' as const },
  ];

  return slots.map((slot, index) => {
    const { start, end } = atHour(slot.day, slot.hour, 90);
    return {
      id: `demo-appt-${index + 1}`,
      companyId: 'demo-company',
      logbookEntryId: null,
      recurringAppointmentId: null,
      clientName: slot.clientName,
      address: slot.address,
      postcode: 'BS1 4DJ',
      treatment: 'General pest inspection',
      notes: 'Demo appointment for local preview',
      scheduledStart: start,
      scheduledEnd: end,
      status: slot.status ?? 'scheduled',
      technicians: [slot.tech],
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function getSchedulingDemoTechnicians() {
  return demoTechnicians;
}

export function getSchedulingDemoWorkload(): TechnicianWorkloadDTO[] {
  const appointments = getSchedulingDemoAppointments().filter((a) => a.status === 'scheduled');
  return demoTechnicians.map((tech) => {
    const assigned = appointments.filter((a) => a.technicians.some((t) => t.id === tech.id));
    const totalMinutes = assigned.reduce((sum, a) => {
      return sum + (new Date(a.scheduledEnd).getTime() - new Date(a.scheduledStart).getTime()) / 60_000;
    }, 0);
    return {
      technicianId: tech.id,
      name: tech.name,
      appointmentCount: assigned.length,
      totalMinutes: Math.round(totalMinutes),
    };
  });
}

export function isSchedulingDemoMode(queryDemo: string | string[] | undefined): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('demo');
    if (fromUrl === '1' || fromUrl === 'true') return true;
  }
  const value = Array.isArray(queryDemo) ? queryDemo[0] : queryDemo;
  return value === '1' || value === 'true';
}

/** Local dev: allow viewing scheduling UI without signing in. */
export function isSchedulingLocalPreviewEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}
