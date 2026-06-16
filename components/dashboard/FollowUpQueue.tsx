import Card from '../ui/Card';
import Button from '../ui/Button';
import type { FollowUpQueue, FollowUpQueueItem } from '../../lib/followUpQueue';

type FollowUpQueueProps = {
  queue: FollowUpQueue | null | undefined;
  loading: boolean;
  onOpenEntry: (item: FollowUpQueueItem) => void;
  onViewAll: () => void;
};

function formatDueLabel(followUpDate: string | null): string {
  if (!followUpDate) return 'Date not set';
  return new Date(followUpDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function QueueSection({
  title,
  tone,
  items,
  onOpenEntry,
}: {
  title: string;
  tone: 'red' | 'amber' | 'blue';
  items: FollowUpQueueItem[];
  onOpenEntry: (item: FollowUpQueueItem) => void;
}) {
  if (items.length === 0) return null;

  const toneClasses =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-blue-200 bg-blue-50 text-blue-900';

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpenEntry(item)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition hover:opacity-90 ${toneClasses}`}
            >
              <p className="font-semibold">{item.clientName}</p>
              <p className="mt-1 text-sm opacity-90">{item.address}</p>
              <p className="mt-1 text-xs opacity-80">
                {item.treatment} · Due {formatDueLabel(item.followUpDate)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FollowUpQueue({ queue, loading, onOpenEntry, onViewAll }: FollowUpQueueProps) {
  const hasItems =
    (queue?.overdue.length ?? 0) + (queue?.today.length ?? 0) + (queue?.upcoming.length ?? 0) > 0;

  return (
    <Card className="space-y-4" data-testid="follow-up-queue">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-navy">Follow-up queue</h3>
          <p className="mt-1 text-sm text-slate-600">Open jobs with scheduled or noted follow-ups.</p>
        </div>
        {queue && queue.totalOpen > 0 ? (
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800">
            {queue.totalOpen} open
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading follow-ups…</p>
      ) : !hasItems ? (
        <p className="text-sm text-slate-600">No open follow-ups scheduled.</p>
      ) : (
        <div className="space-y-5">
          <QueueSection title="Overdue" tone="red" items={queue?.overdue ?? []} onOpenEntry={onOpenEntry} />
          <QueueSection title="Due today" tone="amber" items={queue?.today ?? []} onOpenEntry={onOpenEntry} />
          <QueueSection title="Due this week" tone="blue" items={queue?.upcoming ?? []} onOpenEntry={onOpenEntry} />
        </div>
      )}

      <Button size="sm" variant="secondary" onClick={onViewAll} disabled={loading}>
        View all follow-ups
      </Button>
    </Card>
  );
}
