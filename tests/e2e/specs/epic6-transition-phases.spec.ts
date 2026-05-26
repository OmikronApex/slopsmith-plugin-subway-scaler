/**
 * Epic 6: Variant Transition Cinematic — Phase State Machine (Story 6.1 smoke).
 *
 * Verifies that:
 * - window.__gameState.variant.transitionPhase starts at 'idle'
 * - After accept trigger, phases complete synchronously: accepted → riding → breather → promoting → active
 * - Phase machine is wired into the accept handler
 *
 * Story 6.1 note: all phases complete synchronously in one frame. After 6.2–6.6, some phases
 * become asynchronous with animation delays. This spec adapts via waitForFunction timeouts.
 */
import { test, expect } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

test.skip(({ browserName }) => browserName !== 'chromium',
  'mic mock requires Chromium fake device flag');

test.describe('Epic 6: transition phase state machine', () => {
  test('transitionPhase starts at idle after game launch', async ({ gamePage }) => {
    await startGame(gamePage);

    const phase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(phase).toBe('idle');
  });

  test('triggerVariantAccept drives phase to active (6.1 smoke, updated for async 6.2-6.6 phases)', async ({ gamePage }) => {
    const errors: string[] = [];
    gamePage.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await startGame(gamePage);

    // Verify phase starts at idle
    const initialPhase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(initialPhase).toBe('idle');

    // Use fast-transition hooks: shorten breather + clear waves so gate fires immediately.
    // Without these the test would need 15s+ for waves to prune, exceeding CI timeout.
    await gamePage.evaluate(() => {
      const t = (window as any).__gameState._test;
      t.setBreatherMs(50);
      t.clearSceneWaves();
      t.triggerVariantAccept(null);
    });

    // accepted→riding→breather are synchronous; wait for the first durable async phase.
    await gamePage.waitForFunction(
      () => (window as any).__gameState?.variant?.transitionPhase === 'active',
      { timeout: 20000 }
    );

    const finalPhase = await gamePage.evaluate(
      () => (window as any).__gameState?.variant?.transitionPhase
    );
    expect(finalPhase).toBe('active');

    // No critical console errors during transition (promote log entries are expected).
    expect(errors.filter(e => !e.includes('[transition-phase]') && !e.includes('[main] promote'))).toHaveLength(0);
  });

  test('transitionPhase field is present on window.__gameState.variant', async ({ gamePage }) => {
    await startGame(gamePage);

    const hasField = await gamePage.evaluate(
      () => 'transitionPhase' in ((window as any).__gameState?.variant ?? {})
    );
    expect(hasField).toBe(true);
  });
});
