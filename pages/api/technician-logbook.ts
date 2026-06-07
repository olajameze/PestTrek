import { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { supabase } from '../../lib/supabase';
import { prisma } from '../../lib/prisma';
import { createSignedPhotoUrl, createSignedPhotoUrls } from '../../lib/supabase-admin';
import { hasSubscriptionAccess } from '../../lib/subscriptionAccess';
import { normalizeAuthEmail } from '../../lib/auth/userSession';
import { technicianEmailWhere } from '../../lib/auth/technicianGate';
import { scheduleIntelligenceIngest } from '../../lib/intelligence/ingestLogbookEntry';
import { getPostalCodeConfig } from '../../lib/postalCode';
import { recordLogbookActivationMilestones } from '../../lib/activation/companyActivation';

const TECH_PROPERTY_TYPES = new Set([
  'residential_house',
  'residential_flat',
  'commercial',
  'agricultural',
  'other',
]);

type LogbookPhotoRecord = { url: string };
type LogbookEntryWithPhotos = {
  id: string;
  companyId: string;
  date: Date;
  clientName: string;
  address: string;
  postcode: string | null;
  propertyType: string | null;
  treatment: string;
  notes: string | null;
  rooms: unknown;
  baitBoxesPlaced: string | null;
  poisonUsed: string | null;
  followUpDate: Date | null;
  photoUrl: string | null;
  signature: string | null;
  createdAt: Date | null;
  technicianIds: string[];
  photos: LogbookPhotoRecord[];
};

function normalizeRoomsValue(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const rooms = value
      .map((room) => {
        if (typeof room === 'string') return room.trim();
        if (room && typeof room === 'object' && 'name' in room) {
          const record = room as Record<string, unknown>;
          return typeof record.name === 'string' ? record.name.trim() : '';
        }
        return '';
      })
      .filter((room) => room.length > 0);
    return rooms.length > 0 ? rooms : undefined;
  }

  if (typeof value === 'string') {
    const rooms = value
      .split(',')
      .map((room) => room.trim())
      .filter((room) => room.length > 0);
    return rooms.length > 0 ? rooms : undefined;
  }

  return undefined;
}

