import Button from '../ui/Button';
import type { RecurrenceScope } from '../../lib/scheduling/types';

export default function DeleteAppointmentDialog({
  open,
  hasSeries,
  onClose,
  onConfirm,
}: {
  open: boolean;
  hasSeries: boolean;
  onClose: () => void;
  onConfirm: (scope: RecurrenceScope) => Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-navy">Delete appointment?</h2>
        <p className="mt-2 text-sm text-slate-600">This action cannot be undone.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void onConfirm('occurrence').then(onClose)}
          >
            {hasSeries ? 'Delete this occurrence' : 'Delete'}
          </Button>
          {hasSeries ? (
            <Button type="button" variant="danger" onClick={() => void onConfirm('series').then(onClose)}>
              Delete entire series
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
