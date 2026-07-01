import type { NextApiRequest, NextApiResponse } from 'next';
import { ZipArchive } from 'archiver';
import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { createSignedPhotoUrls } from '../../../lib/supabase-admin';
import { normalizeAuthEmail } from '../../../lib/auth/userSession';
import { hasSubscriptionAccess } from '../../../lib/subscriptionAccess';
import { canUseBusinessFeatures, canUseEnterpriseFeatures } from '../../../lib/businessFeatures/planAccess';
import { buildAuditReadinessSummary } from '../../../lib/compliance/auditReadiness';
import { buildAuditPackSummaryPdf } from '../../../lib/compliance/auditPackPdf';
import { parseEnterpriseSettings } from '../../../lib/enterpriseFeatures';
import { logGovernanceEvent } from '../../../lib/audit/log';

export const config = {
  api: { responseLimit: false },
};

function buildMinimalPdf(text: string): Buffer {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .split('\n')
    .slice(0, 200);
  const contentLines = escaped.map((line, i) => `1 0 0 1 50 ${800 - i * 14} Tm (${line}) Tj`).join('\n');
  const contentStream = `BT\n/F1 10 Tf\n${contentLines}\nET`;
  const objects: string[] = ['%PDF-1.4'];
  const xref: number[] = [];
  const pushObj = (obj: string) => {
    xref.push(objects.join('\n').length + 1);
    objects.push(obj);
  };
  pushObj('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  pushObj('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
  pushObj('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj');
  pushObj('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  pushObj(`5 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`);
  const xrefStart = objects.join('\n').length + 1;
  let xrefTable = 'xref\n0 6\n0000000000 65535 f \n';
  for (const off of xref) xrefTable += `${String(off).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(objects.join('\n') + '\n' + xrefTable + trailer);
}

function signatureToBuffer(signature: string): Buffer | null {
  const match = signature.match(/^data:image\/png;base64,(.+)$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

function buildJobsCsv(
  entries: Array<{
    date: Date;
    clientName: string;
    address: string;
    postcode: string | null;
    treatment: string;
    status: string | null;
  }>,
): string {
  const csvHeader = ['date', 'clientName', 'address', 'postcode', 'treatment', 'status'];
  const csvLines = [csvHeader.join(',')];
  for (const entry of entries) {
    csvLines.push(
      [
        entry.date.toISOString(),
        entry.clientName,
        entry.address,
        entry.postcode ?? '',
        entry.treatment,
        entry.status ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
  }
  return csvLines.join('\n');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'site';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const company = await prisma.company.findUnique({
    where: { email: normalizeAuthEmail(user.email) },
    select: {
      id: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      paymentGraceEndsAt: true,
      requireSignature: true,
      requirePhotos: true,
      notificationPreferences: true,
    },
  });
  if (!company) return res.status(403).json({ error: 'Only business owners can export audit packs.' });
  if (!hasSubscriptionAccess(company) || !canUseBusinessFeatures(company.plan)) {
    return res.status(403).json({ error: 'Audit pack export requires Business or Enterprise plan.' });
  }

  const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : undefined;
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 90);

  const startDate =
    typeof req.query.startDate === 'string' && !Number.isNaN(new Date(req.query.startDate).getTime())
      ? new Date(req.query.startDate)
      : defaultStart;
  const endDate =
    typeof req.query.endDate === 'string' && !Number.isNaN(new Date(req.query.endDate).getTime())
      ? new Date(req.query.endDate)
      : now;

  const entries = await prisma.logbookEntry.findMany({
    where: {
      companyId: company.id,
      date: { gte: startDate, lte: endDate },
      ...(siteId ? { siteId } : {}),
      ...(customerId && canUseEnterpriseFeatures(company.plan) ? { customerId } : {}),
    },
    include: {
      photos: { select: { url: true, createdAt: true } },
      logbookEntryTechnicians: { include: { technician: { select: { name: true } } } },
    },
    orderBy: { date: 'desc' },
    take: 300,
  });

  const technicians = await prisma.technician.findMany({
    where: { companyId: company.id },
    include: { certifications: true },
  });

  const photoPaths = entries.flatMap((entry) => entry.photos.map((p) => p.url)).slice(0, 200);
  const signedPhotos = await createSignedPhotoUrls(photoPaths);

  const csvLines = buildJobsCsv(entries);

  const jobsJson = entries.map((entry) => ({
    id: entry.id,
    date: entry.date.toISOString(),
    clientName: entry.clientName,
    address: entry.address,
    postcode: entry.postcode,
    treatment: entry.treatment,
    status: entry.status,
    notes: entry.notes,
    hasSignature: Boolean(entry.signature),
    photoCount: entry.photos.length,
    technicians: entry.logbookEntryTechnicians.map((x) => x.technician.name),
  }));

  const photosManifest = entries.flatMap((entry, entryIndex) =>
    entry.photos.map((photo, photoIndex) => ({
      entryId: entry.id,
      clientName: entry.clientName,
      storagePath: photo.url,
      signedUrl: signedPhotos[photoPaths.indexOf(photo.url)] ?? null,
      index: photoIndex,
      entryIndex,
    })),
  );

  const qualifications = await Promise.all(
    technicians.flatMap((tech) =>
      tech.certifications.map(async (cert) => ({
        technicianName: tech.name,
        fileUrl: cert.fileUrl,
        expiryDate: cert.expiryDate?.toISOString() ?? null,
        uploadedAt: cert.uploadedAt?.toISOString() ?? null,
      })),
    ),
  );

  const summary = buildAuditReadinessSummary(
    entries,
    technicians.flatMap((t) => t.certifications),
    {
      requireSignature: Boolean(company.requireSignature),
      requirePhotos: Boolean(company.requirePhotos),
    },
    now,
  );
  const branding = parseEnterpriseSettings(company.notificationPreferences).branding;
  const chemicalSummary = entries
    .map((e) => e.poisonUsed)
    .filter((v): v is string => Boolean(v && v.trim()))
    .slice(0, 15);
  const siteLabel = siteId
    ? (await prisma.site.findFirst({ where: { id: siteId, companyId: company.id }, select: { address: true } }))?.address
    : undefined;

  await logGovernanceEvent('audit_pack_export', { companyId: company.id, siteId, customerId });

  const summaryPdf = buildAuditPackSummaryPdf({
    companyName: company.name ?? 'Company',
    siteLabel,
    dateFrom: startDate,
    dateTo: endDate,
    summary,
    jobCount: entries.length,
    chemicalSummary,
    primaryColor: branding.primaryColor,
    footerText: branding.footerText || undefined,
  });

  const summaryLines = [
    'Pest Trace Audit Pack Summary',
    `Company: ${company.name ?? ''}`,
    `Compliance score: ${summary.complianceHealth.score}/100`,
    `Generated: ${now.toISOString()}`,
    `Period: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    `Jobs: ${entries.length}`,
    `Qualifications: ${qualifications.length}`,
    `Photos: ${photosManifest.length}`,
  ];

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="pesttrace-audit-pack-${Date.now()}.zip"`);

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('audit-pack archive error', err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  archive.append(csvLines, { name: 'jobs.csv' });
  archive.append(JSON.stringify(jobsJson, null, 2), { name: 'jobs.json' });
  archive.append(JSON.stringify(photosManifest, null, 2), { name: 'photos-manifest.json' });
  archive.append(JSON.stringify(qualifications, null, 2), { name: 'qualifications.json' });
  archive.append(summaryPdf, { name: 'report-summary.pdf' });
  archive.append(buildMinimalPdf(summaryLines.join('\n')), { name: 'report-summary-text.pdf' });

  let sigIndex = 0;
  for (const entry of entries) {
    if (!entry.signature) continue;
    const buf = signatureToBuffer(entry.signature);
    if (!buf) continue;
    sigIndex += 1;
    archive.append(buf, { name: `signatures/${entry.id}-${sigIndex}.png` });
    if (sigIndex >= 100) break;
  }

  const isMultiSiteEnterprise =
    customerId && canUseEnterpriseFeatures(company.plan) && !siteId;

  if (isMultiSiteEnterprise) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: company.id },
      select: { name: true, sites: { where: { archivedAt: null }, select: { id: true, label: true, address: true } } },
    });

    if (customer) {
      const siteIndexLines = [
        'Multi-site audit pack index',
        `Customer: ${customer.name}`,
        `Period: ${startDate.toISOString()} to ${endDate.toISOString()}`,
        '',
        'Sites:',
      ];

      for (const site of customer.sites) {
        const siteEntries = entries.filter((e) => e.siteId === site.id);
        const folder = `sites/${slugify(site.label ?? site.address)}`;
        archive.append(buildJobsCsv(siteEntries), { name: `${folder}/jobs.csv` });

        const siteSummary = buildAuditReadinessSummary(
          siteEntries,
          technicians.flatMap((t) => t.certifications),
          {
            requireSignature: Boolean(company.requireSignature),
            requirePhotos: Boolean(company.requirePhotos),
          },
          now,
        );
        const siteChemicals = siteEntries
          .map((e) => e.poisonUsed)
          .filter((v): v is string => Boolean(v && v.trim()))
          .slice(0, 15);

        archive.append(
          buildAuditPackSummaryPdf({
            companyName: company.name ?? 'Company',
            siteLabel: site.label ? `${site.label} — ${site.address}` : site.address,
            dateFrom: startDate,
            dateTo: endDate,
            summary: siteSummary,
            jobCount: siteEntries.length,
            chemicalSummary: siteChemicals,
            primaryColor: branding.primaryColor,
            footerText: branding.footerText || undefined,
          }),
          { name: `${folder}/report-summary.pdf` },
        );

        siteIndexLines.push(
          `- ${site.label ?? site.address}: ${siteEntries.length} jobs, score ${siteSummary.complianceHealth.score}/100`,
        );
      }

      archive.append(buildMinimalPdf(siteIndexLines.join('\n')), { name: 'multi-site-index.pdf' });
    }
  }

  await archive.finalize();
}
