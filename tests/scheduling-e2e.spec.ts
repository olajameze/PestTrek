import { test, expect } from '@playwright/test';

const ownerEmail = process.env.PLAYWRIGHT_OWNER_EMAIL;

test.describe('scheduling page smoke', () => {
  test.skip(!ownerEmail, 'Set PLAYWRIGHT_OWNER_EMAIL to run scheduling UI smoke test');

  test('loads scheduling route for authenticated owner', async ({ page }) => {
    test.skip(true, 'Requires authenticated owner session fixture');
    await page.goto('/scheduling');
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });
});
