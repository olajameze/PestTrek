import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAuthEmail } from '../auth/userSession';

export type AuthUserListRow = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  role: string;
  bannedUntil: string | null;
};

type ListResult = {
  users: AuthUserListRow[];
  page: number;
  perPage: number;
  total: number;
  searchActive: boolean;
};

function mapUser(u: {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
  banned_until?: string | null;
}): AuthUserListRow {
  return {
    id: u.id,
    email: u.email ?? '',
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    emailConfirmedAt: u.email_confirmed_at ?? null,
    role: typeof u.user_metadata?.role === 'string' ? u.user_metadata.role : 'unknown',
    bannedUntil: u.banned_until ?? null,
  };
}

/**
 * Lists auth users with optional server-side email substring search (scans pages when searching).
 */
export async function listAuthUsersForAdmin(
  admin: SupabaseClient,
  opts: { page: number; perPage: number; emailSearch?: string },
): Promise<ListResult> {
  const page = opts.page;
  const perPage = opts.perPage;
  const q = opts.emailSearch?.trim().toLowerCase() ?? '';

  if (!q) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = (data?.users ?? []).map(mapUser);
    return {
      users,
      page: data?.page ?? page,
      perPage: data?.per_page ?? perPage,
      total: data?.total ?? users.length,
      searchActive: false,
    };
  }

  const matches: AuthUserListRow[] = [];
  let scanPage = 1;
  const scanPerPage = 200;
  let apiTotal: number | null = null;

  while (scanPage <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page: scanPage, perPage: scanPerPage });
    if (error) throw new Error(error.message);
    if (scanPage === 1 && typeof data?.total === 'number') apiTotal = data.total;
    const batch = data?.users ?? [];
    for (const u of batch) {
      const email = (u.email ?? '').toLowerCase();
      if (email.includes(q)) matches.push(mapUser(u));
    }
    if (batch.length < scanPerPage) break;
    scanPage += 1;
  }

  const sorted = matches.sort((a, b) => normalizeAuthEmail(a.email).localeCompare(normalizeAuthEmail(b.email)));
  const total = sorted.length;
  const start = (page - 1) * perPage;
  const users = sorted.slice(start, start + perPage);

  return {
    users,
    page,
    perPage,
    total: apiTotal != null && total === 0 ? 0 : total,
    searchActive: true,
  };
}
