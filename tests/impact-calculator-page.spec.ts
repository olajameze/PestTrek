import { expect, test } from '@playwright/test';

test.describe('Impact calculator page', () => {
  test('public page loads and updates results when inputs change', async ({ page }) => {
    await page.goto('/impact-calculator');
    await expect(page.getByRole('heading', { level: 1, name: /PestTrace Impact Calculator/i })).toBeVisible();
    await expect(page.getByText(/40 jobs → 8 hrs saved/i)).toBeVisible();

    const jobsInput = page.getByLabel('Jobs per month');
    await jobsInput.fill('80');
    await jobsInput.blur();

    await expect(page.getByText(/80 jobs → 16 hrs saved/i)).toBeVisible();
  });
});
