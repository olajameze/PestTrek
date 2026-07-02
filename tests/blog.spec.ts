import { expect, test } from '@playwright/test';

test.describe('Blog', () => {
  test('blog index and post pages load', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.getByRole('heading', { level: 1, name: 'PestTrace Blog' })).toBeVisible();

    await page.getByRole('link', { name: /prepare for a pest control compliance audit/i }).click();
    await expect(page).toHaveURL(/\/blog\/prepare-for-pest-control-compliance-audit/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/compliance audit/i);
  });
});
