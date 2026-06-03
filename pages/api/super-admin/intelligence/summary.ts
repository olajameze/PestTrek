import type { NextApiRequest, NextApiResponse } from 'next';
import { isSuperAdminRequest } from '../../../../lib/superAdminRequestGuard';
import { queryIntelligenceSummary } from '../../../../lib/intelligence/queryIntelligenceSummary';
import { queryIntelligenceIngestHealth } from '../../../../lib/intelligence/queryIntelligenceIngestHealth';

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSuperAdminRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 90);

  const dateFrom = parseDate(typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined, defaultFrom);
  const dateTo = parseDate(typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined, now);

  const pestType = typeof req.query.pestType === 'string' && req.query.pestType.trim() ? req.query.pestType.trim() : undefined;
  const infestationSeverity =
    typeof req.query.infestationSeverity === 'string' && req.query.infestationSeverity.trim()
      ? req.query.infestationSeverity.trim()
      : undefined;
  const propertyType =
    typeof req.query.propertyType === 'string' && req.query.propertyType.trim() ? req.query.propertyType.trim() : undefined;
  const region = typeof req.query.region === 'string' && req.query.region.trim() ? req.query.region.trim() : undefined;
  const treatmentOutcome =
    typeof req.query.treatmentOutcome === 'string' && req.query.treatmentOutcome.trim()
      ? req.query.treatmentOutcome.trim()
      : undefined;

  try {
    const [summary, ingestHealth] = await Promise.all([
      queryIntelligenceSummary({
        dateFrom,
        dateTo,
        pestType,
        infestationSeverity,
        propertyType,
        region,
        treatmentOutcome,
      }),
      queryIntelligenceIngestHealth(),
    ]);
    return res.status(200).json({ ...summary, ingestHealth });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({
      error: 'Intelligence query failed. Ensure DB tables exist (run prisma/sql/intelligence_tables.sql).',
      details: message,
    });
  }
}
