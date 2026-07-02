import { expect, test } from '@playwright/test';

test.describe('Pest Trace E2E smoke', () => {
  test('loads public pages, exercises signup when Supabase is reachable, and protects dashboard endpoints', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    // `/` is the landing page (same module as `/home`); it does not redirect to sign-in.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Stop scrambling for audit records/i);

    await page.goto('/auth/signin');
    await expect(page.locator('body')).toBeVisible();

    const signupDomain =
      process.env.PLAYWRIGHT_SIGNUP_EMAIL_DOMAIN?.trim() || 'pesttrace.test';
    const baseEmail = `playwright.${Date.now()}@${signupDomain}`;

    await page.goto('/auth/signup');
    await expect(page.locator('text=Create your account')).toBeVisible();

    await page.fill('#business-name', 'Playwright Pest Co');
    await page.fill('#full-name', 'E2E Tester');
    await page.fill('#email', baseEmail);
    // Controlled inputs: pressSequentially reliably updates React state (fill alone can skip onChange).
    await page.locator('#password').pressSequentially('Password123!', { delay: 15 });
    await page.locator('#confirm-password').pressSequentially('Password123!', { delay: 15 });
    await page.click('button:has-text("Create Account")');

    const otpLoc = page.locator('#admin-signup-otp');
    const errorLoc = page.locator('.form-feedback-error');

    try {
      await Promise.race([
        otpLoc.waitFor({ state: 'visible', timeout: 25000 }),
        page.waitForURL('**/auth/signin**', { timeout: 25000 }),
        page.waitForURL('**/auth/verify**', { timeout: 25000 }),
        page.waitForURL('**/dashboard**', { timeout: 25000 }),
        errorLoc.waitFor({ state: 'visible', timeout: 25000 }),
      ]);
    } catch {
      throw new Error('Signup flow produced no OTP step, redirect, or error within 25s');
    }

    if (await errorLoc.isVisible()) {
      const msg = (await errorLoc.textContent().catch(() => '')) || '';
      if (/failed to fetch|network|load failed|networkerror|supabase/i.test(msg)) {
        test.info().annotations.push({
          type: 'note',
          description:
            'Admin signup did not reach OTP: browser could not reach Supabase. For full signup coverage, ensure NEXT_PUBLIC_SUPABASE_* URLs are reachable from the test environment.',
        });
      } else if (/invalid/i.test(msg) && /email/i.test(msg)) {
        test.info().annotations.push({
          type: 'note',
          description:
            `Supabase rejected the signup email (${msg}). Set PLAYWRIGHT_SIGNUP_EMAIL_DOMAIN to a domain allowed by your Auth settings for full OTP coverage.`,
        });
      } else {
        throw new Error(`Unexpected sign-up error: ${msg}`);
      }
    } else {
      const ok =
        (await otpLoc.isVisible()) ||
        /\/(auth\/signin|auth\/verify|dashboard)/.test(page.url());
      expect(ok).toBeTruthy();
    }

    await page.goto('/dashboard');
    expect(page.url()).toMatch(/\/(auth\/signin|dashboard)$/);

    await page.goto('/upgrade');
    expect(page.url()).toMatch(/\/(auth\/signin|upgrade)$/);

    const subscriptionResponse = await request.get('/api/subscription');
    expect(subscriptionResponse.status()).toBe(401);

    const checkoutResponse = await request.post('/api/create-checkout-session', {
      data: { plan: 'pro' },
    });
    expect(checkoutResponse.status()).toBe(401);

    const certificationResponse = await request.post('/api/technicians/certifications', {
      data: {
        technicianId: 'fake-id',
        expiryDate: '2026-12-31',
        fileUrl: 'fake-id/sample.pdf',
      },
    });
    expect(certificationResponse.status()).toBe(401);
  });
});
