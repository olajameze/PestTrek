import type { AppointmentWithTechnicians } from './repositories/appointmentRepository';
import type { AppointmentDTO } from './types';

export function mapAppointment(row: AppointmentWithTechnicians): AppointmentDTO {
  return {
    id: row.id,
    companyId: row.companyId,
    logbookEntryId: row.logbookEntryId,
    recurringAppointmentId: row.recurringAppointmentId,
    clientName: row.clientName,
    address: row.address,
    postcode: row.postcode,
    treatment: row.treatment,
    notes: row.notes,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd: row.scheduledEnd.toISOString(),
    status: row.status as AppointmentDTO['status'],
    technicians: row.appointmentTechnicians.map((link) => ({
      id: link.technician.id,
      name: link.technician.name,
      email: link.technician.email,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAppointments(rows: AppointmentWithTechnicians[]): AppointmentDTO[] {
  return rows.map(mapAppointment);
}
