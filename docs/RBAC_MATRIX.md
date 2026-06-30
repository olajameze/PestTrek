## RBAC matrix (best-effort client gating)

Source of truth:
- `profiles.role`: `admin | manager | technician`
- `profiles.plan`: `starter | business | enterprise`

Implementation:
- `lib/rbac/roles.ts` + `hooks/usePermissions.ts`

### Rules
- **Admin**: full access.
- **Manager**: can manage most resources; read-only access for audit logs.
- **Technician**:
  - No audit logs access.
  - Limited settings management.
  - Scheduling: read-only (view assigned calendar); no create/edit/delete/assign.

### Plan gating
- Export actions are allowed for `pro`, `business`, `enterprise`.
- For any sensitive access, enforce on the server (RLS or server route checks).

