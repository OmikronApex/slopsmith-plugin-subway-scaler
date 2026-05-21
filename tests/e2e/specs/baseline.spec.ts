// Standard baseline E2E suite (FR-E2E-001 through FR-E2E-006).
// Covers pre-game-start plugin UI only — no audio, no active game session.
import { test, expect, type Page } from '../fixtures/gameFixture';

// Selectors confirmed from screen.html and static/game/ui/setup.js
const SELECTORS = {
  root: '#subway-scaler-root',         // plugin mount point
  pluginsBtn: 'button:has-text("Plugins")',
  pluginLink: 'text=Subway Scaler',
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
];

async function navigateToPlugin(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Plugins' }).click();
  await page.getByText('Subway Scaler', { exact: true }).first().click();
  // Wait for setup screen to confirm bootstrap() ran
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
}

test.describe('baseline: load health', () => {
  test('page loads with HTTP 200 and networkidle within 10s (FR-E2E-001)', async ({ gamePage }) => {
    const response = await gamePage.goto('/');
    expect(response?.status()).toBe(200);
    await gamePage.waitForLoadState('networkidle', { timeout: 10000 });
  });

  test('zero JS pageerrors on load (FR-E2E-003)', async ({ gamePage }) => {
    const errors: string[] = [];
    gamePage.on('pageerror', err => errors.push(err.message));
    await navigateToPlugin(gamePage);
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
    await navigateToPlugin(gamePage);
    expect(consoleIssues).toEqual([]);
  });
});

test.describe('baseline: DOM render (FR-E2E-002)', () => {
  test('plugin root container is present and visible', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);
    const root = gamePage.locator(SELECTORS.root);
    await expect(root).toBeVisible();
  });

  test('canvas element is present inside plugin root', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);
    const canvas = gamePage.locator(`${SELECTORS.root} canvas`);
    // Canvas is rendered but inside game-wrap (display:none until game starts) — assert existence
    await expect(canvas).toHaveCount(1);
  });
});

test.describe('baseline: ARIA (FR-E2E-004)', () => {
  test('all inputs and selects inside plugin root have an accessible label', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const violations = await gamePage.evaluate((rootSel) => {
      const root = document.querySelector(rootSel);
      if (!root) return ['plugin root not found'];
      const els = [...root.querySelectorAll('input, select')];
      return els
        .filter(el => {
          const hasAriaLabel = el.getAttribute('aria-label');
          const id = el.id;
          const hasLabelFor = id && document.querySelector(`label[for="${id}"]`);
          const hasWrappingLabel = el.closest('label');
          return !hasAriaLabel && !hasLabelFor && !hasWrappingLabel;
        })
        .map(el => `${el.tagName}#${(el as HTMLElement).id || '(no id)'}.${(el as HTMLElement).className}`);
    }, SELECTORS.root);

    expect(violations).toEqual([]);
  });

  test('all buttons inside plugin root have a non-empty accessible name', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const violations = await gamePage.evaluate((rootSel) => {
      const root = document.querySelector(rootSel);
      if (!root) return ['plugin root not found'];
      const btns = [...root.querySelectorAll('button')];
      return btns
        .filter(btn => {
          const ariaLabel = btn.getAttribute('aria-label');
          const text = btn.textContent?.trim();
          const ariaLabelledBy = btn.getAttribute('aria-labelledby');
          return !ariaLabel && !text && !ariaLabelledBy;
        })
        .map(btn => `button#${btn.id || '(no id)'}[class="${btn.className}"]`);
    }, SELECTORS.root);

    expect(violations).toEqual([]);
  });
});

test.describe('baseline: keyboard navigation (FR-E2E-005)', () => {
  test('Tab advances focus through at least 3 distinct elements without losing to body', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const focused: string[] = [];
    for (let i = 0; i < 8; i++) {
      await gamePage.keyboard.press('Tab');
      const info = await gamePage.evaluate(() => ({
        tag: document.activeElement?.tagName ?? 'UNKNOWN',
        id: (document.activeElement as HTMLElement)?.id ?? '',
        isBody: document.activeElement === document.body,
      }));
      if (!info.isBody) {
        const key = `${info.tag}#${info.id}`;
        if (!focused.includes(key)) focused.push(key);
      }
    }

    expect(focused.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe('baseline: focus trap (FR-E2E-006)', () => {
  test.skip(true, 'Focus trap requires overlay — implement in Epic 4 when overlay is added to setup screen');
});
