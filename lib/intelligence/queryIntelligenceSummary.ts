import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export type IntelligenceQueryFilters = {
  dateFrom: Date;
  dateTo: Date;
  pestType?: string;
  infestationSeverity?: string;
  propertyType?: string;
  region?: string;
  treatmentOutcome?: string;
};

/** Minimum bucket size before exposing a postcode area label (k-anonymity). */
const K_ANON = 5;

export async function queryIntelligenceSummary(filters: IntelligenceQueryFilters) {
  const baseWhere: Prisma.IntelligencePestEventWhereInput = {
    occurredAt: { gte: filters.dateFrom, lte: filters.dateTo },
    ...(filters.pestType ? { pestType: filters.pestType } : {}),
    ...(filters.infestationSeverity ? { infestationSeverity: filters.infestationSeverity } : {}),
    ...(filters.propertyType ? { propertyType: filters.propertyType } : {}),
    ...(filters.region
      ? { postcodeArea: { startsWith: filters.region.toUpperCase().replace(/\s+/g, '') } }
      : {}),
    ...(filters.treatmentOutcome ? { treatmentOutcome: filters.treatmentOutcome } : {}),
  };

  const total = await prisma.intelligencePestEvent.count({ where: baseWhere });

  const byPestType = await prisma.intelligencePestEvent.groupBy({
    by: ['pestType'],
    where: baseWhere,
    _count: { pestType: true },
    orderBy: { _count: { pestType: 'desc' } },
    take: 24,
  });

  const byOutcome = await prisma.intelligencePestEvent.groupBy({
    by: ['treatmentOutcome'],
    where: baseWhere,
    _count: { treatmentOutcome: true },
    orderBy: { _count: { treatmentOutcome: 'desc' } },
  });

  const bySeverity = await prisma.intelligencePestEvent.groupBy({
    by: ['infestationSeverity'],
    where: baseWhere,
    _count: { infestationSeverity: true },
  });

  const byProperty = await prisma.intelligencePestEvent.groupBy({
    by: ['propertyType'],
    where: baseWhere,
    _count: { propertyType: true },
    orderBy: { _count: { propertyType: 'desc' } },
  });

  const bySeason = await prisma.intelligencePestEvent.groupBy({
    by: ['season'],
    where: { ...baseWhere, season: { not: null } },
    _count: { season: true },
  });

  const byEffectiveness = await prisma.intelligencePestEvent.groupBy({
    by: ['treatmentEffectiveness'],
    where: { ...baseWhere, treatmentEffectiveness: { not: null } },
    _count: { treatmentEffectiveness: true },
  });

  const postcodeGroups = await prisma.intelligencePestEvent.groupBy({
    by: ['postcodeArea'],
    where: { ...baseWhere, postcodeArea: { not: null } },
    _count: { postcodeArea: true },
    orderBy: { _count: { postcodeArea: 'desc' } },
    take: 40,
  });

  const rankedPostcodes = postcodeGroups
    .filter((r) => r.postcodeArea && r._count.postcodeArea >= K_ANON)
    .map((r) => ({ area: r.postcodeArea as string, count: r._count.postcodeArea }));

  const postcodeLowVolume = postcodeGroups
    .filter((r) => r.postcodeArea && r._count.postcodeArea > 0 && r._count.postcodeArea < K_ANON)
    .slice(0, 20)
    .map((r) => ({
      area: r.postcodeArea as string,
      count: r._count.postcodeArea,
      band: `<${K_ANON}` as const,
    }));

  const redactedLowVolume = postcodeLowVolume.length > 0;

  const scatter = await prisma.intelligencePestEvent.findMany({
    where: {
      ...baseWhere,
      geoLatRounded: { not: null },
      geoLngRounded: { not: null },
    },
    select: { geoLatRounded: true, geoLngRounded: true, activityScore: true, pestType: true },
    take: 800,
  });

  const dayTrend = await prisma.$queryRaw<Array<{ d: Date; c: bigint }>>(Prisma.sql`
    SELECT date_trunc('day', occurred_at)::timestamptz AS d, COUNT(*)::bigint AS c
    FROM intelligence_pest_event
    WHERE occurred_at >= ${filters.dateFrom}
      AND occurred_at <= ${filters.dateTo}
      ${filters.pestType ? Prisma.sql`AND pest_type = ${filters.pestType}` : Prisma.empty}
      ${filters.infestationSeverity ? Prisma.sql`AND infestation_severity = ${filters.infestationSeverity}` : Prisma.empty}
      ${filters.propertyType ? Prisma.sql`AND property_type = ${filters.propertyType}` : Prisma.empty}
      ${filters.region ? Prisma.sql`AND postcode_area LIKE ${`${filters.region.toUpperCase().replace(/\s+/g, '')}%`}` : Prisma.empty}
      ${filters.treatmentOutcome ? Prisma.sql`AND treatment_outcome = ${filters.treatmentOutcome}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1 ASC
  `);

  const monthTrend = await prisma.$queryRaw<Array<{ d: Date; c: bigint }>>(Prisma.sql`
    SELECT date_trunc('month', occurred_at)::timestamptz AS d, COUNT(*)::bigint AS c
    FROM intelligence_pest_event
    WHERE occurred_at >= ${filters.dateFrom}
      AND occurred_at <= ${filters.dateTo}
      ${filters.pestType ? Prisma.sql`AND pest_type = ${filters.pestType}` : Prisma.empty}
      ${filters.infestationSeverity ? Prisma.sql`AND infestation_severity = ${filters.infestationSeverity}` : Prisma.empty}
      ${filters.propertyType ? Prisma.sql`AND property_type = ${filters.propertyType}` : Prisma.empty}
      ${filters.region ? Prisma.sql`AND postcode_area LIKE ${`${filters.region.toUpperCase().replace(/\s+/g, '')}%`}` : Prisma.empty}
      ${filters.treatmentOutcome ? Prisma.sql`AND treatment_outcome = ${filters.treatmentOutcome}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1 ASC
  `);

  return {
    total,
    byPestType: byPestType.map((r) => ({ name: r.pestType, count: r._count.pestType })),
    byOutcome: byOutcome.map((r) => ({ name: r.treatmentOutcome, count: r._count.treatmentOutcome })),
    bySeverity: bySeverity.map((r) => ({ name: r.infestationSeverity, count: r._count.infestationSeverity })),
    byProperty: byProperty.map((r) => ({ name: r.propertyType, count: r._count.propertyType })),
    bySeason: bySeason.map((r) => ({ name: String(r.season), count: r._count.season })),
    byEffectiveness: byEffectiveness.map((r) => ({
      name: String(r.treatmentEffectiveness),
      count: r._count.treatmentEffectiveness,
    })),
    postcodeRankings: rankedPostcodes,
    postcodeLowVolume,
    postcodeRedactedNote: redactedLowVolume
      ? `Areas with fewer than ${K_ANON} events are grouped below (k-anonymity); only outward codes with ≥${K_ANON} events appear in the main ranking.`
      : null,
    geoDisclaimer:
      'Coordinates are approximate UK postcode centroids (outward code), not GPS fixes. Maps are indicative only — not a street-level survey.',
    scatterCapNote:
      'Scatter overlay is capped at 800 points per query; dense regions may be underrepresented.',
    heatmapPoints: scatter.map((p) => ({
      lat: p.geoLatRounded as number,
      lng: p.geoLngRounded as number,
      weight: p.activityScore,
      pestType: p.pestType,
    })),
    dayTrend: dayTrend.map((row) => ({
      day: row.d.toISOString().slice(0, 10),
      count: Number(row.c),
    })),
    monthTrend: monthTrend.map((row) => ({
      month: row.d.toISOString().slice(0, 7),
      count: Number(row.c),
    })),
    executive: {
      periodEvents: total,
      topPest: byPestType[0]?.pestType ?? null,
      topPestShare:
        total > 0 && byPestType[0]
          ? Math.round((byPestType[0]._count.pestType / total) * 1000) / 10
          : null,
    },
  };
}