async function signEntryPhotos<T extends { photoUrl: string | null; photos: { url: string }[] }>(entry: T): Promise<T> {
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
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user || !user.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const authEmail = normalizeAuthEmail(user.email);
    const technician = await prisma.technician.findFirst({
      where: technicianEmailWhere(authEmail),
      include: {
        company: {
          select: {
            plan: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            country: true,
          },
        },
      },
    });

    if (!technician) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!hasSubscriptionAccess(technician.company)) {
      return res.status(403).json({ error: 'Trial expired. Upgrade required to continue using Pest Trace.' });
    }

    if (req.method === 'GET') {
      const rawEntries = await prisma.logbookEntry.findMany({
        where: {
          logbookEntryTechnicians: {
            some: { technicianId: technician.id }
          },
        },
        orderBy: { date: 'desc' },
        include: {
          photos: { select: { url: true }, orderBy: { createdAt: 'asc' } },
          logbookEntryTechnicians: { select: { technicianId: true } },
        },
      });

      // Explicitly map the data to the expected type
      const entries: LogbookEntryWithPhotos[] = rawEntries.map((entry) => {
        const { logbookEntryTechnicians, ...rest } = entry;
        return {
          ...rest,
          technicianIds: logbookEntryTechnicians.map((lt) => lt.technicianId),
        };
      });

      return res.status(200).json(await Promise.all(entries.map((entry) => signEntryPhotos(entry))));
    }

    if (req.method === 'POST') {
      const {
        date,
        clientName,
        address,
        treatment,
        notes,
        rooms,
        baitBoxesPlaced,
        poisonUsed,
        followUpDate,
        photoUrl,
        photoUrls,
        signature,
        postcode,
        propertyType,
      } = req.body;

      if (!date || !clientName || !address || !treatment) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const postcodeConfig = getPostalCodeConfig(technician.company.country);
      const postcodeStr = typeof postcode === 'string' ? postcode.trim() : '';
      if (!postcodeStr && postcodeConfig.required) {
        return res.status(400).json({ error: `${postcodeConfig.label} is required` });
      }
      if (postcodeStr && !postcodeConfig.validate(postcodeStr)) {
        return res.status(400).json({ error: `Enter a valid ${postcodeConfig.label}` });
      }

      const propertyTypeStr = typeof propertyType === 'string' ? propertyType.trim() : '';
      if (!propertyTypeStr || !TECH_PROPERTY_TYPES.has(propertyTypeStr)) {
        return res.status(400).json({ error: 'Property type is required' });
      }

      const normalizedPhotoUrls = Array.isArray(photoUrls)
        ? photoUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0).slice(0, 4)
        : [];
      const primaryPhotoUrl = normalizedPhotoUrls.length > 1
        ? JSON.stringify(normalizedPhotoUrls)
        : normalizedPhotoUrls[0] || (typeof photoUrl === 'string' && photoUrl.trim().length > 0 ? photoUrl : null);
      const normalizedRooms = normalizeRoomsValue(rooms);
      const parsedFollowUpDate = typeof followUpDate === 'string' && followUpDate.trim().length > 0
        ? new Date(followUpDate)
        : null;
      if (parsedFollowUpDate && Number.isNaN(parsedFollowUpDate.getTime())) {
        return res.status(400).json({ error: 'Invalid follow-up date format' });
      }

      const createdEntryId = randomUUID();
      const fullEntry = await prisma.$transaction(async (tx) => {
        await tx.logbookEntry.create({
          data: {
            id: createdEntryId,
            companyId: technician.companyId,
            date: new Date(date),
            clientName: typeof clientName === 'string' ? clientName.trim() : clientName,
            address: typeof address === 'string' ? address.trim() : address,
            postcode: postcodeStr ? postcodeConfig.normalize(postcodeStr) : null,
            propertyType: propertyTypeStr,
            treatment: typeof treatment === 'string' ? treatment.trim() : treatment,
            notes: typeof notes === 'string' ? notes.trim() : notes,
            rooms: normalizedRooms,
            baitBoxesPlaced: typeof baitBoxesPlaced === 'string' && baitBoxesPlaced.trim().length > 0 ? baitBoxesPlaced.trim() : null,
            poisonUsed: typeof poisonUsed === 'string' && poisonUsed.trim().length > 0 ? poisonUsed.trim() : null,
            followUpDate: parsedFollowUpDate,
            status: 'open',
            photoUrl: primaryPhotoUrl,
            signature,
            createdAt: new Date(),
          },
        });

        await tx.logbookEntryTechnician.create({
          data: {
            logbookEntryId: createdEntryId,
            technicianId: technician.id,
          },
        });

        if (normalizedPhotoUrls.length > 0) {
          await tx.logbookPhoto.createMany({
            data: normalizedPhotoUrls.map((url) => ({
              id: randomUUID(),
              logbookEntryId: createdEntryId,
              url,
              createdAt: new Date(),
            })),
          });
        }

        return tx.logbookEntry.findUnique({
          where: { id: createdEntryId },
          include: {
            photos: {
              select: { url: true },
              orderBy: { createdAt: 'asc' },
            },
            logbookEntryTechnicians: {
              select: { technicianId: true },
            },
          },
        });
      });

      if (!fullEntry) {
        return res.status(500).json({ error: 'Failed to load created technician logbook entry' });
      }

      const { logbookEntryTechnicians, ...rest } = fullEntry;
      const entryWithIds: LogbookEntryWithPhotos = {
        ...rest,
        technicianIds: logbookEntryTechnicians.map((lt) => lt.technicianId),
        photos: rest.photos as LogbookPhotoRecord[],
      };

      scheduleIntelligenceIngest(createdEntryId);

      void recordLogbookActivationMilestones(prisma, technician.companyId, {
        clientName: entryWithIds.clientName,
        address: entryWithIds.address,
        postcode: entryWithIds.postcode,
        status: 'open',
        photoUrl: entryWithIds.photoUrl,
        photosCount: entryWithIds.photos.length,
      }).catch((e) => console.error('Activation milestone error:', e));

      return res.status(201).json(await signEntryPhotos(entryWithIds));
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error('Technician logbook API error:', err);
    return res.status(500).json({
      error: 'Technician logbook request failed',
      details: String(err),
    });
  }
}
