import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import WebPushSettings from '../push/WebPushSettings';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
  recipientEmail?: string;
};

function filterNotificationsForUser(items: NotificationItem[], userEmail: string | null): NotificationItem[] {
  const normalized = userEmail?.toLowerCase() ?? '';
  return items.filter((item) => !item.recipientEmail || item.recipientEmail.toLowerCase() === normalized);
}

export default function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const isHiddenRoute =
    router.pathname === '/' ||
    router.pathname === '/home' ||
    router.pathname.startsWith('/auth') ||
    router.pathname === '/contact' ||
    router.pathname === '/privacy' ||
    router.pathname === '/terms' ||
    router.pathname === '/maintenance';

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const rows = Array.isArray(data) ? (data as NotificationItem[]) : [];
      setItems(filterNotificationsForUser(rows, session.user.email ?? null));
    };
    void load();
  }, []);

  if (isHiddenRoute) return null;

  const markOneRead = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'mark_read', id }),
    });
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const markAllRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed right-20 top-4 z-[75] rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-md hover:bg-slate-50"
        aria-label="Open notifications"
      >
        Alerts {unreadCount > 0 ? `(${unreadCount})` : ''}
      </button>
      {open ? (
        <div className="fixed right-4 top-16 z-[85] w-[min(92vw,24rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Notification center</p>
            <button type="button" className="text-xs text-blue-600 hover:text-blue-800" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                No notifications yet.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void markOneRead(item.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    item.read ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {item.message ? <p className="mt-1 text-xs text-slate-600">{item.message}</p> : null}
                  <p className="mt-1 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                </button>
              ))
            )}
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <WebPushSettings />
          </div>
        </div>
      ) : null}
    </>
  );
}
