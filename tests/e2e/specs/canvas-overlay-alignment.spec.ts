/**
 * Canvas ↔ Overlay Alignment
 *
 * The UX design spec requires HTML overlays to cover the Three.js canvas
 * exactly — same position and same size — at all viewport widths.
 *
 * Tests run at three viewport widths:
 *   - narrow (600px)  — canvas fills container
 *   - desktop (1280px) — canvas hits max-width: 800px cap
 *   - wide (1600px)   — canvas well under container width
 *
 * At desktop/wide viewports the overlay must NOT spill beyond the canvas.
 */
import { test, expect, type Page } from '../fixtures/gameFixture';

async function startGameAndTriggerOverlay(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Plugins' }).click();
  await page.getByText('Subway Scaler', { exact: true }).first().click();
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
  // Setup screen START → onSetupComplete → auto-starts the run
  await page.getByRole('button', { name: 'START' }).click();
  await page.waitForFunction(
    () => (window as any).__gameState?.session?.phase === 'playing',
    { timeout: 10000 }
  );
  // Trigger run-failed overlay
  await page.evaluate(() => (window as any).__gameState._test.forceCollision());
  await page.locator('.game-wrap .overlay:not(.hidden)').waitFor({ timeout: 3000 });
}

function viewportTest(label: string, width: number) {
  test(`canvas and overlay have identical bounding rect at ${label} viewport (${width}px)`, async ({ gamePage }) => {
    // Navigate and start game at a standard width so Slopsmith nav is visible,
    // then resize to the target viewport before checking alignment.
    await gamePage.setViewportSize({ width: 1280, height: 800 });
    await startGameAndTriggerOverlay(gamePage);
    await gamePage.setViewportSize({ width, height: 800 });

    const rects = await gamePage.evaluate(() => {
      const canvas  = document.querySelector('.game-canvas');
      const overlay = document.querySelector('.game-wrap .overlay:not(.hidden)');
      if (!canvas || !overlay) return null;
      const c = canvas.getBoundingClientRect();
      const o = overlay.getBoundingClientRect();
      return {
        canvas:  { top: Math.round(c.top),  left: Math.round(c.left),  width: Math.round(c.width),  height: Math.round(c.height) },
        overlay: { top: Math.round(o.top),  left: Math.round(o.left),  width: Math.round(o.width),  height: Math.round(o.height) },
      };
    });

    expect(rects).not.toBeNull();
    expect(rects!.overlay.top).toBe(rects!.canvas.top);
    expect(rects!.overlay.left).toBe(rects!.canvas.left);
    expect(rects!.overlay.width).toBe(rects!.canvas.width);
    expect(rects!.overlay.height).toBe(rects!.canvas.height);
  });
}

viewportTest('narrow',  600);
viewportTest('desktop', 1280);
viewportTest('wide',    1600);
