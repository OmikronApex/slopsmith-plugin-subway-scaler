/**
 * UX Design Audit — Session Setup Screen
 *
 * Verifies that the implemented setup screen matches the Night City design
 * specification from ux-design-specification.md.
 */
import { test, expect, type Page } from '../fixtures/gameFixture';
import { openSubwayScalerSetup } from '../fixtures/startGame';

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─── Design tokens ─────────────────────────────────────────────────────────────

test.describe('UX audit: design tokens injected', () => {
  test('--color-accent CSS custom property is #FFB800', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const value = await gamePage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
    );
    expect(value.toLowerCase()).toBe('#ffb800');
  });

  test('--color-bg-void CSS custom property is #0D0D1A', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const value = await gamePage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg-void').trim()
    );
    expect(value.toLowerCase()).toBe('#0d0d1a');
  });

  test('--color-bg-stage CSS custom property is #1A1A2E', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const value = await gamePage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg-stage').trim()
    );
    expect(value.toLowerCase()).toBe('#1a1a2e');
  });
});

// ─── Typography ────────────────────────────────────────────────────────────────

test.describe('UX audit: typography', () => {
  test('game title uses Space Mono font', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    await gamePage.evaluate(() => document.fonts.ready);
    const fontFamily = await gamePage.evaluate(() => {
      const el = document.querySelector('.game-title');
      return el ? getComputedStyle(el).fontFamily : null;
    });
    expect(fontFamily?.toLowerCase()).toContain('space mono');
  });

  test('game title has RGB-shift text-shadow', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const shadow = await gamePage.evaluate(() => {
      const el = document.querySelector('.game-title');
      return el ? getComputedStyle(el).textShadow : null;
    });
    expect(shadow).not.toBe('none');
    expect(shadow).not.toBeNull();
  });

  test('START button uses Space Mono font', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const fontFamily = await gamePage.evaluate(() => {
      const btn = document.querySelector('.start-button');
      return btn ? getComputedStyle(btn).fontFamily : null;
    });
    expect(fontFamily?.toLowerCase()).toContain('space mono');
  });
});

// ─── Color palette ─────────────────────────────────────────────────────────────

test.describe('UX audit: Night City color palette', () => {
  test('setup container background is color-bg-void (#0D0D1A)', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const bg = await gamePage.evaluate(() => {
      const el = document.querySelector('.setup-container');
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    expect(bg).toBe(hexToRgb('#0D0D1A'));
  });

  test('START button background is accent yellow (#FFB800)', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const bg = await gamePage.evaluate(() => {
      const btn = document.querySelector('.start-button');
      return btn ? getComputedStyle(btn).backgroundColor : null;
    });
    expect(bg).toBe(hexToRgb('#FFB800'));
  });

  test('setup form background is color-bg-stage (#1A1A2E)', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const bg = await gamePage.evaluate(() => {
      const el = document.querySelector('.setup-form');
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    expect(bg).toBe(hexToRgb('#1A1A2E'));
  });

  test('game title color is accent yellow (#FFB800)', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const color = await gamePage.evaluate(() => {
      const el = document.querySelector('.game-title');
      return el ? getComputedStyle(el).color : null;
    });
    expect(color).toBe(hexToRgb('#FFB800'));
  });
});

// ─── Layout ────────────────────────────────────────────────────────────────────

test.describe('UX audit: layout', () => {
  test('setup form uses CSS grid (not flex column)', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const display = await gamePage.evaluate(() => {
      const el = document.querySelector('.setup-form');
      return el ? getComputedStyle(el).display : null;
    });
    expect(display).toBe('grid');
  });

  test('difficulty uses toggle buttons, not a <select>', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const toggleCount = await gamePage.evaluate(() =>
      document.querySelectorAll('.toggle-button').length
    );
    expect(toggleCount).toBeGreaterThanOrEqual(5);
  });

  test('selected toggle button has accent background (#FFB800)', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const bg = await gamePage.evaluate(() => {
      const selected = document.querySelector('.toggle-button.selected');
      return selected ? getComputedStyle(selected).backgroundColor : null;
    });
    expect(bg).toBe(hexToRgb('#FFB800'));
  });
});
