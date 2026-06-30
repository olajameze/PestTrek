import { useEffect, useState } from 'react';
import FormInput from '../ui/FormInput';
import Button from '../ui/Button';
import type { AppointmentDTO, RecurrenceIntervalType, RecurrenceScope } from '../../lib/scheduling/types';

type TechnicianOption = { id: string; name: string; email: string };

export default function AppointmentModal({
  open,
  mode,
  initial,
  technicians,
  canWrite,
  onClose,
  onSave,
  onSaveRecurring,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: Partial<AppointmentDTO> & { recurring?: boolean };
  technicians: TechnicianOption[];
  canWrite: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, scope: RecurrenceScope) => Promise<void>;
  onSaveRecurring?: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);
  const [scope, setScope] = useState<RecurrenceScope>('occurrence');
  const [recurring, setRecurring] = useState(false);
  const [intervalType, setIntervalType] = useState<RecurrenceIntervalType>('weekly');
  const [intervalDays, setIntervalDays] = useState('7');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setClientName(initial?.clientName ?? '');
    setAddress(initial?.address ?? '');
    setPostcode(initial?.postcode ?? '');
    setTreatment(initial?.treatment ?? '');
    setNotes(initial?.notes ?? '');
    setStartLocal(toLocalInput(initial?.scheduledStart));
    setEndLocal(toLocalInput(initial?.scheduledEnd));
    setTechnicianIds(initial?.technicians?.map((t) => t.id) ?? []);
    setRecurring(Boolean(initial?.recurring));
    setScope('occurrence');
    setError('');
  }, [open, initial]);

  if (!open || !canWrite) return null;

  const toggleTechnician = (id: string) => {
    setTechnicianIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        clientName,
        address,
        postcode: postcode || null,
        treatment: treatment || null,
        notes: notes || null,
        scheduledStart: new Date(startLocal).toISOString(),
        scheduledEnd: new Date(endLocal).toISOString(),
        technicianIds,
      };
      if (mode === 'create' && recurring && onSaveRecurring) {
        await onSaveRecurring({
          ...payload,
          intervalType,
          intervalDays: intervalType === 'custom' ? Number(intervalDays) : null,
          anchorStart: payload.scheduledStart,
          durationMinutes: Math.max(15, Math.round((new Date(endLocal).getTime() - new Date(startLocal).getTime()) / 60000)),
        });
      } else {
        await onSave(payload, scope);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save appointment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-navy">{mode === 'create' ? 'Create appointment' : 'Edit appointment'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-zinc-100" aria-label="Close modal">
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormInput id="sched-client-name" label="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          <FormInput id="sched-address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          <FormInput id="sched-postcode" label="Postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          <FormInput id="sched-treatment" label="Treatment" value={treatment} onChange={(e) => setTreatment(e.target.value)} />
          <FormInput id="sched-notes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput id="sched-start" label="Start" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} required />
            <FormInput id="sched-end" label="End" type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} required />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Technicians</p>
            <div className="flex flex-wrap gap-2">
              {technicians.map((tech) => (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => toggleTechnician(tech.id)}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    technicianIds.includes(tech.id) ? 'bg-primary-500 text-white' : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {tech.name}
                </button>
              ))}
            </div>
          </div>

          {mode === 'create' ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              Recurring series
            </label>
          ) : null}

          {recurring && mode === 'create' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Interval
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={intervalType}
                  onChange={(e) => setIntervalType(e.target.value as RecurrenceIntervalType)}
                >
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {intervalType === 'custom' ? (
                <FormInput id="sched-interval-days" label="Every N days" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
              ) : null}
            </div>
          ) : null}

          {mode === 'edit' && initial?.recurringAppointmentId ? (
            <label className="text-sm text-slate-700">
              Apply changes to
              <select
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                value={scope}
                onChange={(e) => setScope(e.target.value as RecurrenceScope)}
              >
                <option value="occurrence">This occurrence only</option>
                <option value="series">Entire series</option>
              </select>
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toLocalInput(value?: string): string {
  if (!value) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return formatLocal(now);
  }
  return formatLocal(new Date(value));
}

function formatLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
