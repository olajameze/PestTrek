import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { prisma } from '../../lib/prisma';
import { createSignedPhotoUrl, createSignedPhotoUrls } from '../../lib/supabase-admin';
import { writeAuditLog } from '../../lib/audit/log';
import { logger } from '../../lib/logger';
import { hasSubscriptionAccess } from '../../lib/subscriptionAccess';
import { scheduleIntelligenceIngest } from '../../lib/intelligence/ingestLogbookEntry';
import { normalizeAuthEmail } from '../../lib/auth/userSession';
import { technicianEmailWhere } from '../../lib/auth/technicianGate';
import { getPostalCodeConfig } from '../../lib/postalCode';
import { recordLogbookActivationMilestones } from '../../lib/activation/companyActivation';
import { canUseBusinessFeatures } from '../../lib/businessFeatures/planAccess';
import { resolveCustomerSiteFromText } from '../../lib/crm/customerService';
function tryParseJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeRoomsValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (Array.isArray(value)) {
    const normalized = value
      .map((room) => {
        if (typeof room === 'string') return room.trim();
        if (room && typeof room === 'object' && 'name' in room) {
          const record = room as Record<string, unknown>;
          return {
            name: typeof record.name === 'string' ? record.name.trim() : String(record.name ?? '').trim(),
            note: typeof record.note === 'string' ? record.note.trim() : undefined,
          };
        }
        return String(room).trim();
      })
      .filter((room) => {
        if (typeof room === 'string') return room.length > 0;
        return typeof room === 'object' && room !== null && 'name' in room && typeof room.name === 'string' && room.name.length > 0;
      });
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = tryParseJson(trimmed);
    if (Array.isArray(parsed)) {
      return normalizeRoomsValue(parsed);
    }

    return trimmed.split(',').map((room) => room.trim()).filter((room) => room.length > 0);
  }

  return undefined;
}

