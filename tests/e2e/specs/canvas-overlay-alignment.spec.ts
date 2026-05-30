/**
 * Canvas ↔ Overlay Alignment
 *
 * The UX design spec requires HTML overlays to cover the Three.js canvas
 * exactly — same position and same size — at all viewport widths.
 */
import { test, expect, type Page } from '../fixtures/gameFixture';
import { startGame } from '../fixtures/startGame';

async function startGameAndTriggerOverlay(page: Page) {
  await startGame(page);
  await page.evaluate(() => (window as any).__gameState._test.forceCollision());
  await page.locator('.game-wrap .overlay:not(.hidden)').waitFor({ timeout: 3000 });
  await page.waitForTimeout(300);
}

function viewportTest(label: string, width: number) {
  test(`canvas and overlay have identical bounding rect at ${label} viewport (${width}px)`, async ({ gamePage }) => {
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
