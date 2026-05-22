/**
 * Epic 5: Variant Track & Decision Window — ATDD Scaffold (Story 0.5c)
 *
 * All tests in this file use test.fail() — they are EXPECTED to fail until Epic 5 is implemented.
 *
 * Purpose:
 *   - These are living acceptance criteria for the Epic 5 implementer.
 *   - They fail now because _test.setVariant = null and window.__gameState.variant fields
 *     are not yet wired to any backend behavior.
 *   - When Epic 5 is implemented: remove test.fail() wrappers and confirm all pass green.
 *
 * When removing test.fail(): also update the DOM selector placeholders
 *   (.variant-track, [data-variant-track]) to match the actual implementation.
 *
 * Chromium only: fake mic device required for game start.
 */
import { test, expect } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

const ROOT = '#subway-scaler-root';

test.skip(({ browserName }) => browserName !== 'chromium',
  'mic mock requires Chromium fake device flag');

// ─── ATDD scaffolds: variant activation ──────────────────────────────────────

test.describe('Epic 5 ATDD: variant activation', () => {
  test.fail('_test.setVariant sets variant.id within 1000ms', async ({ gamePage }) => {
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

  test.fail('variant.timerRunning becomes true after setVariant', async ({ gamePage }) => {
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

  test.fail('variant track DOM element appears when variant is active', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    // Wait for variant to be active
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.id != null,
      { timeout: 1000 }
    );

    // Update .variant-track to the actual selector when Epic 5 ships
    const variantTrack = gamePage.locator(`${ROOT} .variant-track, ${ROOT} [data-variant-track]`);
    await expect(variantTrack).toBeVisible({ timeout: 2000 });
  });
});

// ─── ATDD scaffolds: decision window timer ────────────────────────────────────

test.describe('Epic 5 ATDD: decision window timer', () => {
  test.fail('variant.timerMs decreases over time (countdown running)', async ({ gamePage }) => {
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

  test.fail('variant.timerExpired becomes true when timer reaches 0', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    // setVariant is null → evaluate throws → test.fail() catches assertion failure immediately.
    // Do NOT use waitForFunction with a long timeout here: test.fail() only catches
    // status:'failed' (assertion error), not status:'timedOut' (test-level timeout).
    const expired = await gamePage.evaluate(() => (window as any).__gameState.variant.timerExpired);
    expect(expired).toBe(true);
  });
});

// ─── ATDD scaffolds: variant reset after expiry ───────────────────────────────

test.describe('Epic 5 ATDD: variant reset', () => {
  test.fail('variant.id returns to null after timer expires', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    // setVariant is null → evaluate throws → test.fail() catches immediately.
    // Avoid long waitForFunction chains: test.fail() only catches assertion failures, not timeouts.
    const id = await gamePage.evaluate(() => (window as any).__gameState.variant.id);
    expect(id).toBeNull();
  });

  test.fail('variant.timerRunning is false after timer expires', async ({ gamePage }) => {
    await startGame(gamePage);

    await gamePage.evaluate(() =>
      (window as any).__gameState._test.setVariant('pentatonic-shift')
    );

    // setVariant is null → evaluate throws → test.fail() catches immediately.
    const running = await gamePage.evaluate(() => (window as any).__gameState.variant.timerRunning);
    expect(running).toBe(false);
  });
});
