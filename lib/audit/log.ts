import { getSupabaseAdmin } from '../supabase-admin';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type AuditLogInsert = {
  userId: string;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
};

export async function writeAuditLog(entry: AuditLogInsert): Promise<void> {
  // Best-effort: if the table doesn't exist yet (migration not applied),
  // we silently no-op to avoid breaking core flows.
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { error } = await admin.from('audit_logs').insert({
    user_id: entry.userId,
    action: entry.action,
    table_name: entry.tableName,
    record_id: entry.recordId,
    old_values: entry.oldValues ?? null,
    new_values: entry.newValues ?? null,
    ip_address: entry.ipAddress ?? null,
  });

  if (error) {
    // Do not throw; audit logging must not break primary operations.
    return;
  }
}

/** Best-effort governance events (portal, exports) — uses audit_logs when available. */
export async function logGovernanceEvent(
  action: string,
  detail: Record<string, unknown>,
  userId = 'system',
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.from('audit_logs').insert({
    user_id: userId,
    action: 'UPDATE',
    table_name: 'governance',
    record_id: action,
    new_values: detail,
  });
  if (error) return;
}

