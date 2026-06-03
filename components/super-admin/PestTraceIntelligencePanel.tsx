'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { saveIntelligenceExecutivePdf } from '../../lib/intelligence/intelligenceExecutivePdf';
import { buildGeoHeatmap, heatmapCssColor } from '../../lib/intelligence/geoHeatmap';
import { formatPestTypeLabel, pestTypeFilterOptions } from '../../lib/intelligence/pestTypeLabels';
import type { IntelligenceIngestHealth } from '../../lib/intelligence/queryIntelligenceIngestHealth';
import IntelligenceGeoHeatmap from './IntelligenceGeoHeatmap';
import Button from '../ui/Button';
import { useToast } from '../ui/ToastProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type Summary = {
  total: number;
  byPestType: { name: string; count: number }[];
  byOutcome: { name: string; count: number }[];
  bySeverity: { name: string; count: number }[];
  byProperty: { name: string; count: number }[];
  bySeason: { name: string; count: number }[];
  byEffectiveness: { name: string; count: number }[];
  postcodeRankings: { area: string; count: number }[];
  postcodeRedactedNote: string | null;
  heatmapPoints: { lat: number; lng: number; weight: number; pestType: string }[];
  dayTrend: { day: string; count: number }[];
  monthTrend: { month: string; count: number }[];
  executive: { periodEvents: number; topPest: string | null; topPestShare: number | null };
  postcodeLowVolume?: { area: string; count: number; band: string }[];
  geoDisclaimer?: string | null;
  scatterCapNote?: string | null;
  ingestHealth?: IntelligenceIngestHealth;
};

// ─── Design tokens ────────────────────────────────────────────────────────────

/** Ordered palette used for multi-series and categorical charts. */
const PALETTE = [
  '#2F855A', // green  (brand primary)
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#64748B', // slate
];

/** Outcome-specific colours so the chart is self-explanatory. */
const OUTCOME_COLOR: Record<string, string> = {
  completed: '#10B981',
  open: '#F59E0B',
  cancelled: '#EF4444',
};

/** Severity-specific colours. */
const SEVERITY_COLOR: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  unknown: '#94A3B8',
};

// ─── Shared chart helpers ─────────────────────────────────────────────────────

