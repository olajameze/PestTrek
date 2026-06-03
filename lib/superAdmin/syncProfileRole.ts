import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAuthEmail } from '../auth/userSession';

/**
 * Keeps public.profiles.role aligned with auth user_metadata after super-admin set_role.
 */
export async function syncProfileRole(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  role: 'admin' | 'technician',
): Promise<{ ok: boolean; error?: string }> {
  const normalizedEmail = email ? normalizeAuthEmail(email) : null;
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email: normalizedEmail,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