async function signEntryPhotos<T extends { photoUrl: string | null; photos: { url: string }[] }>(
  entry: T,
): Promise<T> {
  const signedPhotos = await createSignedPhotoUrls(entry.photos.map((photo) => photo.url));
  const signedPrimaryPhoto = entry.photoUrl ? await createSignedPhotoUrl(entry.photoUrl) : null;
  return {
    ...entry,
    photoUrl: signedPrimaryPhoto,
    photos: entry.photos.map((photo, index) => ({
      ...photo,
      url: signedPhotos[index] || photo.url,
    })),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

    // GET: fetch logbook entries
    if (req.method === 'GET') {
      const { companyId, search } = req.query;
      const whereBase: Prisma.LogbookEntryWhereInput = { companyId: companyId as string };
      const where: Prisma.LogbookEntryWhereInput = search
        ? {
            ...whereBase,
            OR: [
              { clientName: { contains: search as string, mode: 'insensitive' } },
              { address: { contains: search as string, mode: 'insensitive' } },
            ],
          }
        : whereBase;

      const authEmail = normalizeAuthEmail(user.email);
      let company = await prisma.company.findFirst({
        where: { id: companyId as string, email: authEmail },
        select: {
          id: true,
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          paymentGraceEndsAt: true,
        },
      });

      if (!company) {
        const onRoster = await prisma.technician.findFirst({
          where: { ...technicianEmailWhere(authEmail), companyId: companyId as string },
          select: { id: true },
        });
        if (onRoster) {
          company = await prisma.company.findFirst({
            where: { id: companyId as string },
            select: {
              id: true,
              plan: true,
              subscriptionStatus: true,
              trialEndsAt: true,
              paymentGraceEndsAt: true,
            },
          });
        }
      }

      if (!company) return res.status(403).json({ error: 'Forbidden' });
      if (!hasSubscriptionAccess(company)) {
        return res.status(403).json({ error: 'Trial expired. Upgrade required to continue using Pest Trace.' });
      }
      const entries = await prisma.logbookEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          photos: { select: { url: true }, orderBy: { createdAt: 'asc' } },
          logbookEntryTechnicians: { include: { technician: true } },
        },
      });

      return res.status(200).json(await Promise.all(entries.map(signEntryPhotos)));
    }

    // POST: create a new logbook entry
    if (req.method === 'POST') {
      const {
        companyId,
        date,
        clientName,
        address,
        treatment,
        notes,
        technicianIds,
        rooms,
        baitBoxesPlaced,
        poisonUsed,
        startTime,
        endTime,
        status,
        photoUrl,
        photoUrls,
        signature,
        price,
        cancellationReason,
        postcode,
        propertyType,
      } = req.body;

      if (
        !companyId ||
        !date ||
        !clientName ||
        !address ||
        !treatment ||
        !Array.isArray(technicianIds) ||
        technicianIds.length === 0
      ) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const normalizedPropertyType =
        typeof propertyType === 'string' && propertyType.trim().length > 0 ? propertyType.trim() : null;

      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid date' });

      const company = await prisma.company.findFirst({
        where: { id: companyId, email: user.email },
        select: {
          id: true,
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          country: true,
        },
      });
      if (!company) return res.status(403).json({ error: 'Forbidden' });
      if (!hasSubscriptionAccess(company)) {
        return res.status(403).json({ error: 'Trial expired. Upgrade required to continue using Pest Trace.' });
      }
      const postcodeConfig = getPostalCodeConfig(company.country);

      let normalizedPostcode: string | null = null;
      if (typeof postcode === 'string' && postcode.trim().length > 0) {
        if (!postcodeConfig.validate(postcode.trim())) {
          return res.status(400).json({ error: `Invalid ${postcodeConfig.label}` });
        }
        normalizedPostcode = postcodeConfig.normalize(postcode);
      }

      const technicians = await prisma.technician.findMany({
        where: { id: { in: technicianIds }, companyId },
      });
      if (technicians.length !== technicianIds.length) {
        return res.status(400).json({ error: 'Invalid technician(s)' });
      }

      const normalizedPhotoUrls = Array.isArray(photoUrls)
        ? photoUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0).slice(0, 4)
        : [];
      const primaryPhotoUrl =
        normalizedPhotoUrls.length > 1
          ? JSON.stringify(normalizedPhotoUrls)
          : normalizedPhotoUrls[0] ||
            (typeof photoUrl === 'string' && photoUrl.trim().length > 0 ? photoUrl : null);

      // Build data object with proper type (no `any`)
      const entryData: Prisma.LogbookEntryCreateInput = {
        company: { connect: { id: company.id } },
        date: parsedDate,
        clientName,
        address,
        treatment,
        notes: notes || null,
        photoUrl: primaryPhotoUrl,
        signature: typeof signature === 'string' && signature.trim().length > 0 ? signature : null,
        baitBoxesPlaced: baitBoxesPlaced ?? null,
        poisonUsed: poisonUsed ?? null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        status: status || 'open',
        recommendation:
          (status || 'open').toLowerCase() === 'cancelled' ||
          (status || 'open').toLowerCase() === 'canceled'
            ? (typeof cancellationReason === 'string' ? cancellationReason.trim() : '') || null
            : null,
        price: price ? new Prisma.Decimal(price) : null,
        postcode: normalizedPostcode,
        propertyType: normalizedPropertyType,
      };

      const normalizedRooms = normalizeRoomsValue(rooms);
      if (normalizedRooms) {
        entryData.rooms = normalizedRooms;
      }

      if (canUseBusinessFeatures(company.plan)) {
        try {
          const linked = await resolveCustomerSiteFromText(
            prisma,
            company.id,
            clientName,
            address,
            normalizedPostcode,
            normalizedPropertyType,
          );
          entryData.customer = { connect: { id: linked.customerId } };
          entryData.site = { connect: { id: linked.siteId } };
        } catch {
          /* keep free-text only if CRM link fails */
        }
      }

      // Add photos relation if any
      if (normalizedPhotoUrls.length > 0) {
        entryData.photos = {
          create: normalizedPhotoUrls.map((url) => ({
            id: randomUUID(),
            url,
            createdAt: new Date(),
          })),
        };
      }

      const fullEntry = await prisma.$transaction(async (tx) => {
        const newEntry = await tx.logbookEntry.create({
          data: entryData,
        });

        await tx.logbookEntryTechnician.createMany({
          data: technicianIds.map((techId: string) => ({
            logbookEntryId: newEntry.id,
            technicianId: techId,
          })),
        });

        return tx.logbookEntry.findUnique({
          where: { id: newEntry.id },
          include: {
            photos: { select: { url: true }, orderBy: { createdAt: 'asc' } },
            logbookEntryTechnicians: { include: { technician: true } },
          },
        });
      });

      await writeAuditLog({
        userId: user.id,
        action: 'CREATE',
        tableName: 'logbook_entries',
        recordId: fullEntry!.id,
        newValues: {
          companyId,
          date,
          clientName,
          address,
          treatment,
          technicianIds,
        },
        ipAddress: (req.headers['x-forwarded-for'] as string | undefined) ?? req.socket.remoteAddress ?? null,
      });

      scheduleIntelligenceIngest(fullEntry!.id);

      void recordLogbookActivationMilestones(prisma, company.id, {
        clientName: fullEntry!.clientName,
        address: fullEntry!.address,
        postcode: fullEntry!.postcode,
        status: fullEntry!.status,
        photoUrl: fullEntry!.photoUrl,
        photosCount: fullEntry!.photos.length,
      }).catch((e) => logger.error(`Activation milestone error: ${String(e)}`));

      return res.status(201).json(await signEntryPhotos(fullEntry!));
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    logger.error(`Logbook API error: ${String(err)}`);
    return res.status(500).json({ error: 'Logbook request failed', details: String(err) });
  }
}