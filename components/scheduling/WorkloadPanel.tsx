import Card from '../ui/Card';
import type { TechnicianWorkloadDTO } from '../../lib/scheduling/types';

export default function WorkloadPanel({
  workload,
  loading,
}: {
  workload: TechnicianWorkloadDTO[];
  loading: boolean;
}) {
  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Technician workload</p>
        <h3 className="text-lg font-semibold text-navy">Visible range</h3>
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {!loading && workload.length === 0 ? (
        <p className="text-sm text-slate-500">No technicians found.</p>
      ) : null}
      <div className="space-y-2">
        {workload.map((row) => (
          <div key={row.technicianId} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm">
            <span className="font-medium text-slate-900">{row.name}</span>
            <span className="text-slate-600">
              {row.appointmentCount} jobs · {Math.round(row.totalMinutes / 60)}h
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
