import type { PrismaClient } from '@prisma/client';
import { assertNoTechnicianConflicts } from './conflictService';
import { mapAppointment } from './mappers';
import { notifySchedulingAssigned } from './notifySchedulingEvent';
import {
  findAppointmentById,
  findAppointmentsInRange,
  setAppointmentTechnicians,
} from './repositories/appointmentRepository';
import type { AppointmentDTO, TechnicianWorkloadDTO } from './types';
import { NotFoundError } from './validation';
import { getAppointment } from './appointmentService';

export async function assignTechnician(
  prisma: PrismaClient,
  companyId: string,
  appointmentId: string,
  technicianId: string,
): Promise<AppointmentDTO> {
  const appointment = await findAppointmentById(prisma, companyId, appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');
  if (appointment.status !== 'scheduled') {
    throw new NotFoundError('Only scheduled appointments can be assigned');
  }

  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, companyId },
  });
  if (!technician) throw new NotFoundError('Technician not found');

  const existingIds = appointment.appointmentTechnicians.map((link) => link.technicianId);
  const nextIds = existingIds.includes(technicianId) ? existingIds : [...existingIds, technicianId];

  await assertNoTechnicianConflicts(
    prisma,
    companyId,
    [technicianId],
    appointment.scheduledStart,
    appointment.scheduledEnd,
    appointmentId,
  );

  await setAppointmentTechnicians(prisma, appointmentId, nextIds);
  const updated = await getAppointment(prisma, companyId, appointmentId);
  await notifySchedulingAssigned(prisma, companyId, updated, technician.email);
  return updated;
}

export async function unassignTechnician(
  prisma: PrismaClient,
  companyId: string,
  appointmentId: string,
  technicianId: string,
): Promise<AppointmentDTO> {
  const appointment = await findAppointmentById(prisma, companyId, appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  const nextIds = appointment.appointmentTechnicians
    .map((link) => link.technicianId)
    .filter((id) => id !== technicianId);

  await setAppointmentTechnicians(prisma, appointmentId, nextIds);
  return getAppointment(prisma, companyId, appointmentId);
}

export async function getTechnicianWorkload(
  prisma: PrismaClient,
  companyId: string,
  start: Date,
  end: Date,
): Promise<TechnicianWorkloadDTO[]> {
  const technicians = await prisma.technician.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const appointments = await findAppointmentsInRange(prisma, companyId, start, end);

  return technicians.map((tech) => {
    const assigned = appointments.filter((appt) =>
      appt.appointmentTechnicians.some((link) => link.technicianId === tech.id),
    );
    const totalMinutes = assigned.reduce((sum, appt) => {
      const minutes = (appt.scheduledEnd.getTime() - appt.scheduledStart.getTime()) / 60_000;
      return sum + minutes;
    }, 0);
    return {
      technicianId: tech.id,
      name: tech.name,
      appointmentCount: assigned.length,
      totalMinutes: Math.round(totalMinutes),
    };
  });
}

export async function getTechnicianSchedule(
  prisma: PrismaClient,
  companyId: string,
  technicianId: string,
  start: Date,
  end: Date,
): Promise<AppointmentDTO[]> {
  const tech = await prisma.technician.findFirst({ where: { id: technicianId, companyId } });
  if (!tech) throw new NotFoundError('Technician not found');
  const rows = await findAppointmentsInRange(prisma, companyId, start, end, technicianId);
  return rows.map(mapAppointment);
}
