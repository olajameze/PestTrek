import type { PrismaClient } from '@prisma/client';
import { findOverlappingForTechnicians } from './repositories/appointmentRepository';
import { ConflictError } from './validation';

export async function assertNoTechnicianConflicts(
  prisma: PrismaClient,
  companyId: string,
  technicianIds: string[],
  start: Date,
  end: Date,
  excludeAppointmentId?: string,
): Promise<void> {
  if (technicianIds.length === 0) return;
  const overlaps = await findOverlappingForTechnicians(
    prisma,
    companyId,
    technicianIds,
    start,
    end,
    excludeAppointmentId,
  );
  if (overlaps.length === 0) return;
  const conflict = overlaps[0];
  throw new ConflictError(
    `Technician double booking: "${conflict.clientName}" at ${conflict.scheduledStart.toISOString()}`,
  );
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}
