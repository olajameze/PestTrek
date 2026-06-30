import Card from '../ui/Card';
import type { AppointmentDTO } from '../../lib/scheduling/types';

export default function SchedulingOverdueJobs({
  appointments,
  loading,
}: {
  appointments: AppointmentDTO[];
  loading: boolean;
}) {
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Scheduling</p>
        <h3 className="text-xl font-semibold text-navy">Overdue jobs</h3>
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {!loading && appointments.length === 0 ? (
        <p className="text-sm text-slate-500">No overdue scheduled jobs.</p>
      ) : null}
      <div className="space-y-2">
        {appointments.slice(0, 5).map((appointment) => (
          <div key={appointment.id} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="font-medium text-slate-900">{appointment.clientName}</p>
            <p className="text-sm text-slate-600">{new Date(appointment.scheduledStart).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
