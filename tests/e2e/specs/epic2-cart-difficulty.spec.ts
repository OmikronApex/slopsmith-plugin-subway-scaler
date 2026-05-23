/**
 * Epic 2: Wave spawning and collision observable behavior (Story 0.5a)
 *
 * Tests what is observable via window.__gameState:
 *   - waveCount (mirrored from SceneManager.activeWaves.size) confirms waves spawn
 *   - gameOver.isGameOver / gameOver.reason confirm collision state is correct
 *
 * Wave scheduling and difficulty scaling are now owned by WaveScheduler.js and
 * main.js (formerly CartSystem.js / DifficultyManager.js, which are removed).
 *
 * Chromium only: fake mic device required for game start.
 */
import { test, expect } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

const ROOT = '#subway-scaler-root';

test.skip(({ browserName }) => browserName !== 'chromium',
  'mic mock requires Chromium fake device flag');

// ─── Story 2.2 — Wave spawning (WaveScheduler) ───────────────────────────────

test.describe('Epic 2: wave spawning (Story 2.2)', () => {
  test('waveCount becomes > 0 within 10s of game start (waves are spawning)', async ({ gamePage }) => {
    await startGame(gamePage);

    // The backend delivers the first wave as part of session-config / initial polling.
    // Allow up to 10s for the first wave to arrive and be rendered.
    await gamePage.waitForFunction(
      () => ((window as any).__gameState?.scene?.waveCount ?? 0) > 0,
      { timeout: 10000 }
    );

    const count = await gamePage.evaluate(() => (window as any).__gameState.scene.waveCount);
    expect(count).toBeGreaterThan(0);
  });

  test('waveCount is 0 initially (before game starts)', async ({ gamePage }) => {
    await gamePage.goto('/');
    await gamePage.waitForLoadState('networkidle');
    await gamePage.getByRole('button', { name: 'Plugins' }).click();
    await gamePage.getByText('Subway Scaler', { exact: true }).first().click();
    await gamePage.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });

    // Before START is clicked, no waves should be active
    const count = await gamePage.evaluate(() => (window as any).__gameState?.scene?.waveCount ?? 0);
    expect(count).toBe(0);
  });
});

// ─── Story 2.2 — Collision detection ─────────────────────────────────────────
//
// NOTE: cleanup() resets gameOver.isGameOver = false immediately after setting it to true
// (same synchronous call chain as run.state = 'failed'). Playwright's polling never sees
// the transient true value. Assert the overlay (which persists) instead — same approach
// as epic3-game.spec.ts ("assert overlay instead, which persists after cleanup").

test.describe('Epic 2: collision detection (Story 2.2)', () => {
  test('forceCollision shows game-over overlay with failure message', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() => (window as any).__gameState._test.forceCollision());

    const overlay = gamePage.locator(`${ROOT} .overlay:not(.hidden)`);
    await expect(overlay).toBeVisible({ timeout: 3000 });
    await expect(overlay).toContainText(/run failed|game.?over|collision/i);
  });

  test('after forceCollision, session.phase is no longer playing', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() => (window as any).__gameState._test.forceCollision());

    // cleanup() sets phase back to idle — wait briefly for the next RAF tick
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase !== 'playing',
      { timeout: 3000 }
    );

    const phase = await gamePage.evaluate(() => (window as any).__gameState.session.phase);
    expect(phase).not.toBe('playing');
  });
});

// ─── Story 2.3 — Difficulty / speed baseline ─────────────────────────────────

test.describe('Epic 2: difficulty / session persistence (Story 2.3)', () => {
  test('frameCount keeps increasing while game is playing (rendering loop alive)', async ({ gamePage }) => {
    await startGame(gamePage);

    const t1 = await gamePage.evaluate(() => (window as any).__gameState?.loop?.frameCount ?? 0);
    await gamePage.waitForTimeout(500);
    const t2 = await gamePage.evaluate(() => (window as any).__gameState?.loop?.frameCount ?? 0);

    // Background RAF loop always runs — frameCount must increase regardless of game state
    expect(t2).toBeGreaterThan(t1);
  });
});
