/**
 * Epic 5: Variant Track & Decision Window — E2E acceptance tests.
 *
 * These tests validate the observable variant state and test hook wired in Story 5-1.
 * All test.fail() wrappers removed in Story 5-2 after implementation is complete.
 *
 * Chromium only: fake mic device required for game start.
 */
import { test, expect } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

const ROOT = '#subway-scaler-root';

test.skip(({ browserName }) => browserName !== 'chromium',
  'mic mock requires Chromium fake device flag');

// ─── Variant activation ───────────────────────────────────────────────────────

test.describe('Epic 5: variant activation', () => {
  test('_test.setVariant sets variant.id within 1000ms', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.id === 'pentatonic-shift',
      { timeout: 1000 }
    );

    const id = await gamePage.evaluate(() => (window as any).__gameState.variant.id);
    expect(id).toBe('pentatonic-shift');
  });

  test('variant.timerRunning becomes true after setVariant', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.timerRunning === true,
      { timeout: 1000 }
    );

    const running = await gamePage.evaluate(() => (window as any).__gameState.variant.timerRunning);
    expect(running).toBe(true);
  });

  test('variant track DOM element appears when variant is active', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.id != null,
      { timeout: 1000 }
    );

    const variantTrack = gamePage.locator(`${ROOT} .variant-track, ${ROOT} [data-variant-track]`);
    await expect(variantTrack).toBeVisible({ timeout: 2000 });
  });
});

// ─── Decision window timer ────────────────────────────────────────────────────

test.describe('Epic 5: decision window timer', () => {
  test('variant.timerMs decreases over time (countdown running)', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.timerRunning === true,
      { timeout: 1000 }
    );

    const t1 = await gamePage.evaluate(() => (window as any).__gameState.variant.timerMs);
    await gamePage.waitForTimeout(500);
    const t2 = await gamePage.evaluate(() => (window as any).__gameState.variant.timerMs);

    expect(t2).toBeLessThan(t1);
  });

  test('variant.timerExpired becomes true when timer reaches 0', async ({ gamePage }) => {
    await startGame(gamePage);

    // Use a short duration so the test doesn't time out
    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift', 300)
    );

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.timerExpired === true,
      { timeout: 3000 }
    );

    const expired = await gamePage.evaluate(() => (window as any).__gameState.variant.timerExpired);
    expect(expired).toBe(true);
  });
});

// ─── Variant reset after expiry ───────────────────────────────────────────────

test.describe('Epic 5: variant reset', () => {
  test('variant.id returns to null after timer expires', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift', 300)
    );

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.timerExpired === true,
      { timeout: 3000 }
    );

    const id = await gamePage.evaluate(() => (window as any).__gameState.variant.id);
    expect(id).toBeNull();
  });

  test('variant.timerRunning is false after timer expires', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift', 300)
    );

    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.timerExpired === true,
      { timeout: 3000 }
    );

    const running = await gamePage.evaluate(() => (window as any).__gameState.variant.timerRunning);
    expect(running).toBe(false);
  });
});
