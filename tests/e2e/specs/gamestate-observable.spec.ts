import { test, expect } from '../fixtures/gameFixture';

async function navigateToPluginSetup(gamePage: any) {
  await gamePage.goto('/');
  await gamePage.waitForLoadState('networkidle');
  await gamePage.getByRole('button', { name: 'Plugins' }).click();
  await gamePage.getByText('Subway Scaler', { exact: true }).first().click();
  // Wait for setup screen — bootstrap() has run at this point
  await gamePage.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
}

test.describe('window.__gameState observable interface', () => {
  test('is non-null within 500ms of page load', async ({ gamePage }) => {
    await navigateToPluginSetup(gamePage);

    await gamePage.waitForFunction(
      () => (window as any).__gameState != null,
      { timeout: 500 }
    );

    const gameState = await gamePage.evaluate(() => (window as any).__gameState);
    expect(gameState).not.toBeNull();
  });

  test('session.phase is "idle" on load', async ({ gamePage }) => {
    await navigateToPluginSetup(gamePage);

    const phase = await gamePage.evaluate(() => (window as any).__gameState?.session?.phase);
    expect(phase).toBe('idle');
  });

  test('loop.frameCount is increasing (game loop is alive)', async ({ gamePage }) => {
    await navigateToPluginSetup(gamePage);

    const count1 = await gamePage.evaluate(() => (window as any).__gameState?.loop?.frameCount);
    await gamePage.waitForTimeout(200);
    const count2 = await gamePage.evaluate(() => (window as any).__gameState?.loop?.frameCount);

    expect(typeof count1).toBe('number');
    expect(count2).toBeGreaterThan(count1 as number);
  });
});
