import { expect, test } from '@playwright/test';
import { isCompanyOwnerSession } from '../lib/auth/resolveWorkspaceRoute';

test.describe('resolveWorkspaceRoute helpers', () => {
  test('isCompanyOwnerSession matches owner email case-insensitively', () => {
    expect(
      isCompanyOwnerSession('OlaGomez@live.co.uk', { email: 'olagomez@live.co.uk' }),
    ).toBe(true);
  });

  test('isCompanyOwnerSession is false for technician viewing employer company', () => {
    expect(
      isCompanyOwnerSession('tech@example.com', { email: 'owner@example.com' }),
    ).toBe(false);
  });

  test('isCompanyOwnerSession is false when company is missing', () => {
    expect(isCompanyOwnerSession('owner@example.com', null)).toBe(false);
  });
});
