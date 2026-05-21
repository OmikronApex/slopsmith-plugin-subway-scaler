import { test, expect } from '@playwright/test';

test('plugin loads without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  expect(errors).toHaveLength(0);
  await expect(page).not.toHaveTitle('');
});
