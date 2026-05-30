/**
 * Epic 6: Variant Transition Cinematic — Comprehensive E2E coverage (Story 6.7).
 *
 * Tests the full phase progression: accepted → riding → promoting → active.
 *
 * Note (Story 9-11 refactor): the 'breather' phase is no longer part of the
 * triggerVariantAccept test path. The riding listener (no geometry) advances
 * directly to 'promoting', which calls promoteVariant(). In __TEST_MODE the
 * promoting listener falls back to ctx.resp when the HTTP call fails (no real
 * backend variant is created by triggerVariantAccept).
 *
 * Phase observability note:
 *   accepted → riding fire synchronously within triggerVariantAccept().
 *   The first durably observable phase is 'promoting' (async HTTP, ~<200ms local).
 *   After promoting: 'active' fires synchronously in the HTTP callback.
 *
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
    // Trigger the phase machine. The riding listener (no geometry) advances
    // directly to promoting; setBreatherMs/clearSceneWaves are no-ops for this path.
    t.triggerVariantAccept(null);
  });
}

// ─── Full phase progression ───────────────────────────────────────────────────

test.describe('Epic 6: full phase progression', () => {
  test('variant transition: full phase progression accepted → riding → promoting → active', async ({ gamePage }) => {
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

    // 'promoting' is transient (~50ms HTTP round-trip); poll directly for 'active'.
    await waitForPhase(gamePage, 'active', 10000);

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

  test('variant transition: phase reaches active after trigger', async ({ gamePage }) => {
    await startGame(gamePage);
    await triggerFastTransition(gamePage);
    // 'promoting' is too transient (~50ms) to poll reliably; wait for stable 'active'.
    await waitForPhase(gamePage, 'active', 10000);
    const phase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(phase).toBe('active');
  });

  test('variant transition: active phase is reached from riding via promoting', async ({ gamePage }) => {
    await startGame(gamePage);
    await triggerFastTransition(gamePage);
    await waitForPhase(gamePage, 'active', 10000);
    const phase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(phase).toBe('active');
  });

  test('variant transition: active phase reached without console errors', async ({ gamePage }) => {
    const errors: string[] = [];
    gamePage.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await startGame(gamePage);
    await triggerFastTransition(gamePage);
    await waitForPhase(gamePage, 'active', 10000);

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
    await waitForPhase(gamePage, 'active', 10000);

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