/** A consistent, polished tooltip used across every chart. */
function ChartTooltip({
  active,
  payload,
  label,
  totalForPercent,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  totalForPercent?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      {label && (
        <p className="mb-1.5 truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
      )}
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: item.color ?? '#71717a' }}
          />
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {item.value.toLocaleString()}
            {totalForPercent != null && totalForPercent > 0 && (
              <span className="ml-1 text-xs text-zinc-500">
                ({((item.value / totalForPercent) * 100).toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Wrapper that gives every chart a consistent heading and optional subtitle. */
function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h4>
      {subtitle && (
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

/** Custom donut chart label — shows percentage inside the arc. */
function DonutLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  // Guard against undefined props that Recharts may pass in edge cases.
  if (
    cx == null ||
    cy == null ||
    midAngle == null ||
    innerRadius == null ||
    outerRadius == null ||
    percent == null ||
    percent < 0.04
  ) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PestTraceIntelligencePanel() {
  const { showToast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [pestType, setPestType] = useState('');
  const [infestationSeverity, setInfestationSeverity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [region, setRegion] = useState('');
  const [treatmentOutcome, setTreatmentOutcome] = useState('');

  // ── Derived data ───────────────────────────────────────────────────────────

  const heatmapModel = useMemo(() => {
    if (!summary?.heatmapPoints.length) return null;
    return buildGeoHeatmap(
      summary.heatmapPoints.map((p) => ({ lat: p.lat, lng: p.lng, weight: p.weight })),
      { cols: 48, rows: 34 },
    );
  }, [summary]);

  const maxScatterWeight = useMemo(() => {
    if (!summary?.heatmapPoints.length) return 1;
    return Math.max(1, ...summary.heatmapPoints.map((p) => p.weight));
  }, [summary]);

  /** Average daily count — used as a reference line on the trend chart. */
  const avgDailyCount = useMemo(() => {
    if (!summary?.dayTrend.length) return 0;
    const total = summary.dayTrend.reduce((s, d) => s + d.count, 0);
    return Math.round(total / summary.dayTrend.length);
  }, [summary]);

  /** Max postcode count — used to size inline bars in the rankings table. */
  const maxPostcodeCount = useMemo(() => {
    if (!summary?.postcodeRankings.length) return 1;
    return Math.max(1, ...summary.postcodeRankings.map((r) => r.count));
  }, [summary]);

  const pestFilterOptions = useMemo(() => {
    if (!summary?.byPestType.length) return [];
    return pestTypeFilterOptions(summary.byPestType.map((p) => p.name));
  }, [summary]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('dateFrom', dateFrom);
    p.set('dateTo', dateTo);
    if (pestType.trim()) p.set('pestType', pestType.trim());
    if (infestationSeverity.trim()) p.set('infestationSeverity', infestationSeverity.trim());
    if (propertyType.trim()) p.set('propertyType', propertyType.trim());
    if (region.trim()) p.set('region', region.trim());
    if (treatmentOutcome.trim()) p.set('treatmentOutcome', treatmentOutcome.trim());
    return p.toString();
  }, [dateFrom, dateTo, pestType, infestationSeverity, propertyType, region, treatmentOutcome]);

  // ── Data fetching & actions ────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/intelligence/summary?${queryString}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      setSummary((await res.json()) as Summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load intelligence');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const runReindexBatch = async () => {
    setReindexing(true);
    setError('');
    try {
      let cursor: string | null = null;
      let batches = 0;
      let totalOk = 0;
      do {
        const res = await fetch('/api/super-admin/intelligence/reindex', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 800, cursor }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || 'Reindex failed');
        }
        const body = (await res.json()) as {
          ok: number;
          hasMore: boolean;
          nextCursor: string | null;
        };
        totalOk += body.ok;
        cursor = body.hasMore ? body.nextCursor : null;
        batches += 1;
        if (batches > 200) break;
      } while (cursor);
      showToast('Reindex', `Processed ${totalOk} records (batched). Refresh charts when complete.`, 'success');
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reindex failed';
      setError(msg);
      showToast('Reindex failed', msg, 'error');
    } finally {
      setReindexing(false);
    }
  };

  const runResetAggregates = async () => {
    if (
      !window.confirm(
        'Clear ALL anonymised intelligence rows?\n\n• Main logbook data is NOT deleted.\n• Charts stay empty until new jobs are logged (automatic ingest).\n• Avoid "Backfill from logbooks" after this if old test logbooks still exist — that would re-import them.',
      )
    ) {
      return;
    }
    setResetting(true);
    setError('');
    try {
      const res = await fetch('/api/super-admin/intelligence/reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; deletedRows?: number };
      if (!res.ok) throw new Error(body.error || 'Reset failed');
      showToast(
        'Intelligence cleared',
        `Removed ${body.deletedRows ?? 0} aggregate row(s). New signups will appear when they create logbook entries.`,
        'success',
      );
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      setError(msg);
      showToast('Reset failed', msg, 'error');
    } finally {
      setResetting(false);
    }
  };

  const downloadCsv = () => {
    window.location.href = `/api/super-admin/intelligence/export?format=csv&${queryString}`;
    showToast('Export', 'CSV download started', 'success');
  };

  const downloadPdf = async () => {
    if (!summary) return;
    try {
      await saveIntelligenceExecutivePdf(summary, { dateFrom, dateTo, logoPath: '/pest-trace.png' });
      void fetch('/api/super-admin/intelligence/log-export', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'pdf', dateFrom, dateTo }),
      });
      showToast('PDF', 'Executive report downloaded', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PDF export failed';
      showToast('PDF failed', msg, 'error');
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading && !summary) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <span className="spinner" />
          <span className="text-sm">Loading intelligence layer…</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 dark:text-zinc-100">

      {/* ── Header & actions ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-zinc-900">
        <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
          PestTrace Intelligence
        </h2>
        <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-200/80">
          Anonymised, aggregated telemetry derived from field reports. No client names, full
          addresses, or technician identities are stored in this layer (UK GDPR: aggregated
          industry statistics only). Charts read from the intelligence table — use{' '}
          <strong>Refresh</strong> to reload; <strong>Clear aggregates</strong> for test resets;{' '}
          <strong>Backfill</strong> to re-import logbooks.
        </p>
        {summary?.ingestHealth ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-200/60 bg-white/80 px-3 py-2 text-xs dark:border-emerald-900 dark:bg-zinc-900/60">
              <span className="font-semibold text-emerald-900 dark:text-emerald-200">Events ingested</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                {summary.ingestHealth.totalEvents.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200/60 bg-white/80 px-3 py-2 text-xs dark:border-emerald-900 dark:bg-zinc-900/60">
              <span className="font-semibold text-emerald-900 dark:text-emerald-200">Logbooks (source)</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                {summary.ingestHealth.totalLogbooks.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200/60 bg-white/80 px-3 py-2 text-xs dark:border-emerald-900 dark:bg-zinc-900/60">
              <span className="font-semibold text-emerald-900 dark:text-emerald-200">Ingest ratio</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                {summary.ingestHealth.ingestRatioPercent != null
                  ? `${summary.ingestHealth.ingestRatioPercent}%`
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200/60 bg-white/80 px-3 py-2 text-xs dark:border-emerald-900 dark:bg-zinc-900/60">
              <span className="font-semibold text-emerald-900 dark:text-emerald-200">Last ingest</span>
              <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">
                <span suppressHydrationWarning>
                  {summary.ingestHealth.lastIngestedAt
                    ? new Date(summary.ingestHealth.lastIngestedAt).toLocaleString()
                    : '—'}
                </span>
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadCsv}>
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void downloadPdf()} disabled={!summary}>
            Executive PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void runReindexBatch()}
            disabled={reindexing || resetting}
          >
            {reindexing ? 'Reindexing…' : 'Backfill from logbooks'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runResetAggregates()}
            disabled={resetting || reindexing}
          >
            {resetting ? 'Clearing…' : 'Clear aggregates'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Filters</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Date from
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Date to
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Pest type
            <select
              value={pestType}
              onChange={(e) => setPestType(e.target.value)}
              className="form-select mt-1 w-full"
            >
              <option value="">Any pest type</option>
              {pestFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Severity
            <select
              value={infestationSeverity}
              onChange={(e) => setInfestationSeverity(e.target.value)}
              className="form-select mt-1 w-full"
            >
              <option value="">Any</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Property type
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="form-select mt-1 w-full"
            >
              <option value="">Any</option>
              <option value="commercial">Commercial</option>
              <option value="residential_flat">Residential flat</option>
              <option value="residential_house">Residential house</option>
              <option value="residential_unknown">Residential unknown</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Region (postcode prefix)
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="form-input mt-1 w-full"
              placeholder="e.g. SW1"
            />
          </label>
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Outcome
            <select
              value={treatmentOutcome}
              onChange={(e) => setTreatmentOutcome(e.target.value)}
              className="form-select mt-1 w-full"
            >
              <option value="">Any</option>
              <option value="completed">Completed</option>
              <option value="open">Open</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      </div>

      {summary ? (
        <>
          {/* ── KPI row ────────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Events (filtered)
              </p>
              <p className="mt-2 text-4xl font-extrabold tabular-nums text-zinc-900 dark:text-white">
                {summary.total.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Within selected date range &amp; filters
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Leading pest category
              </p>
              <p className="mt-2 text-xl font-bold leading-tight text-emerald-900 dark:text-emerald-100">
                {summary.executive.topPest
                  ? formatPestTypeLabel(summary.executive.topPest)
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-400/70">
                Highest volume pest type in period
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Share of volume
              </p>
              <p className="mt-2 text-4xl font-extrabold tabular-nums text-blue-800 dark:text-blue-200">
                {summary.executive.topPestShare != null
                  ? `${summary.executive.topPestShare}%`
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-blue-600/70 dark:text-blue-400/70">
                Of all filtered events
              </p>
            </div>
          </div>

          {/* ── Trend charts ──────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Daily activity trend — area chart with gradient fill */}
            <ChartCard
              title="Daily activity trend"
              subtitle="Number of logged pest events per day. The dashed line shows the period average."
            >
              <div className="mt-4 h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.dayTrend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2F855A" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2F855A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {avgDailyCount > 0 && (
                      <ReferenceLine
                        y={avgDailyCount}
                        stroke="#2F855A"
                        strokeDasharray="5 3"
                        strokeWidth={1.5}
                        label={{
                          value: `Avg ${avgDailyCount}`,
                          fill: '#2F855A',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#2F855A"
                      strokeWidth={2.5}
                      fill="url(#gradGreen)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#2F855A', stroke: '#fff', strokeWidth: 2 }}
                      name="Events"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Monthly buckets — bar chart with coloured bars */}
            <ChartCard
              title="Monthly event volume"
              subtitle="Total pest events grouped by calendar month. Hover a bar for the exact count."
            >
              <div className="mt-4 h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.monthTrend}
                    margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.07)' }} />
                    <Bar dataKey="count" name="Events" radius={[6, 6, 0, 0]} maxBarSize={52}>
                      {summary.monthTrend.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        style={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* ── Category & severity ───────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Pest categories — horizontal bar, ranked by volume */}
            <ChartCard
              title="Pest categories (normalised)"
              subtitle="Activity volume by pest type. Wider bars = more jobs in this period."
            >
              <div className="mt-4 h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.byPestType}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 9, fill: '#52525b' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                      tickFormatter={(v: string) => formatPestTypeLabel(String(v))}
                    />
                    <Tooltip
                      content={<ChartTooltip totalForPercent={summary.total} />}
                      cursor={{ fill: 'rgba(47,133,90,0.06)' }}
                    />
                    <Bar dataKey="count" name="Events" radius={[0, 6, 6, 0]} maxBarSize={20}>
                      {summary.byPestType.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Severity distribution — donut chart with percentage labels */}
            <ChartCard
              title="Severity distribution"
              subtitle="Breakdown of infestations by severity level. Percentages are shown inside each arc."
            >
              <div className="mt-4 h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {summary.bySeverity.map((entry, i) => {
                        const base =
                          SEVERITY_COLOR[entry.name.toLowerCase()] ?? PALETTE[i % PALETTE.length];
                        return (
                          <linearGradient
                            key={entry.name}
                            id={`sevGrad${i}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor={base} stopOpacity={1} />
                            <stop offset="100%" stopColor={base} stopOpacity={0.75} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <Pie
                      data={summary.bySeverity}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius="38%"
                      outerRadius="65%"
                      paddingAngle={3}
                      labelLine={false}
                      label={DonutLabel}
                    >
                      {summary.bySeverity.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={`url(#sevGrad${i})`}
                          stroke="white"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<ChartTooltip totalForPercent={summary.total} />}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(value: string) => (
                        <span style={{ color: '#52525b' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* ── Outcome & property type ────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {summary.byEffectiveness.length > 0 ? (
            <ChartCard
              title="Treatment effectiveness"
              subtitle="Inferred from outcome and revisit signals — heuristic, not a field survey score."
            >
              <div className="mt-4 h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.byEffectiveness.map((r) => ({
                      ...r,
                      label: r.name.replace(/_/g, ' '),
                    }))}
                    margin={{ top: 16, right: 8, left: -12, bottom: 0 }}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip totalForPercent={summary.total} />} />
                    <Bar dataKey="count" name="Events" radius={[6, 6, 0, 0]} fill="#2F855A" maxBarSize={48}>
                      <LabelList
                        dataKey="count"
                        position="top"
                        style={{ fontSize: 10, fill: '#52525b', fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            ) : null}

            {/* Outcome distribution — colour-coded by outcome */}
            <ChartCard
              title="Treatment outcome breakdown"
              subtitle="Green = completed · Amber = open · Red = cancelled"
            >
              <div className="mt-4 h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.byOutcome}
                    margin={{ top: 16, right: 8, left: -12, bottom: 0 }}
                    barCategoryGap="40%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="count" name="Events" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {summary.byOutcome.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={
                            OUTCOME_COLOR[entry.name.toLowerCase()] ??
                            PALETTE[0]
                          }
                        />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        style={{ fontSize: 11, fill: '#52525b', fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Property-type risk profile */}
            <ChartCard
              title="Property-type risk profile"
              subtitle="Events by property category — shows where pest activity is most concentrated."
            >
              <div className="mt-4 h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.byProperty}
                    margin={{ top: 16, right: 8, left: -12, bottom: 0 }}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      stroke="#d4d4d8"
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip totalForPercent={summary.total} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="count" name="Events" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {summary.byProperty.map((_, i) => (
                        <Cell key={i} fill={PALETTE[2 + (i % (PALETTE.length - 2))]} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        style={{ fontSize: 11, fill: '#52525b', fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* ── Seasonal distribution ─────────────────────────────────── */}
          {summary.bySeason.length > 0 && (
            <ChartCard
              title="Seasonal activity pattern"
              subtitle="Aggregated event volume by season — useful for forecasting treatment demand."
            >
              <div className="mt-4 h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="20%"
                    outerRadius="90%"
                    data={summary.bySeason.map((s, i) => ({
                      ...s,
                      fill: PALETTE[i % PALETTE.length],
                    }))}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      dataKey="count"
                      background={{ fill: '#f4f4f5' }}
                      cornerRadius={6}
                      label={{ position: 'insideStart', fill: '#fff', fontSize: 11, fontWeight: 600 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value: string) => (
                        <span style={{ color: '#52525b' }}>{value}</span>
                      )}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* ── Regional activity map ──────────────────────────────────── */}
          <ChartCard
            title="Regional activity map"
            subtitle="Approximate UK postcode centroids (not GPS). Left: density grid; right: scatter (capped)."
          >
            {(summary.geoDisclaimer || summary.scatterCapNote) && (
              <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                {summary.geoDisclaimer}
                {summary.scatterCapNote ? ` ${summary.scatterCapNote}` : ''}
              </p>
            )}
            <div className="mt-4 grid gap-6 xl:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Density heatmap
                </p>
                <IntelligenceGeoHeatmap points={summary.heatmapPoints} cols={48} rows={34} />
              </div>
              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Scatter overlay
                </p>
                {summary.heatmapPoints.length === 0 ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                    No geo-bucketed points in this filter window.
                  </div>
                ) : (
                  <div className="h-[min(420px,65vh)] min-h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" />
                        <XAxis
                          type="number"
                          dataKey="lng"
                          name="Longitude"
                          stroke="#d4d4d8"
                          tick={{ fontSize: 10, fill: '#71717a' }}
                          tickLine={false}
                          domain={
                            heatmapModel
                              ? [heatmapModel.minLng, heatmapModel.maxLng]
                              : ['auto', 'auto']
                          }
                          allowDataOverflow
                        />
                        <YAxis
                          type="number"
                          dataKey="lat"
                          name="Latitude"
                          stroke="#d4d4d8"
                          tick={{ fontSize: 10, fill: '#71717a' }}
                          tickLine={false}
                          domain={
                            heatmapModel
                              ? [heatmapModel.minLat, heatmapModel.maxLat]
                              : ['auto', 'auto']
                          }
                          allowDataOverflow
                        />
                        <ZAxis type="number" dataKey="weight" range={[48, 420]} />
                        <Tooltip cursor={{ stroke: '#2F855A', strokeWidth: 1 }} />
                        <Scatter name="Events" data={summary.heatmapPoints}>
                          {summary.heatmapPoints.map((entry, index) => (
                            <Cell
                              key={`${entry.lat}-${entry.lng}-${index}`}
                              fill={heatmapCssColor(entry.weight / maxScatterWeight)}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </ChartCard>

          {/* ── Postcode area rankings ─────────────────────────────────── */}
          <ChartCard title="Postcode area rankings (k-anonymous)">
            {summary.postcodeRedactedNote && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {summary.postcodeRedactedNote}
              </p>
            )}
            {(summary.postcodeLowVolume?.length ?? 0) > 0 ? (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Low-volume areas (&lt;5 events)</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {summary.postcodeLowVolume!.map((r) => `${r.area} (${r.count})`).join(' · ')}
                </p>
              </div>
            ) : null}
            <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-100 dark:bg-zinc-800">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Outward code
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Events
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {summary.postcodeRankings.map((r) => (
                    <tr
                      key={r.area}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      <td className="px-3 py-2 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {r.area}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {r.count.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {/* Inline relative bar */}
                        <div className="flex items-center gap-2">
                          <div className="h-2 min-w-[80px] max-w-[180px] flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <div
                              className="h-2 rounded-full bg-emerald-500 transition-all"
                              style={{
                                width: `${Math.round((r.count / maxPostcodeCount) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">
                            {Math.round((r.count / maxPostcodeCount) * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      ) : null}
    </div>
  );
}
