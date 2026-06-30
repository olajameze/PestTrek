import Card from '../ui/Card';
import type { AppointmentDTO } from '../../lib/scheduling/types';

function AppointmentRow({ appointment }: { appointment: AppointmentDTO }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3">
      <p className="font-medium text-slate-900">{appointment.clientName}</p>
      <p className="text-sm text-slate-600">{appointment.address}</p>
      <p className="mt-1 text-xs text-slate-500">{new Date(appointment.scheduledStart).toLocaleString()}</p>
    </div>
  );
}

export default function SchedulingTodayJobs({
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
        <h3 className="text-xl font-semibold text-navy">Today&apos;s jobs</h3>
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {!loading && appointments.length === 0 ? (
        <p className="text-sm text-slate-500">No scheduled jobs today.</p>
      ) : null}
      <div className="space-y-2">
        {appointments.slice(0, 5).map((appointment) => (
          <AppointmentRow key={appointment.id} appointment={appointment} />
        ))}
      </div>
    </Card>
  );
}
