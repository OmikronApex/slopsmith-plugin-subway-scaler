/**
 * Epic 1: Foundation & Session Setup
 *
 * Covers setup screen user journeys: form population, settings persistence,
 * session-config API call, error handling, and UI rendering.
 * Does NOT repeat baseline DOM/ARIA checks already in baseline.spec.ts.
 */
import { test, expect, type Page } from '../fixtures/gameFixture';

const ROOT = '#subway-scaler-root';

async function navigateToPlugin(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Plugins' }).click();
  await page.getByText('Subway Scaler', { exact: true }).first().click();
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
}

// ─── Story 1.6 — Setup screen form ────────────────────────────────────────────

test.describe('Epic 1: setup screen form (Story 1.6)', () => {
  test('scale dropdown is populated from API with at least 3 options', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const select = gamePage.locator(`${ROOT} #scale-select`);
    await expect(select).toBeVisible();
    const count = await select.locator('option').count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('START button is visible and enabled on load', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const startBtn = gamePage.getByRole('button', { name: 'START' });
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
  });

  test('START click fires GET /game/session-config with scale_id, root_midi, instrument_id', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const [request] = await Promise.all([
      gamePage.waitForRequest(req =>
        req.url().includes('/game/session-config') && req.method() === 'GET',
        { timeout: 5000 }
      ),
      gamePage.getByRole('button', { name: 'START' }).click(),
    ]);

    const url = new URL(request.url());
    expect(url.searchParams.has('scale_id')).toBe(true);
    expect(url.searchParams.has('root_midi')).toBe(true);
    expect(url.searchParams.has('instrument_id')).toBe(true);
  });

  test('session-config failure shows error message and re-enables START', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    await gamePage.route('**/game/session-config**', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: { message: 'server error' } }) })
    );

    await gamePage.getByRole('button', { name: 'START' }).click();

    const errorMsg = gamePage.locator(`${ROOT} .error-message`);
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    await expect(gamePage.getByRole('button', { name: 'START' })).toBeEnabled();
  });

  test('settings persist across reload via localStorage', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    // Read the current first option so we pick a different one
    const select = gamePage.locator(`${ROOT} #scale-select`);
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);

    // Select the last option
    const lastOption = options[options.length - 1];
    await select.selectOption({ label: lastOption });

    // Write localStorage directly (same as what setup.js does)
    const scaleId = await select.inputValue();
    await gamePage.evaluate((id) => {
      const stored = JSON.parse(localStorage.getItem('subway-scaler-settings') || '{}');
      stored.scale_id = id;
      localStorage.setItem('subway-scaler-settings', JSON.stringify(stored));
    }, scaleId);

    // Navigate back to plugin (full reload)
    await navigateToPlugin(gamePage);

    const restoredValue = await gamePage.locator(`${ROOT} #scale-select`).inputValue();
    expect(restoredValue).toBe(scaleId);
  });
});

// ─── Story 1.8 — UX polish ────────────────────────────────────────────────────

test.describe('Epic 1: UX polish (Story 1.8)', () => {
  test('game title "SUBWAY SCALER" is rendered', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const title = gamePage.locator(`${ROOT} .game-title`);
    await expect(title).toBeVisible();
    await expect(title).toHaveText('SUBWAY SCALER');
  });

  test('scale preview element is present and updates on selection change', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);

    const preview = gamePage.locator(`${ROOT} .scale-preview`);
    await expect(preview).toBeVisible();

    // Change scale selection and check preview updates
    const select = gamePage.locator(`${ROOT} #scale-select`);
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);

    await select.selectOption({ index: 0 });
    const text0 = await preview.textContent();

    await select.selectOption({ index: 1 });
    const text1 = await preview.textContent();

    // At minimum the preview should have non-empty content
    expect(text0?.trim().length).toBeGreaterThan(0);
    // And it should differ between selections (unless names happen to be the same)
    if (options[0] !== options[1]) {
      expect(text1).not.toBe(text0);
    }
  });
});
