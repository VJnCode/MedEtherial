import { expect, test } from '@playwright/test';

test('landing page renders hero and CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Care that keeps moving');
  await expect(page.getByRole('link', { name: /create your account/i })).toBeVisible();
});

test('theme toggle switches to dark mode', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('theme-toggle').click();
  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('protected app redirects anonymous users to sign-in', async ({ page }) => {
  await page.goto('/app/dispatch');
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fapp%2Fdispatch/);
  await expect(page.getByTestId('sign-in')).toBeVisible();
});

test('security headers are present', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});
