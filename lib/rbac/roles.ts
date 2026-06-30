export type UserRole = 'admin' | 'manager' | 'technician';
export type UserPlan = 'starter' | 'business' | 'enterprise' | 'trial' | 'pro';

export type PermissionAction = 'read' | 'write' | 'export' | 'manage';
export type PermissionResource = 'audit_logs' | 'offline_queue' | 'logbook' | 'reports' | 'settings' | 'technicians' | 'scheduling';

export type Permissions = {
  role: UserRole;
  plan: UserPlan;
  can(action: PermissionAction, resource: PermissionResource): boolean;
};

export function normalizeRole(value: unknown): UserRole {
  return value === 'admin' || value === 'manager' || value === 'technician' ? value : 'technician';
}

export function normalizePlan(value: unknown): UserPlan {
  if (value === 'starter' || value === 'business' || value === 'enterprise') return value;
  if (value === 'trial' || value === 'pro') return value;
  return 'starter';
}

export function buildPermissions(roleRaw: unknown, planRaw: unknown): Permissions {
  const role = normalizeRole(roleRaw);
  const plan = normalizePlan(planRaw);

  const can = (action: PermissionAction, resource: PermissionResource) => {
    // Role rules
    if (role === 'admin') return true;
    if (role === 'manager') {
      if (resource === 'audit_logs' && action !== 'read') return false;
      return true;
    }

    // Technician rules
    if (resource === 'audit_logs') return false;
    if (resource === 'settings' && action === 'manage') return false;
    if (resource === 'scheduling' && (action === 'write' || action === 'manage')) return false;

    // Plan rules (best-effort; DB-side checks still required)
    if (resource === 'reports' && action === 'export') {
      return plan === 'business' || plan === 'enterprise' || plan === 'pro';
    }

    return true;
  };

  return { role, plan, can };
}

