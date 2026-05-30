// Standard baseline E2E suite (FR-E2E-001 through FR-E2E-006).
// Covers pre-game-start plugin UI only — no audio, no active game session.
import { test, expect, type Page } from '../fixtures/gameFixture';
import { openSubwayScalerSetup } from '../fixtures/startGame';

// Selectors confirmed from screen.html and static/game/ui/setup.js
const SELECTORS = {
  startBtn: 'button:has-text("START")', // setup screen submit
};

// Warnings acceptable in this environment
const ALLOWED_WARNINGS: string[] = [
  'THREE.WebGLRenderer',
  'THREE.WebGL',
  // Slopsmith host uses Tailwind CDN (not our code)
  'cdn.tailwindcss.com should not be used in production',
  // Browser deprecation warning for range inputs with appearance:slider-vertical (audio panel)
  "keyword 'slider-vertical'",
  // Flappy Bend missing assets in dev environment — not our plugin
  '[flappy_bend]',
  'flappy_bend',
  // Generic 404s from other plugins' missing assets in dev Docker image
  'Failed to load resource',
];

test.describe('baseline: load health', () => {
  test('page loads with HTTP 200 and networkidle within 10s (FR-E2E-001)', async ({ gamePage }) => {
    const response = await gamePage.goto('/');
    expect(response?.status()).toBe(200);
    await gamePage.waitForLoadState('networkidle', { timeout: 10000 });
  });

  test('zero JS pageerrors on load (FR-E2E-003)', async ({ gamePage }) => {
    const errors: string[] = [];
    gamePage.on('pageerror', err => errors.push(err.message));
    await openSubwayScalerSetup(gamePage);
    expect(errors).toHaveLength(0);
  });

  test('zero console errors/warnings on load (FR-E2E-003)', async ({ gamePage }) => {
    const consoleIssues: string[] = [];
    gamePage.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const text = msg.text();
        if (!ALLOWED_WARNINGS.some(w => text.includes(w))) {
          consoleIssues.push(`[${msg.type()}] ${text}`);
        }
      }
    });
    await openSubwayScalerSetup(gamePage);
    expect(consoleIssues).toEqual([]);
  });
});

test.describe('baseline: DOM render (FR-E2E-002)', () => {
  test('plugin root container is present and visible', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    // In hub mode the game mounts inside #mg-stage-body
    const root = gamePage.locator('#mg-stage-body .subway-scaler');
    await expect(root).toBeVisible({ timeout: 5000 });
  });

  test('setup screen is visible before game starts', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const startBtn = gamePage.getByRole('button', { name: 'START' });
    await expect(startBtn).toBeVisible();
  });

  test('scale select is present in setup screen', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);
    const select = gamePage.locator('#scale-select');
    await expect(select).toBeVisible();
  });
});
