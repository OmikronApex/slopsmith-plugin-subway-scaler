import { type Page } from '@playwright/test';

/**
 * Navigates to the Minigames hub, opens Subway Scaler, and starts a game
 * session via the SDK hub flow, waiting until session.phase === 'playing'.
 */
export async function navigateToHub(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: 'Minigames' }).click();
  // Wait for the hub tile grid to populate
  await page.locator('[aria-label="Subway Scaler"]').waitFor({ timeout: 10000 });
}

export async function openSubwayScalerSetup(page: Page): Promise<void> {
  await navigateToHub(page);
  // Click the Subway Scaler hub tile
  await page.locator('[aria-label="Subway Scaler"]').click();
  // SDK modifier picker appears — click Start (no modifiers for this game)
  await page.locator('#mg-picker-start').waitFor({ timeout: 5000 });
  await page.locator('#mg-picker-start').click();
  // Wait for our setup screen to mount inside the stage
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
}

export async function startGame(page: Page): Promise<void> {
  await openSubwayScalerSetup(page);
  await page.getByRole('button', { name: 'START' }).click();
  await page.waitForFunction(
    () => (window as any).__gameState?.session?.phase === 'playing',
    { timeout: 10000 }
  );
}
