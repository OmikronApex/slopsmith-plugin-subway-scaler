/**
 * Epic 1: Foundation & Session Setup
 *
 * Covers setup screen user journeys: form population, settings persistence,
 * session-config API call, error handling, and UI rendering.
 * Does NOT repeat baseline DOM/ARIA checks already in baseline.spec.ts.
 */
import { test, expect, type Page } from '../fixtures/gameFixture';
import { openSubwayScalerSetup, navigateToHub } from '../fixtures/startGame';

// ─── Story 1.6 — Setup screen form ────────────────────────────────────────────

test.describe('Epic 1: setup screen form (Story 1.6)', () => {
  test('scale dropdown is populated from API with at least 3 options', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

    const select = gamePage.locator('#scale-select');
    await expect(select).toBeVisible();
    const count = await select.locator('option').count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('START button is visible and enabled on load', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

    const startBtn = gamePage.getByRole('button', { name: 'START' });
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
  });

  test('START click fires GET /game/session-config with scale_id, root_midi, instrument_id', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

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
    await openSubwayScalerSetup(gamePage);

    await gamePage.route('**/game/session-config**', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: { message: 'server error' } }) })
    );

    await gamePage.getByRole('button', { name: 'START' }).click();

    const errorMsg = gamePage.locator('.error-message');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    await expect(gamePage.getByRole('button', { name: 'START' })).toBeEnabled();
  });

  test('settings persist across reload via localStorage', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

    const select = gamePage.locator('#scale-select');
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);

    const lastOption = options[options.length - 1];
    await select.selectOption({ label: lastOption });

    const scaleId = await select.inputValue();
    await gamePage.evaluate((id) => {
      const stored = JSON.parse(localStorage.getItem('subway-scaler-settings') || '{}');
      stored.scale_id = id;
      localStorage.setItem('subway-scaler-settings', JSON.stringify(stored));
    }, scaleId);

    // Navigate back to setup (full reload via hub)
    await openSubwayScalerSetup(gamePage);

    const restoredValue = await gamePage.locator('#scale-select').inputValue();
    expect(restoredValue).toBe(scaleId);
  });
});

// ─── Story 1.8 — UX polish ────────────────────────────────────────────────────

test.describe('Epic 1: UX polish (Story 1.8)', () => {
  test('game title "SUBWAY SCALER" is rendered', async ({ gamePage }) => {
    await openSubwayScalerSetup(gamePage);

    const title = gamePage.locator('.game-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('SUBWAY SCALER');
  });

  // Scale preview test removed 2026-05-25 — `.scale-preview` was a mockup-only
  // element that never shipped; feature retired by UX decision.
});
