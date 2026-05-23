import { type Page } from '@playwright/test';

/**
 * Navigates to the Subway Scaler plugin and starts a game session,
 * waiting until session.phase === 'playing'.
 */
export async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Plugins' }).click();
  await page.getByText('Subway Scaler', { exact: true }).first().click();
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'START' }).click();
  await page.waitForFunction(
    () => (window as any).__gameState?.session?.phase === 'playing',
    { timeout: 10000 }
  );
}
