// WAV fixtures generated with Python (wave + math.sin, 44100 Hz, mono, 16-bit PCM):
//   python -c "import wave,struct,math; ..."
// Regenerate: see _bmad-output/implementation-artifacts/0-2b-wav-audio-injection.md Dev Notes
import { chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

// Launches a fresh Chromium browser with --use-file-for-fake-audio-capture pointing at wavPath.
// launchOptions.args cannot be set per-context; a separate browser instance is required per WAV file.
// Caller is responsible for closing the returned context (and its browser).
export async function injectAudioFile(wavPath: string): Promise<{ context: BrowserContext; closeBrowser: () => Promise<void> }> {
  const absPath = path.resolve(process.cwd(), wavPath);
  const browser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      `--use-file-for-fake-audio-capture=${absPath}`,
    ],
  });
  const context = await browser.newContext();
  return { context, closeBrowser: () => browser.close() };
}
