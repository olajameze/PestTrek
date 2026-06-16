import { normalizeAuthEmail } from './userSession';

type CompanyLike = { email?: string | null } | null | undefined;

/** True when the signed-in user owns the company row (Company.email matches auth email). */
export function isCompanyOwnerSession(
  sessionEmail: string | undefined,
  company: CompanyLike,
): boolean {
  if (!sessionEmail?.trim() || !company?.email?.trim()) return false;
  return normalizeAuthEmail(sessionEmail) === normalizeAuthEmail(company.email);
}

/**
 * Chooses admin vs technician workspace after business sign-in.
 * Company owners always land on /dashboard even if they also have a Technician row.
 */
export async function resolveBusinessSignInRoute(
  accessToken: string,
  sessionEmail: string | undefined,
): Promise<'/dashboard' | '/technician'> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [companyRes, techRes] = await Promise.all([
    fetch('/api/company', { headers }),
    fetch('/api/technician-profile', { headers }),
  ]);

  const company = companyRes.ok
    ? ((await companyRes.json().catch(() => null)) as CompanyLike)
    : null;

  if (isCompanyOwnerSession(sessionEmail, company)) {
    return '/dashboard';
  }

  if (techRes.ok) {
    const techPayload = (await techRes.json().catch(() => null)) as { technician?: unknown } | null;
    if (techPayload?.technician) {
      return '/technician';
    }
  }

  return '/dashboard';
}
