import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { normalizeAuthEmail } from '../../../lib/auth/userSession';
import { technicianEmailWhere } from '../../../lib/auth/technicianGate';
import { deleteIntelligenceForLogbookEntry, scheduleIntelligenceIngest } from '../../../lib/intelligence/ingestLogbookEntry';
import { recordJobCompletedActivation } from '../../../lib/activation/companyActivation';

type BulkAction = 'set_status' | 'delete';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const authEmail = normalizeAuthEmail(user.email);
  const company = await prisma.company.findUnique({
    where: { email: authEmail },
    select: { id: true },
  });
  if (!company) {
    const technician = await prisma.technician.findFirst({
      where: technicianEmailWhere(authEmail),
      select: { id: true },
    });
    if (technician) {
      return res.status(403).json({
        error: 'Technician accounts cannot run bulk report actions.',
        code: 'ROLE_TECHNICIAN',
      });
    }
    return res.status(404).json({ error: 'Company not found' });
  }

  const action = req.body?.action as BulkAction;
  const entryIds = Array.isArray(req.body?.entryIds)
    ? req.body.entryIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  if (!entryIds.length) return res.status(400).json({ error: 'At least one entry is required.' });

  const scopedEntries = await prisma.logbookEntry.findMany({
    where: { id: { in: entryIds }, companyId: company.id },
    select: { id: true },
  });
  const scopedIds = scopedEntries.map((entry) => entry.id);
  if (!scopedIds.length) return res.status(404).json({ error: 'No matching company entries found.' });

  if (action === 'set_status') {
    const status = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';
    const allowedStatuses = new Set(['open', 'completed', 'cancelled', 'canceled']);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    const result = await prisma.logbookEntry.updateMany({
      where: { id: { in: scopedIds } },
      data: { status },
    });
    scopedIds.forEach((entryId) => scheduleIntelligenceIngest(entryId));
    if (status === 'completed') {
      void recordJobCompletedActivation(prisma, company.id).catch((e) =>
        console.error('Activation job completed error:', e),
      );
    }
    return res.status(200).json({ updated: result.count, affectedIds: scopedIds });
  }

  if (action === 'delete') {
    await Promise.all(
      scopedIds.map((entryId) => deleteIntelligenceForLogbookEntry(entryId, company.id)),
    );
    await prisma.$transaction(async (tx) => {
      await tx.logbookEntryTechnician.deleteMany({
        where: { logbookEntryId: { in: scopedIds } },
      });
      await tx.logbookPhoto.deleteMany({
        where: { logbookEntryId: { in: scopedIds } },
      });
      await tx.baitStation.deleteMany({
        where: { logbookEntryId: { in: scopedIds } },
      });
      await tx.logbookEntry.deleteMany({
        where: { id: { in: scopedIds } },
      });
    });
    return res.status(200).json({ deleted: scopedIds.length, affectedIds: scopedIds });
  }

  return res.status(400).json({ error: 'Unsupported action.' });
}
