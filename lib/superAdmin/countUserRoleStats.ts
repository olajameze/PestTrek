import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRoleStats = {
  total: number;
  admins: number;
  technicians: number;
  unknown: number;
};

function roleFromUser(u: { user_metadata?: Record<string, unknown> }): string {
  const role = u.user_metadata?.role;
  return typeof role === 'string' ? role : 'unknown';
}

/**
 * Accurate platform-wide role counts (paginates auth users; uses API total when available).
 */
export async function countUserRoleStats(admin: SupabaseClient): Promise<UserRoleStats> {
  const perPage = 200;
  let page = 1;
  let apiTotal: number | null = null;
  const stats: UserRoleStats = { total: 0, admins: 0, technicians: 0, unknown: 0 };

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data?.users ?? [];
    if (page === 1 && typeof data?.total === 'number') {
      apiTotal = data.total;
    }
    for (const u of users) {
      const role = roleFromUser(u);
      if (role === 'admin') stats.admins += 1;
      else if (role === 'technician') stats.technicians += 1;
      else stats.unknown += 1;
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 100) break;
  }

  const scanned = stats.admins + stats.technicians + stats.unknown;
  stats.total = apiTotal ?? scanned;
  return stats;
}
