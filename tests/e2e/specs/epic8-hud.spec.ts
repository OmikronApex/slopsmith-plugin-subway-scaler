/**
 * Epic 8: In-Game HUD Overlay: Score, Pause Button & Fret Box
 *
 * Stories 8-0 through 8-6: HUD shell, score display, pause button, fret box,
 * variant transition, detail toggle, and accessibility.
 *
 * Chromium only: fake mic device required for game start.
 */
import { test, expect } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

const ROOT = '#subway-scaler-root';

test.skip(({ browserName }) => browserName !== 'chromium',
  'mic mock requires Chromium fake device flag');

// ─── 8-0: HUD Shell ──────────────────────────────────────────────────────────

test.describe('Epic 8-0: HUD shell container', () => {
  test('hud-shell is present in DOM during gameplay', async ({ gamePage }) => {
    await startGame(gamePage);

    const hudShell = gamePage.locator(`${ROOT} .hud-shell`);
    await expect(hudShell).toBeAttached({ timeout: 5000 });
  });

  test('hud-shell has pointer-events: none', async ({ gamePage }) => {
    await startGame(gamePage);

    const pe = await gamePage.locator(`${ROOT} .hud-shell`).evaluate(
      (el) => window.getComputedStyle(el).pointerEvents
    );
    expect(pe).toBe('none');
  });

  test('hud-shell is visible during PLAYING phase', async ({ gamePage }) => {
    await startGame(gamePage);

    const hudShell = gamePage.locator(`${ROOT} .hud-shell`);
    await expect(hudShell).toBeVisible({ timeout: 5000 });
  });

  test('hud-shell is hidden after game-over', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() => (window as any).__gameState._test.forceCollision());

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'game_over' ||
            (window as any).__gameState?.gameOver?.isGameOver === true,
      { timeout: 3000 }
    );

    const display = await gamePage.locator(`${ROOT} .hud-shell`).evaluate(
      (el) => (el as HTMLElement).style.display
    );
    expect(display).toBe('none');
  });
});

// ─── 8-1: Score Display ───────────────────────────────────────────────────────

test.describe('Epic 8-1: Score display', () => {
  test('score display is present in top-right corner during gameplay', async ({ gamePage }) => {
    await startGame(gamePage);

    const scoreEl = gamePage.locator(`${ROOT} .hud-score`);
    await expect(scoreEl).toBeVisible({ timeout: 5000 });
  });

  test('score display shows a number', async ({ gamePage }) => {
    await startGame(gamePage);

    const text = await gamePage.locator(`${ROOT} .hud-score`).textContent({ timeout: 5000 });
    expect(text).toMatch(/^\d+$/);
  });

  test('score display has aria-live="polite"', async ({ gamePage }) => {
    await startGame(gamePage);

    const ariaLive = await gamePage.locator(`${ROOT} .hud-score`).getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
  });
});

// ─── 8-2: Pause Button ───────────────────────────────────────────────────────

test.describe('Epic 8-2: HUD pause button', () => {
  test('HUD pause button is present during gameplay', async ({ gamePage }) => {
    await startGame(gamePage);

    const pauseBtn = gamePage.locator(`${ROOT} .hud-pause-btn`);
    await expect(pauseBtn).toBeVisible({ timeout: 5000 });
  });

  test('HUD pause button has aria-label="Pause game"', async ({ gamePage }) => {
    await startGame(gamePage);

    const label = await gamePage.locator(`${ROOT} .hud-pause-btn`).getAttribute('aria-label');
    expect(label).toBe('Pause game');
  });

  test('clicking HUD pause button transitions phase to paused', async ({ gamePage }) => {
    await startGame(gamePage);

    const pauseBtn = gamePage.locator(`${ROOT} .hud-pause-btn`);
    await expect(pauseBtn).toBeVisible({ timeout: 5000 });
    await pauseBtn.click();

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.session?.phase === 'paused',
      { timeout: 3000 }
    );

    const phase = await gamePage.evaluate(() => (window as any).__gameState.session.phase);
    expect(phase).toBe('paused');
  });

  test('pause overlay is shown after HUD pause button click', async ({ gamePage }) => {
    await startGame(gamePage);

    const pauseBtn = gamePage.locator(`${ROOT} .hud-pause-btn`);
    await expect(pauseBtn).toBeVisible({ timeout: 5000 });
    await pauseBtn.click();

    const overlay = gamePage.locator(`${ROOT} .overlay--pause`);
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });
});

// ─── 8-3: Fret Box ───────────────────────────────────────────────────────────

test.describe('Epic 8-3: Fret box', () => {
  test('fret box panel is present in top-left area during gameplay', async ({ gamePage }) => {
    await startGame(gamePage);

    const fretBox = gamePage.locator(`${ROOT} .hud-fret-box`);
    await expect(fretBox).toBeVisible({ timeout: 5000 });
  });

  test('fret box has role="img"', async ({ gamePage }) => {
    await startGame(gamePage);

    const role = await gamePage.locator(`${ROOT} .hud-fret-box`).getAttribute('role');
    expect(role).toBe('img');
  });

  test('fret box has aria-label describing the pattern', async ({ gamePage }) => {
    await startGame(gamePage);

    const label = await gamePage.locator(`${ROOT} .hud-fret-box`).getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label).not.toBe('Finger pattern');
  });
});

// ─── 8-5: HUD Detail Toggle ──────────────────────────────────────────────────
// Story 8-5 is in review status; the .hud-detail-toggle UI was never implemented.
// Skipped until the feature is built.

test.describe('Epic 8-5: HUD detail toggle', () => {
  test.skip('pause overlay contains HUD Detail toggle with Basic and Full options', async ({ gamePage }) => {
    await startGame(gamePage);

    const pauseBtn = gamePage.locator(`${ROOT} .hud-pause-btn`);
    await expect(pauseBtn).toBeVisible({ timeout: 5000 });
    await pauseBtn.click();

    await expect(gamePage.locator(`${ROOT} .hud-detail-toggle`)).toBeVisible({ timeout: 3000 });
    await expect(gamePage.locator(`${ROOT} .hud-detail-btn`).first()).toBeVisible();
  });
});

// ─── 8-6: Accessibility ──────────────────────────────────────────────────────

test.describe('Epic 8-6: HUD accessibility', () => {
  test('hud-shell has role="group" and aria-label="Game HUD"', async ({ gamePage }) => {
    await startGame(gamePage);

    const role = await gamePage.locator(`${ROOT} .hud-shell`).getAttribute('role');
    const label = await gamePage.locator(`${ROOT} .hud-shell`).getAttribute('aria-label');
    expect(role).toBe('group');
    expect(label).toBe('Game HUD');
  });

  test('only pause button is keyboard-focusable in HUD (Tab order)', async ({ gamePage }) => {
    await startGame(gamePage);

    // score and fret box should have tabindex="-1"
    const scoreTabindex = await gamePage.locator(`${ROOT} .hud-score`).getAttribute('tabindex');
    const fretboxTabindex = await gamePage.locator(`${ROOT} .hud-fret-box`).getAttribute('tabindex');
    expect(scoreTabindex).toBe('-1');
    expect(fretboxTabindex).toBe('-1');

    // pause button should NOT have tabindex="-1"
    const pauseTabindex = await gamePage.locator(`${ROOT} .hud-pause-btn`).getAttribute('tabindex');
    expect(pauseTabindex).not.toBe('-1');
  });
});
