export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export type RecurrenceIntervalType = 'weekly' | 'fortnightly' | 'monthly' | 'custom';

export type RecurrenceScope = 'occurrence' | 'series';

export type CalendarView = 'day' | 'week' | 'month';

export type AppointmentTechnicianDTO = {
  id: string;
  name: string;
  email: string;
};

export type AppointmentDTO = {
  id: string;
  companyId: string;
  logbookEntryId: string | null;
  recurringAppointmentId: string | null;
  clientName: string;
  address: string;
  postcode: string | null;
  treatment: string | null;
  notes: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  technicians: AppointmentTechnicianDTO[];
  createdAt: string;
  updatedAt: string;
};

export type RecurringAppointmentDTO = {
  id: string;
  companyId: string;
  intervalType: RecurrenceIntervalType;
  intervalDays: number | null;
  anchorStart: string;
  endsAt: string | null;
  generatedUntil: string;
  exceptionDates: string[];
  isActive: boolean;
  clientName: string;
  address: string;
  postcode: string | null;
  treatment: string | null;
  notes: string | null;
  durationMinutes: number;
};

export type TechnicianWorkloadDTO = {
  technicianId: string;
  name: string;
  appointmentCount: number;
  totalMinutes: number;
};

export type SchedulingWidgetsData = {
  todayJobs: AppointmentDTO[];
  upcomingJobs: AppointmentDTO[];
  unassignedJobs: AppointmentDTO[];
  overdueJobs: AppointmentDTO[];
};

export type CreateAppointmentInput = {
  clientName: string;
  address: string;
  postcode?: string | null;
  treatment?: string | null;
  notes?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  technicianIds?: string[];
  logbookEntryId?: string | null;
};

export type UpdateAppointmentInput = Partial<CreateAppointmentInput> & {
  status?: AppointmentStatus;
};

export type MoveAppointmentInput = {
  scheduledStart: string;
  scheduledEnd: string;
  scope?: RecurrenceScope;
};

export type CreateRecurringInput = {
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
};
