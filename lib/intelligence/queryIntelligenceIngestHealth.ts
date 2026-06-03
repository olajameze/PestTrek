import { prisma } from '../prisma';

export type IntelligenceIngestHealth = {
  totalEvents: number;
  totalLogbooks: number;
  /** Share of logbook rows represented in intelligence (≥1 event per row ≈ 100%). */
  ingestRatioPercent: number | null;
  lastIngestedAt: string | null;
  scatterCap: number;
  scatterCapNote: string;
};

const SCATTER_CAP = 800;

export async function queryIntelligenceIngestHealth(): Promise<IntelligenceIngestHealth> {
  const [totalEvents, totalLogbooks, lastRow] = await Promise.all([
    prisma.intelligencePestEvent.count(),
    prisma.logbookEntry.count(),
    prisma.intelligencePestEvent.findFirst({
      orderBy: { ingestedAt: 'desc' },
      select: { ingestedAt: true },
    }),
  ]);

  const ingestRatioPercent =
    totalLogbooks > 0 ? Math.min(100, Math.round((totalEvents / totalLogbooks) * 1000) / 10) : null;

  return {
    totalEvents,
    totalLogbooks,
    ingestRatioPercent,
    lastIngestedAt: lastRow?.ingestedAt?.toISOString() ?? null,
    scatterCap: SCATTER_CAP,
    scatterCapNote: `Regional scatter maps show at most ${SCATTER_CAP} points per query; dense areas may be underrepresented.`,
  };
}
