/**
 * Epic N Story N-M: [Story Title]
 *
 * Tests the [feature description] user journey.
 * Depends on: window.__gameState (story 0-5), gamePage fixture (story 0-5)
 *
 * Baseline tests (DOM, ARIA, keyboard nav) are NOT repeated here.
 * This file tests only the story's specific acceptance criteria.
 */
import { test, expect } from '../fixtures/gameFixture';
import { injectAudioFile } from '../helpers/audioHelper';
import path from 'path';

// Replace with story-specific selectors confirmed from screen.html / DevTools
const SELECTORS = {
  // exampleButton: 'button:has-text("Start")',
};

// Navigate to the plugin setup screen (bootstrap() has run at this point)
async function navigateToPlugin(page: any) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Plugins' }).click();
  await page.getByText('Subway Scaler', { exact: true }).first().click();
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
}

test.describe('Epic N: [Feature Name]', () => {

  // Example: test that does NOT need audio or game state
  test('feature renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // assertions here
  });

  // Example: test that needs window.__gameState (uses gamePage fixture)
  test('game state reflects action', async ({ gamePage }) => {
    await navigateToPlugin(gamePage);
    await gamePage.waitForFunction(() => (window as any).__gameState != null);
    const phase = await gamePage.evaluate(() => (window as any).__gameState?.session?.phase);
    expect(phase).toBe('idle');
    // assertions here
  });

  // Example: test that needs audio injection (Chromium-only)
  test.skip(({ browserName }) => browserName !== 'chromium', 'audio injection requires Chromium');
  test('note detection works', async ({ gamePage }) => {
    const { context, closeBrowser } = await injectAudioFile(
      path.join('tests', 'e2e', 'fixtures', 'audio', 'A4_440hz.wav')
    );
    const page = await context.newPage();
    await page.addInitScript(() => { (window as any).__TEST_MODE = true; });
    try {
      await page.goto('http://localhost:8000');
      await page.waitForFunction(() => (window as any).__audioState?.pipelineReady, { timeout: 5000 });
      // assertions here
    } finally {
      await closeBrowser();
    }
  });
});
