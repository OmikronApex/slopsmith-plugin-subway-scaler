// Chromium-only: fake mic device flags are --use-fake-device-for-media-stream
// and --use-fake-ui-for-media-stream (set in playwright.config.ts).
// Firefox/Safari mic testing is deferred to a future story.
import { test, expect, type Page } from '@playwright/test';

async function navigateToPlugin(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Plugin nav item is injected dynamically by Slopsmith under the Plugins dropdown
  await page.getByRole('button', { name: 'Plugins' }).click();
  await page.getByText('Subway Scaler', { exact: true }).first().click();
  // Submit setup screen — START → onSetupComplete → auto-starts run and calls startAudio()
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'START' }).click();
  await page.waitForFunction(
    () => (window as any).__gameState?.session?.phase !== 'idle',
    { timeout: 10000 }
  );
}

test.describe('fake microphone device', () => {
  test.skip(({ browserName }) => browserName !== 'chromium',
    'mic mock requires Chromium fake device flag');

  test('getUserMedia resolves with a non-null MediaStream', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasStream = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream != null && stream.getAudioTracks().length > 0;
    });

    expect(hasStream).toBe(true);
  });

  test('window.__audioState.micActive becomes true within 3000ms of audio start', async ({ page }) => {
    await navigateToPlugin(page);

    await page.waitForFunction(
      () => (window as any).__audioState?.micActive === true,
      { timeout: 3000 }
    );

    const micActive = await page.evaluate(() => (window as any).__audioState.micActive);
    expect(micActive).toBe(true);
  });

  test('window.__audioState.pipelineReady becomes true within 5000ms of audio start', async ({ page }) => {
    await navigateToPlugin(page);

    await page.waitForFunction(
      () => (window as any).__audioState?.pipelineReady === true,
      { timeout: 5000 }
    );

    const pipelineReady = await page.evaluate(() => (window as any).__audioState.pipelineReady);
    expect(pipelineReady).toBe(true);
  });

  test('window.__audioState.streamType equals "fake" with Chromium fake device', async ({ page }) => {
    await navigateToPlugin(page);

    await page.waitForFunction(
      () => (window as any).__audioState?.streamType != null,
      { timeout: 5000 }
    );

    const streamType = await page.evaluate(() => (window as any).__audioState.streamType);
    expect(streamType).toBe('fake');
  });
});
