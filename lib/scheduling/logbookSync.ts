import type { PrismaClient } from '@prisma/client';
import { recordLogbookActivationMilestones } from '../activation/companyActivation';
import { notifyJobComplete } from '../comms/jobCompleteNotifier';
import {
  findAppointmentById,
  updateAppointment,
} from './repositories/appointmentRepository';
import { NotFoundError } from './validation';

export async function syncLogbookOnComplete(
  prisma: PrismaClient,
  companyId: string,
  appointmentId: string,
): Promise<string> {
  const appointment = await findAppointmentById(prisma, companyId, appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  const technicianIds = appointment.appointmentTechnicians.map((link) => link.technicianId);
  const treatment = appointment.treatment?.trim() || 'Scheduled visit';
  const date = appointment.scheduledStart;

  if (appointment.logbookEntryId) {
    await prisma.logbookEntry.update({
      where: { id: appointment.logbookEntryId },
      data: {
        date,
        startTime: appointment.scheduledStart,
        endTime: appointment.scheduledEnd,
        status: 'completed',
        clientName: appointment.clientName,
        address: appointment.address,
        postcode: appointment.postcode,
        treatment,
        ...(appointment.customerId ? { customerId: appointment.customerId } : {}),
        ...(appointment.siteId ? { siteId: appointment.siteId } : {}),
      },
    });
    await prisma.logbookEntryTechnician.deleteMany({ where: { logbookEntryId: appointment.logbookEntryId } });
    if (technicianIds.length > 0) {
      await prisma.logbookEntryTechnician.createMany({
        data: technicianIds.map((technicianId) => ({
          logbookEntryId: appointment.logbookEntryId!,
          technicianId,
        })),
        skipDuplicates: true,
      });
    }
    await recordLogbookActivationMilestones(prisma, companyId, {
      clientName: appointment.clientName,
      address: appointment.address,
      postcode: appointment.postcode,
      status: 'completed',
    });
    void notifyJobComplete(prisma, companyId, appointment.logbookEntryId).catch((e) =>
      console.error('[logbookSync] job complete notify failed', e),
    );
    return appointment.logbookEntryId;
  }

  const primaryTechnicianId = technicianIds[0];
  if (!primaryTechnicianId) {
    throw new NotFoundError('At least one technician is required to complete and sync to logbook');
  }

  const entry = await prisma.logbookEntry.create({
    data: {
      company: { connect: { id: companyId } },
      date,
      startTime: appointment.scheduledStart,
      endTime: appointment.scheduledEnd,
      clientName: appointment.clientName,
      address: appointment.address,
      postcode: appointment.postcode,
      treatment,
      notes: appointment.notes,
      status: 'completed',
      ...(appointment.customerId ? { customer: { connect: { id: appointment.customerId } } } : {}),
      ...(appointment.siteId ? { site: { connect: { id: appointment.siteId } } } : {}),
      logbookEntryTechnicians: {
        create: technicianIds.map((technicianId) => ({ technicianId })),
      },
    },
  });

  await updateAppointment(prisma, appointmentId, {
    logbookEntry: { connect: { id: entry.id } },
  });

  await recordLogbookActivationMilestones(prisma, companyId, {
    clientName: appointment.clientName,
    address: appointment.address,
    postcode: appointment.postcode,
    status: 'completed',
  });
  void notifyJobComplete(prisma, companyId, entry.id).catch((e) =>
    console.error('[logbookSync] job complete notify failed', e),
  );

  return entry.id;
}
