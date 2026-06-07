import Card from '../ui/Card';

export interface CompliancePoint {
  date: string;
  rate: number;
}

export interface ComplianceAction {
  id: string;
  title: string;
  area: string;
  dueDate: string;
}

export interface ComplianceHealthWarning {
  code: string;
  title: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
}

interface ComplianceMonitorProps {
  compliance?: {
    series: CompliancePoint[];
    openActions: ComplianceAction[];
    currentRate: number;
    healthScore?: number;
    warnings?: ComplianceHealthWarning[];
  };
  loading: boolean;
  onTrendClick: () => void;
}

export default function ComplianceMonitor({ compliance, loading, onTrendClick }: ComplianceMonitorProps) {
  const points = compliance?.series ?? [];

  return (
    <Card className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Compliance monitor</p>
          <h3 className="text-xl font-semibold text-navy">30-day compliance trend</h3>
        </div>
        <button type="button" onClick={onTrendClick} className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md">
          Drill down
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading compliance metrics…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Compliance health score</p>
              <p className="text-3xl font-semibold text-navy">{compliance?.healthScore ?? compliance?.currentRate ?? 0}%</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Current compliance rate</p>
              <p className="text-3xl font-semibold text-navy">{compliance?.currentRate ?? 0}%</p>
              <p className="mt-1 text-sm text-slate-600">Open corrective actions: {compliance?.openActions.length ?? 0}</p>
            </div>
          </div>

          {(compliance?.warnings ?? []).length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Compliance warnings</p>
              {compliance?.warnings?.slice(0, 3).map((warning) => (
                <div
                  key={warning.code}
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    warning.severity === 'high'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  <span className="font-medium">{warning.title}</span>
                  <span className="ml-2">({warning.count})</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <span>Trend over time</span>
              <span>{points.length} points</span>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-3xl bg-slate-100 p-3 sm:grid-cols-6 sm:p-4">
              {points.map((point) => (
                <div key={point.date} className="min-w-0 text-center text-xs text-slate-600">
                  <div className="mx-auto mb-2 h-24 w-full rounded-full bg-primary-500/20" style={{ height: `${point.rate}%` }} />
                  <div className="truncate">{point.date}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {compliance?.openActions.slice(0, 3).map((action) => (
              <div key={action.id} className="rounded-3xl border border-zinc-200 bg-white p-4">
                <p className="font-semibold text-slate-900 break-words">{action.title}</p>
                <p className="mt-1 text-sm text-slate-600 break-words">{action.area} · {action.dueDate}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
