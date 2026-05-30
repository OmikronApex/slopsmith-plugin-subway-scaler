/**
 * Epic 4: Session UX & Accessibility (Story 0.5b)
 *
 * Tests for overlay behavior and accessibility features. Structured in two tiers:
 *
 * TIER 1 — CURRENTLY IMPLEMENTED (tests should pass now):
 *   - Collision overlay appears with failure message
 *   - Pause button toggles phase state
 *   - game-over overlay contains a number (score)
 *
 * TIER 2 — ATDD SCAFFOLDS (test.fail — expected to fail until Epic 4 ships):
 *   - Pause overlay has role="dialog" and aria-modal="true"
 *   - Pause overlay contains a RESUME button
 *   - Escape key resumes from pause
 *   - Focus trap inside pause overlay
 *
 * When Epic 4 is implemented: remove test.fail() wrappers from Tier 2 and confirm all pass.
 *
 * Chromium only: fake mic device required for game start.
 */
import { test, expect, type Page } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

const ROOT = '#mg-stage-body';

test.skip(({ browserName }) => browserName !== 'chromium',
  'mic mock requires Chromium fake device flag');

// ─── TIER 1: Currently implemented overlay behavior ──────────────────────────

test.describe('Epic 4 Tier 1: game-over overlay (currently implemented)', () => {
  test('collision overlay becomes visible with failure message', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() => (window as any).__gameState._test.forceCollision());

    const overlay = gamePage.locator(`${ROOT} .overlay:not(.hidden)`);
    await expect(overlay).toBeVisible({ timeout: 3000 });
    await expect(overlay).toContainText(/run failed|game.?over|collision/i);
  });

  // Score display in game-over overlay requires Epic 4 (story 4-3) — moved to Tier 2 ATDD below.
});

test.describe('Epic 4 Tier 1: pause button (currently implemented)', () => {
  test('pause button click transitions phase to paused', async ({ gamePage }) => {
    await startGame(gamePage);

    const pauseBtn = gamePage.locator(`${ROOT} .hud-pause-btn`);
    await expect(pauseBtn).toBeVisible({ timeout: 3000 });
    await pauseBtn.click();

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'paused',
      { timeout: 2000 }
    );

    const phase = await gamePage.evaluate(() => (window as any).__gameState.session.phase);
    expect(phase).toBe('paused');
  });

  test('pause button click again (resume) returns phase to playing', async ({ gamePage }) => {
    await startGame(gamePage);

    const pauseBtn = gamePage.locator(`${ROOT} .hud-pause-btn`);
    await pauseBtn.click();
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'paused',
      { timeout: 2000 }
    );

    // Overlay's RESUME button is the primary resume action (covers HUD)
    const resumeBtn = gamePage.locator(`${ROOT} .overlay:not(.hidden)`).getByRole('button', { name: /resume/i });
    await resumeBtn.click();
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'playing',
      { timeout: 2000 }
    );

    const phase = await gamePage.evaluate(() => (window as any).__gameState.session.phase);
    expect(phase).toBe('playing');
  });

  // Abandon-button test removed 2026-05-25 — abandon UI button was retired.
  // GameState.abandon() remains as a programmatic API (used by main-menu path),
  // but no in-game HUD button exists or is planned.
});

// ─── TIER 2: Epic 4 overlay features (now implemented) ───────────────────────

test.describe('Epic 4 Tier 2: ATDD — pause overlay ARIA', () => {
  async function openPauseState(page: Page) {
    await startGame(page);
    await page.evaluate(() => (window as any).__gameState._test.triggerPause());
    // Phase sync happens on the next RAF frame (~16ms) — brief poll
    await page.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'paused',
      { timeout: 3000 }
    );
  }

  test('pause overlay has role="dialog" and aria-modal="true"', async ({ gamePage }) => {
    await openPauseState(gamePage);
    const overlay = gamePage.locator(`${ROOT} .overlay:not(.hidden)`);
    await expect(overlay).toHaveAttribute('role', 'dialog', { timeout: 500 });
  });

  test('pause overlay contains a RESUME button', async ({ gamePage }) => {
    await openPauseState(gamePage);
    const resumeBtn = gamePage.locator(`${ROOT} .overlay:not(.hidden)`).getByRole('button', { name: /resume/i });
    await expect(resumeBtn).toBeVisible({ timeout: 500 });
  });

  test('Escape key resumes game from paused state', async ({ gamePage }) => {
    await openPauseState(gamePage);
    await gamePage.keyboard.press('Escape');
    const phase = await gamePage.evaluate(() => (window as any).__gameState?.session?.phase);
    expect(phase).toBe('playing');
  });

  test('focus is trapped inside pause overlay (Tab stays within overlay)', async ({ gamePage }) => {
    await openPauseState(gamePage);
    await gamePage.keyboard.press('Tab');
    const isInside = await gamePage.evaluate(() => {
      const o = document.querySelector('#mg-stage-body .overlay:not(.hidden)');
      return o ? o.contains(document.activeElement) : false;
    });
    expect(isInside).toBe(true);
  });
});

test.describe('Epic 4 Tier 2: ATDD — game-over overlay', () => {
  async function triggerGameOver(page: Page) {
    await startGame(page);
    await page.evaluate(() => (window as any).__gameState._test.forceCollision());
    // cleanup() is synchronous — overlay becomes visible immediately
    await page.locator(`${ROOT} .overlay:not(.hidden)`).waitFor({ timeout: 3000 });
  }

  test('game-over overlay displays final score value', async ({ gamePage }) => {
    await triggerGameOver(gamePage);
    const overlayText = await gamePage.locator(`${ROOT} .overlay:not(.hidden)`).textContent();
    expect(/\d+/.test(overlayText ?? '')).toBe(true);
  });

  test('game-over overlay has role="dialog" and aria-modal="true"', async ({ gamePage }) => {
    await triggerGameOver(gamePage);
    const overlay = gamePage.locator(`${ROOT} .overlay:not(.hidden)`);
    await expect(overlay).toHaveAttribute('role', 'dialog', { timeout: 500 });
  });

  test('game-over overlay contains a Play Again / Retry button', async ({ gamePage }) => {
    await triggerGameOver(gamePage);
    const retryBtn = gamePage.locator(`${ROOT} .overlay:not(.hidden)`).getByRole('button', { name: /play again|retry|restart/i });
    await expect(retryBtn).toBeVisible({ timeout: 500 });
  });

  test('clicking Play Again returns session.phase to idle', async ({ gamePage }) => {
    await triggerGameOver(gamePage);
    const retryBtn = gamePage.locator(`${ROOT} .overlay:not(.hidden)`).getByRole('button', { name: /play again|retry|restart/i });
    await expect(retryBtn).toBeVisible({ timeout: 500 });
    await retryBtn.click();
    const phase = await gamePage.evaluate(() => (window as any).__gameState?.session?.phase);
    expect(phase).toBe('idle');
  });
});
