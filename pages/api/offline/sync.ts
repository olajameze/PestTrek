import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import {
  recordJobCompletedActivation,
  recordLogbookActivationMilestones,
} from '../../../lib/activation/companyActivation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body as {
      operation?: 'CREATE' | 'UPDATE' | 'DELETE';
      tableName?: string;
      data?: Record<string, unknown>;
    };

    const operation = body.operation;
    const tableName = body.tableName;
    const data = body.data;

    if (!operation || !tableName || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Route to table-specific handlers
    switch (tableName) {
      case 'logbook_entries':
        return handleLogbookEntry(user.id, operation, data, res);
      case 'chemical_logs':
        return handleChemicalLog(user.id, operation, data, res);
      default:
        return res.status(400).json({ error: 'Unsupported table' });
    }
  } catch (error) {
    logger.error(`Offline sync error: ${String(error)}`);
    return res.status(500).json({ error: 'Sync failed' });
  }
}

async function handleLogbookEntry(
  userId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  data: Record<string, unknown>,
  res: NextApiResponse
) {
  try {
    switch (operation) {
      case 'CREATE':
        // NOTE: Validation + authorization are enforced in `/api/logbook-entries`.
        // Here we apply a minimal server-side insert for offline replay.
        // We require `companyId` to be present; downstream authorization should ensure user belongs to company.
        if (typeof data.companyId !== 'string' || data.companyId.trim().length === 0) {
          return res.status(400).json({ error: 'companyId is required' });
        }

        const companyId = String(data.companyId);
        const created = await prisma.logbookEntry.create({
          data: {
            companyId,
            date: typeof data.date === 'string' ? new Date(data.date) : new Date(),
            clientName: typeof data.clientName === 'string' ? data.clientName : '',
            address: typeof data.address === 'string' ? data.address : '',
            postcode: typeof data.postcode === 'string' ? data.postcode : null,
            propertyType: typeof data.propertyType === 'string' ? data.propertyType : null,
            treatment: typeof data.treatment === 'string' ? data.treatment : '',
            notes: typeof data.notes === 'string' ? data.notes : null,
            photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : null,
            signature: typeof data.signature === 'string' ? data.signature : null,
            baitBoxesPlaced: typeof data.baitBoxesPlaced === 'string' ? data.baitBoxesPlaced : null,
            poisonUsed: typeof data.poisonUsed === 'string' ? data.poisonUsed : null,
            status: typeof data.status === 'string' ? data.status : 'open',
          },
        });
        void recordLogbookActivationMilestones(prisma, companyId, {
          clientName: created.clientName,
          address: created.address,
          postcode: created.postcode,
          status: created.status,
          photoUrl: created.photoUrl,
        }).catch((e) => logger.warn(`Activation milestone error: ${String(e)}`));
        return res.status(200).json(created);
      
      case 'UPDATE':
        if (typeof data.id !== 'string' || data.id.trim().length === 0) {
          return res.status(400).json({ error: 'id is required' });
        }

        const updated = await prisma.logbookEntry.update({
          where: { id: String(data.id) },
          data: {
            ...(typeof data.clientName === 'string' ? { clientName: data.clientName } : {}),
            ...(typeof data.address === 'string' ? { address: data.address } : {}),
            ...(typeof data.postcode === 'string' ? { postcode: data.postcode } : {}),
            ...(typeof data.propertyType === 'string' ? { propertyType: data.propertyType } : {}),
            ...(typeof data.treatment === 'string' ? { treatment: data.treatment } : {}),
            ...(typeof data.notes === 'string' ? { notes: data.notes } : {}),
            ...(typeof data.status === 'string' ? { status: data.status } : {}),
          },
        });
        void recordLogbookActivationMilestones(prisma, updated.companyId, {
          clientName: updated.clientName,
          address: updated.address,
          postcode: updated.postcode,
          status: updated.status,
          photoUrl: updated.photoUrl,
        }).catch((e) => logger.warn(`Activation milestone error: ${String(e)}`));
        if (typeof data.status === 'string' && data.status.toLowerCase() === 'completed') {
          void recordJobCompletedActivation(prisma, updated.companyId).catch((e) =>
            logger.warn(`Activation job completed error: ${String(e)}`),
          );
        }
        return res.status(200).json(updated);
      
      case 'DELETE':
        if (typeof data.id !== 'string' || data.id.trim().length === 0) {
          return res.status(400).json({ error: 'id is required' });
        }
        await prisma.logbookEntry.delete({ where: { id: String(data.id) } });
        return res.status(200).json({ success: true });
    }
  } catch (error) {
    logger.warn(`Logbook sync error: ${String(error)}`);
    return res.status(500).json({ error: 'Sync failed' });
  }
}

async function handleChemicalLog(
  userId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  data: Record<string, unknown>,
  res: NextApiResponse
) {
  // Similar handler for chemical_logs when table exists
  return res.status(501).json({ error: 'Chemical logs table pending migration' });
}
