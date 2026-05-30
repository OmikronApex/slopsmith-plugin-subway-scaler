// Chromium-only: --use-file-for-fake-audio-capture is a Chromium flag.
// Each test launches its own browser instance (launchOptions.args are browser-level, not context-level).
import { test, expect, chromium } from '@playwright/test';
import { injectAudioFile } from '../helpers/audioHelper';
import path from 'path';

test.skip(({ browserName }) => browserName !== 'chromium',
  'WAV injection requires Chromium --use-file-for-fake-audio-capture flag');

async function navigateAndStartGame(page: any) {
  await page.goto('http://localhost:8000');
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: 'Minigames' }).click();
  await page.locator('[aria-label="Subway Scaler"]').waitFor({ timeout: 10000 });
  await page.locator('[aria-label="Subway Scaler"]').click();
  await page.locator('#mg-picker-start').waitFor({ timeout: 5000 });
  await page.locator('#mg-picker-start').click();
  await page.getByRole('button', { name: 'START' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'START' }).click();
  await page.waitForFunction(
    () => (window as any).__gameState?.session?.phase !== 'idle',
    { timeout: 10000 }
  );
}

test('A4 440Hz is detected as "A4" within 2000ms', async () => {
  const { context, closeBrowser } = await injectAudioFile(
    path.join('tests', 'e2e', 'fixtures', 'audio', 'A4_440hz.wav')
  );
  const page = await context.newPage();
  await page.addInitScript(() => { (window as any).__TEST_MODE = true; });
  try {
    await navigateAndStartGame(page);

    await page.waitForFunction(
      () => (window as any).__audioState?.pipelineReady === true,
      { timeout: 5000 }
    );
    await page.waitForFunction(
      () => (window as any).__gameState?.lastDetectedNote === 'A4',
      { timeout: 2000 }
    );

    const note = await page.evaluate(() => (window as any).__gameState?.lastDetectedNote);
    expect(note).toBe('A4');
  } finally {
    await closeBrowser();
  }
});

test('silence.wav produces no detected note after 2000ms', async () => {
  const { context, closeBrowser } = await injectAudioFile(
    path.join('tests', 'e2e', 'fixtures', 'audio', 'silence.wav')
  );
  const page = await context.newPage();
  await page.addInitScript(() => { (window as any).__TEST_MODE = true; });
  try {
    await navigateAndStartGame(page);

    await page.waitForFunction(
      () => (window as any).__audioState?.pipelineReady === true,
      { timeout: 5000 }
    );
    await page.waitForTimeout(2000);

    const note = await page.evaluate(() => (window as any).__gameState?.lastDetectedNote);
    expect(note).toBeNull();
  } finally {
    await closeBrowser();
  }
});
