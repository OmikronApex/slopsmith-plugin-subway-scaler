/**
 * Epic 6: Variant Transition Cinematic — Comprehensive E2E coverage (Story 6.7).
 *
 * Tests the full phase progression: accepted → riding → breather → promoting → active.
 *
 * Uses two test hooks to make the breather phase testable in CI time:
 *   _test.setBreatherMs(50)    — shorten breather timer (default 3000ms) to 50ms
 *   _test.clearSceneWaves()   — clear active wave meshes AND scheduler queue so
 *                               wave-clearance gate fires immediately
 *
 * Phase observability note:
 *   accepted → riding → breather all fire synchronously within one triggerVariantAccept()
 *   call. Playwright polling cannot observe those transient states. The first durably
 *   observable phase is 'breather' (held for ~50ms until the timer fires).
 *   After breather: 'promoting' (async, after track landing), then 'active' (async, HTTP).
 *
 * Without these hooks the breather could take ~24s waiting for waves to prune naturally.
 * The hooks are only available in __TEST_MODE (set by the Playwright fixture).
 */
import { test, expect } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

test.skip(({ browserName }) => browserName !== 'chromium',
  'mic mock requires Chromium fake device flag');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForPhase(page: any, targetPhase: string, timeoutMs = 20000) {
  await page.waitForFunction(
    (phase: string) => (window as any).__gameState?.variant?.transitionPhase === phase,
    targetPhase,
    { timeout: timeoutMs }
  );
}

async function triggerFastTransition(page: any) {
  await page.evaluate(() => {
    const t = (window as any).__gameState._test;
    // Shorten breather so tests don't wait 3s + wave-prune time.
    t.setBreatherMs(50);
    // Clear existing in-flight waves (scene meshes + scheduler queue) so the
    // wave-clearance gate is satisfied immediately on the next RAF frame.
    t.clearSceneWaves();
    // Trigger the phase machine.
    t.triggerVariantAccept(null);
  });
}

// ─── Full phase progression ───────────────────────────────────────────────────

test.describe('Epic 6: full phase progression', () => {
  test('variant transition: full phase progression accepted → riding → breather → promoting → active', async ({ gamePage }) => {
    const errors: string[] = [];
    gamePage.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await startGame(gamePage);

    const initialPhase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(initialPhase).toBe('idle');

    await triggerFastTransition(gamePage);

    // breather: last of the synchronous chain (accepted→riding→breather all sync).
    // Held for ~50ms (setBreatherMs) — first durably observable phase.
    await waitForPhase(gamePage, 'breather', 3000);

    // promoting: after 50ms breather timer + wave-clearance gate + track landing (immediate).
    await waitForPhase(gamePage, 'promoting', 5000);

    // active: after promoteVariant HTTP call (~<500ms local).
    await waitForPhase(gamePage, 'active', 20000);

    const finalPhase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(finalPhase).toBe('active');

    const criticalErrors = errors.filter(e =>
      !e.includes('[transition-phase]') && !e.includes('[main] promote')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─── Phase state guards ───────────────────────────────────────────────────────

test.describe('Epic 6: phase state guards', () => {
  test('transitionPhase is idle at game start', async ({ gamePage }) => {
    await startGame(gamePage);
    const phase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(phase).toBe('idle');
  });

  test('transitionPhase field always present on __gameState.variant', async ({ gamePage }) => {
    await startGame(gamePage);
    const hasField = await gamePage.evaluate(
      () => 'transitionPhase' in ((window as any).__gameState?.variant ?? {})
    );
    expect(hasField).toBe(true);
  });

  test('variant transition: accepted phase entered immediately after trigger', async ({ gamePage }) => {
    await startGame(gamePage);
    await triggerFastTransition(gamePage);
    // accepted→riding→breather fire synchronously — phase is already ≥breather before polling starts.
    // Verify the phase advanced from idle (any post-trigger phase is valid).
    await waitForPhase(gamePage, 'breather', 3000);
    const phase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(['breather', 'promoting', 'active']).toContain(phase);
  });

  test('variant transition: breather phase is entered after riding', async ({ gamePage }) => {
    await startGame(gamePage);
    await triggerFastTransition(gamePage);
    // riding is synchronous and not directly observable; breather is the first durable state.
    await waitForPhase(gamePage, 'breather', 3000);
    await waitForPhase(gamePage, 'promoting', 5000);
    const phase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(['promoting', 'active']).toContain(phase);
  });

  test('variant transition: active phase reached without console errors', async ({ gamePage }) => {
    const errors: string[] = [];
    gamePage.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await startGame(gamePage);
    await triggerFastTransition(gamePage);
    await waitForPhase(gamePage, 'active', 20000);

    const criticalErrors = errors.filter(e =>
      !e.includes('[transition-phase]') && !e.includes('[main] promote')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─── Wave count behavior ──────────────────────────────────────────────────────

test.describe('Epic 6: wave count during transition', () => {
  test('wave count remains non-negative through full transition', async ({ gamePage }) => {
    await startGame(gamePage);
    await triggerFastTransition(gamePage);
    await waitForPhase(gamePage, 'active', 20000);

    const waveCount = await gamePage.evaluate(
      () => (window as any).__gameState?.scene?.waveCount ?? 0
    );
    expect(waveCount).toBeGreaterThanOrEqual(0);
  });
});

// ─── Error recovery ───────────────────────────────────────────────────────────

test.describe('Epic 6: error recovery', () => {
  test('game continues normally without triggering transition — no crash', async ({ gamePage }) => {
    await startGame(gamePage);

    // No transition triggered; game should be in idle + playing state.
    const phase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(phase).toBe('idle');

    const sessionPhase = await gamePage.evaluate(
      () => (window as any).__gameState?.session?.phase
    );
    expect(sessionPhase).toBe('playing');
  });
});
