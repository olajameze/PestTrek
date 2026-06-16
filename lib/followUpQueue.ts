export type FollowUpQueueItem = {
  id: string;
  clientName: string;
  address: string;
  treatment: string;
  followUpDate: string | null;
  bucket: 'overdue' | 'today' | 'upcoming';
};

export type FollowUpQueue = {
  overdue: FollowUpQueueItem[];
  today: FollowUpQueueItem[];
  upcoming: FollowUpQueueItem[];
  totalOpen: number;
};

const MAX_PER_BUCKET = 10;
const UPCOMING_DAYS = 7;

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function entryNotesSuggestFollowUp(notes: string | null | undefined): boolean {
  const n = (notes ?? '').toLowerCase();
  return (
    n.includes('follow-up') ||
    n.includes('follow up') ||
    n.includes('callback') ||
    n.includes('revisit')
  );
}

export function isOpenFollowUpCandidate(entry: {
  status: string | null;
  followUpDate: Date | null;
  notes: string | null;
}): boolean {
  const status = entry.status?.trim().toLowerCase() || 'open';
  if (status !== 'open') return false;
  if (entry.followUpDate) return true;
  return entryNotesSuggestFollowUp(entry.notes);
}

export function buildFollowUpQueue(
  entries: Array<{
    id: string;
    clientName: string;
    address: string;
    treatment: string;
    followUpDate: Date | null;
    notes: string | null;
    status: string | null;
  }>,
  nowMs = Date.now(),
): FollowUpQueue {
  const now = new Date(nowMs);
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + UPCOMING_DAYS);

  const candidates = entries.filter(isOpenFollowUpCandidate);
  const overdue: FollowUpQueueItem[] = [];
  const today: FollowUpQueueItem[] = [];
  const upcoming: FollowUpQueueItem[] = [];
  let totalOpen = 0;

  for (const entry of candidates) {
    const base: FollowUpQueueItem = {
      id: entry.id,
      clientName: entry.clientName,
      address: entry.address,
      treatment: entry.treatment,
      followUpDate: entry.followUpDate ? entry.followUpDate.toISOString() : null,
      bucket: 'upcoming',
    };

    if (!entry.followUpDate) {
      totalOpen += 1;
      if (upcoming.length < MAX_PER_BUCKET) {
        upcoming.push({ ...base, bucket: 'upcoming' });
      }
      continue;
    }

    const dueMs = entry.followUpDate.getTime();
    if (dueMs > weekEnd.getTime()) {
      continue;
    }

    totalOpen += 1;

    if (dueMs < todayStart.getTime()) {
      if (overdue.length < MAX_PER_BUCKET) overdue.push({ ...base, bucket: 'overdue' });
    } else if (dueMs <= todayEnd.getTime()) {
      if (today.length < MAX_PER_BUCKET) today.push({ ...base, bucket: 'today' });
    } else if (upcoming.length < MAX_PER_BUCKET) {
      upcoming.push({ ...base, bucket: 'upcoming' });
    }
  }

  const byDate = (a: FollowUpQueueItem, b: FollowUpQueueItem) => {
    const ta = a.followUpDate ? new Date(a.followUpDate).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.followUpDate ? new Date(b.followUpDate).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  };

  overdue.sort(byDate);
  today.sort(byDate);
  upcoming.sort(byDate);

  return { overdue, today, upcoming, totalOpen };
}
