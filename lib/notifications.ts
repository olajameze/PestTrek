export type AppNotification = {
  id: string;
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
  sourceId?: string;
  recipientEmail?: string;
  category?: 'scheduling' | string;
};

export function parseNotifications(raw: unknown): AppNotification[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const notifications = (raw as Record<string, unknown>).notifications;
  if (!Array.isArray(notifications)) return [];
  return notifications
    .filter((item) => item && typeof item === 'object')
    .map((item): AppNotification => {
      const row = item as Record<string, unknown>;
      const severity: AppNotification['severity'] =
        row.severity === 'high' || row.severity === 'medium' || row.severity === 'low'
          ? row.severity
          : 'low';
      return {
        id: typeof row.id === 'string' ? row.id : `${Date.now()}-${Math.random()}`,
        title: typeof row.title === 'string' ? row.title : 'Notification',
        message: typeof row.message === 'string' ? row.message : '',
        severity,
        read: Boolean(row.read),
        createdAt:
          typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
        sourceId: typeof row.sourceId === 'string' ? row.sourceId : undefined,
        recipientEmail: typeof row.recipientEmail === 'string' ? row.recipientEmail : undefined,
        category: typeof row.category === 'string' ? row.category : undefined,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
