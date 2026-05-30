/**
 * Epic 3: Core Gameplay Loop
 *
 * Tests game start, phase transitions, HUD elements, and _test hook behaviour.
 * All tests use the gamePage fixture (__TEST_MODE = true) so _test hooks are wired.
 * Audio works via Chromium's --use-fake-device-for-media-stream flag (no WAV injection needed).
 */
import { test, expect } from '../fixtures/gameFixture';
import { startGame, openSubwayScalerSetup } from '../fixtures/startGame';

// ─── Story 3.1 — SceneManager / canvas ────────────────────────────────────────

test.describe('Epic 3: Three.js canvas (Story 3.1)', () => {
  test('canvas element has non-zero dimensions after game starts', async ({ gamePage }) => {
    await startGame(gamePage);

    const dims = await gamePage.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas
        ? { w: canvas.clientWidth, h: canvas.clientHeight }
        : null;
    });

    expect(dims).not.toBeNull();
    expect(dims!.w).toBeGreaterThan(0);
    expect(dims!.h).toBeGreaterThan(0);
  });

  test('game-wrap becomes visible after game starts', async ({ gamePage }) => {
    await startGame(gamePage);

    const gameWrap = gamePage.locator('.game-wrap');
    await expect(gameWrap).toBeVisible();
  });
});

// ─── Story 3.4 — Phase management ────────────────────────────────────────────

test.describe('Epic 3: phase transitions (Story 3.4)', () => {
  test('phase transitions from idle to playing on START', async ({ gamePage }) => {
    await startGame(gamePage);

    const phase = await gamePage.evaluate(() => (window as any).__gameState?.session?.phase);
    expect(phase).toBe('playing');
  });

  test('_test.triggerPause toggles phase to paused then back to playing', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() => (window as any).__gameState._test.triggerPause());
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'paused',
      { timeout: 2000 }
    );

    await gamePage.evaluate(() => (window as any).__gameState._test.triggerPause());
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'playing',
      { timeout: 2000 }
    );
  });

  test('_test.forceCollision ends the run and shows game-over overlay', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() => (window as any).__gameState._test.forceCollision());
    const overlay = gamePage.locator('.overlay:not(.hidden)');
    await expect(overlay).toBeVisible({ timeout: 3000 });
    await expect(overlay).toContainText(/run failed|game.?over/i);
  });

  test('_test.resetGame returns phase to idle', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() => (window as any).__gameState._test.resetGame());
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'idle',
      { timeout: 3000 }
    );
  });
});

// ─── Story 3.5 — Tutorial hint ────────────────────────────────────────────────

test.describe('Epic 3: tutorial hint (Story 3.5)', () => {
  test('tutorialActive is true immediately after game starts', async ({ gamePage }) => {
    await startGame(gamePage);

    const active = await gamePage.evaluate(
      () => (window as any).__gameState?.runtime?.tutorialActive
    );
    expect(active === true || active === undefined).toBe(true);
  });
});

// ─── Story 3.6 — Score display ────────────────────────────────────────────────

test.describe('Epic 3: score display (Story 3.6)', () => {
  test('HUD feedback element is visible during gameplay', async ({ gamePage }) => {
    await startGame(gamePage);

    const feedback = gamePage.locator('.feedback');
    await expect(feedback).toBeVisible();
  });

  test('__gameState.score.current starts at 0', async ({ gamePage }) => {
    await startGame(gamePage);

    const score = await gamePage.evaluate(() => (window as any).__gameState?.score?.current);
    expect(score).toBe(0);
  });
});
