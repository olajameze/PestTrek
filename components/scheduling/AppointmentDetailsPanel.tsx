import type { AppointmentDTO } from '../../lib/scheduling/types';

export default function AppointmentDetailsPanel({
  appointment,
  canWrite,
  onEdit,
  onDelete,
  onComplete,
  onClose,
}: {
  appointment: AppointmentDTO | null;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  if (!appointment) return null;

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Appointment</p>
          <h3 className="text-xl font-semibold text-navy">{appointment.clientName}</h3>
          <p className="mt-1 text-sm text-slate-600">{appointment.address}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-zinc-100" aria-label="Close details">
          ✕
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-sm text-slate-700">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">When</dt>
          <dd>{new Date(appointment.scheduledStart).toLocaleString()}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Status</dt>
          <dd className="capitalize">{appointment.status}</dd>
        </div>
        {appointment.treatment ? (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Treatment</dt>
            <dd>{appointment.treatment}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Technicians</dt>
          <dd>{appointment.technicians.map((t) => t.name).join(', ') || 'Unassigned'}</dd>
        </div>
      </dl>

      {canWrite ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Edit
          </button>
          {appointment.status === 'scheduled' ? (
            <button type="button" onClick={onComplete} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              Mark complete
            </button>
          ) : null}
          <button type="button" onClick={onDelete} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
