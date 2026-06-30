import { test, expect } from '@playwright/test';
import { buildPermissions } from '../lib/rbac/roles';

test.describe('scheduling permissions', () => {
  test('technicians can read scheduling but not write', () => {
    const permissions = buildPermissions('technician', 'business');
    expect(permissions.can('read', 'scheduling')).toBe(true);
    expect(permissions.can('write', 'scheduling')).toBe(false);
    expect(permissions.can('manage', 'scheduling')).toBe(false);
  });

  test('managers can write scheduling', () => {
    const permissions = buildPermissions('manager', 'business');
    expect(permissions.can('write', 'scheduling')).toBe(true);
  });
});
