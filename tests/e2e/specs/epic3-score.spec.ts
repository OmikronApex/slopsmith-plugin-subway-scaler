/**
 * Epic 3 — Score increment via WAV injection (Story 3.6, 3.8)
 *
 * Chromium-only: uses --use-file-for-fake-audio-capture.
 * Injects A4_440hz.wav and pins session-config to A major (root_midi=69)
 * so the first wave note matches the injected audio, driving a real score increment.
 */
import { test, expect } from '@playwright/test';
import { injectAudioFile } from '../helpers/audioHelper';
import path from 'path';

const SESSION_CONFIG_FIXTURE = {
  scale_id: 'major',
  root_midi: 69,
  instrument_id: 'guitar-standard',
  notes: [
    { midi: 69, name: 'A4', string: 6, fret: 5 },
    { midi: 71, name: 'B4', string: 6, fret: 7 },
    { midi: 73, name: 'C#5', string: 5, fret: 4 },
    { midi: 74, name: 'D5', string: 5, fret: 5 },
    { midi: 76, name: 'E5', string: 5, fret: 7 },
    { midi: 78, name: 'F#5', string: 4, fret: 4 },
    { midi: 80, name: 'G#5', string: 4, fret: 6 },
    { midi: 81, name: 'A5', string: 4, fret: 7 },
  ],
  track_count: 4,
};

test.skip(({ browserName }) => browserName !== 'chromium',
  'WAV injection requires Chromium --use-file-for-fake-audio-capture flag');

test('score increments when A4 WAV is injected and game starts with A major', async () => {
  const { context, closeBrowser } = await injectAudioFile(
    path.join('tests', 'e2e', 'fixtures', 'audio', 'A4_440hz.wav')
  );

  await context.route('**/game/session-config**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SESSION_CONFIG_FIXTURE),
    })
  );

  const page = await context.newPage();
  await page.addInitScript(() => { (window as any).__TEST_MODE = true; });

  try {
    // Navigate via hub
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
      () => (window as any).__gameState?.session?.phase === 'playing',
      { timeout: 10000 }
    );

    await page.waitForFunction(
      () => (window as any).__gameState?.lastDetectedNote === 'A4',
      { timeout: 5000 }
    );

    await page.waitForFunction(
      () => ((window as any).__gameState?.score?.current ?? 0) > 0,
      { timeout: 20000 }
    );

    const score = await page.evaluate(() => (window as any).__gameState?.score?.current);
    expect(score).toBeGreaterThan(0);
  } finally {
    await closeBrowser();
  }
}, { timeout: 40000 });
