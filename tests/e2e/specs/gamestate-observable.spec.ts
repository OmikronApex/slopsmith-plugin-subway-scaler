import { test, expect } from '../fixtures/gameFixture';
import { openSubwayScalerSetup } from '../fixtures/startGame';

test.describe('window.__gameState observable interface', () => {
  test('is non-null within 500ms of page load', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

    await gamePage.waitForFunction(
      () => (window as any).__gameState != null,
      { timeout: 500 }
    );

    const gameState = await gamePage.evaluate(() => (window as any).__gameState);
    expect(gameState).not.toBeNull();
  });

  test('session.phase is "idle" on load', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

    const phase = await gamePage.evaluate(() => (window as any).__gameState?.session?.phase);
    expect(phase).toBe('idle');
  });

  test('loop.frameCount is increasing (game loop is alive)', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

    const count1 = await gamePage.evaluate(() => (window as any).__gameState?.loop?.frameCount);
    await gamePage.waitForTimeout(200);
    const count2 = await gamePage.evaluate(() => (window as any).__gameState?.loop?.frameCount);

    expect(typeof count1).toBe('number');
    expect(count2).toBeGreaterThan(count1 as number);
  });
});
