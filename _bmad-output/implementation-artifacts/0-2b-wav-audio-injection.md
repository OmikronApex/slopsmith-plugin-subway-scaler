# Story 0.2b: WAV Audio Injection

Status: review

## Story

As a developer,
I want to inject specific pre-rendered audio pitches into the plugin's microphone stream during Playwright tests,
so that note detection can be asserted deterministically without relying on real microphone input.

## Acceptance Criteria

1. Pre-rendered WAV fixture files exist at `tests/e2e/fixtures/audio/`:
   - `silence.wav` — 2s of silence (0 amplitude)
   - `A4_440hz.wav` — 2s loop of 440 Hz sine wave (A4)
   - `C4_261hz.wav` — 2s loop of 261.63 Hz sine wave (C4)
2. A helper `injectAudioFile(context, wavPath)` exists in `tests/e2e/helpers/audioHelper.ts` that creates a new Playwright `BrowserContext` with `--use-file-for-fake-audio-capture=<absolute-path>` and both `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream` set.
3. `injectAudioFile` uses `path.resolve()` to convert `wavPath` to an absolute path — relative paths silently fail with this Chromium flag.
4. A test `tests/e2e/specs/audio-injection.spec.ts` passes:
   - Opens a fresh context via `injectAudioFile(browser, 'tests/e2e/fixtures/audio/A4_440hz.wav')`
   - Waits for `window.__audioState.pipelineReady === true` (max 5s)
   - Asserts `window.__gameState.lastDetectedNote === 'A4'` within 2000ms
5. A test in the same spec file using `silence.wav` asserts `window.__gameState.lastDetectedNote === null` (or stays null) after 2000ms, confirming silence is correctly detected as no note.
6. All tests in this spec are skipped on non-Chromium with `test.skip(browserName !== 'chromium', ...)`.
7. `tests/e2e/fixtures/audio/` is added to version control (WAV files committed — they are small deterministic fixtures).

## Tasks / Subtasks

- [x] Task 1 — Generate WAV fixture files (AC: 1)
  - [x] Use a Node.js script or Python to generate the three WAV files programmatically (pure sine wave, 44100 Hz sample rate, mono, 16-bit PCM)
  - [x] Alternatively, use `sox` if available: `sox -n -r 44100 -c 1 A4_440hz.wav synth 2 sine 440`
  - [x] Commit the generated `.wav` files — they are binary fixtures, not source code
  - [x] Document the generation command in a comment at the top of `audioHelper.ts` so they can be regenerated if needed

- [x] Task 2 — Create `audioHelper.ts` (AC: 2, 3)
  - [x] Create `tests/e2e/helpers/audioHelper.ts`
  - [x] Implement `injectAudioFile(browser: Browser, wavPath: string): Promise<BrowserContext>`
  - [x] Use `path.resolve(process.cwd(), wavPath)` for absolute path resolution
  - [x] Return the new context (caller is responsible for closing it)
  - [x] Include a Chromium-only guard: throw a clear error if browser type is not chromium

- [x] Task 3 — Write audio-injection spec (AC: 4, 5, 6)
  - [x] Create `tests/e2e/specs/audio-injection.spec.ts`
  - [x] For each test: create context via `injectAudioFile`, create page, set `window.__TEST_MODE = true` via `addInitScript`, navigate to `/`
  - [x] Use `page.waitForFunction` to poll `window.__audioState.pipelineReady`
  - [x] Use `page.waitForFunction` to poll `window.__gameState.lastDetectedNote`
  - [x] Close the context in `afterEach` (or use `test.afterEach`)
  - [x] Add `test.skip` guard for non-Chromium

- [x] Task 4 — Update `.gitignore` (AC: 7 reversal)
  - [x] Ensure `tests/e2e/fixtures/audio/` is NOT gitignored (WAV files should be committed)
  - [x] Confirm only `screenshots/` and `results/` remain gitignored in `tests/e2e/`

## Dev Notes

### Hard Dependency on Story 0-5

This story **requires** `window.__gameState.lastDetectedNote` to exist (defined in story 0-5). Do not implement story 0-2b before 0-5 is complete and merged.

Also requires `window.__audioState.pipelineReady` (defined in story 0-2a).

### The `--use-file-for-fake-audio-capture` Flag

This Chromium flag replaces the default fake sine wave with audio data from a WAV file. The file loops for the duration of the test.

Critical: the path must be **absolute**. Relative paths silently produce no audio (the flag is ignored), making `lastDetectedNote` stay `null` — a confusing failure that looks like pitch detection is broken.

```ts
// audioHelper.ts
import { Browser, BrowserContext } from '@playwright/test';
import path from 'path';

export async function injectAudioFile(
  browser: Browser,
  wavPath: string
): Promise<BrowserContext> {
  const absPath = path.resolve(process.cwd(), wavPath);
  return browser.newContext({
    launchOptions: {  // Note: launchOptions on context only works via browserType.launchPersistentContext
      // Use browser-level launch args instead — see note below
    }
  });
}
```

**Important limitation:** `launchOptions.args` cannot be set per-context in Playwright — they are set at browser launch time. To inject a different WAV per test, you must launch a separate browser instance per test, or use `browserType.launch()` with different args each time.

**Recommended approach for per-test WAV injection:**

```ts
// In the test file, use browserType directly
import { chromium } from '@playwright/test';

test('A4 note detected', async () => {
  const browser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.resolve('tests/e2e/fixtures/audio/A4_440hz.wav')}`,
    ],
  });
  const page = await browser.newPage();
  await page.addInitScript(() => { (window as any).__TEST_MODE = true; });
  await page.goto('http://localhost:8000');
  await page.waitForFunction(() => (window as any).__audioState?.pipelineReady, { timeout: 5000 });
  await page.waitForFunction(
    () => (window as any).__gameState?.lastDetectedNote === 'A4',
    { timeout: 2000 }
  );
  await browser.close();
});
```

This means each WAV-injection test launches its own browser instance. This is intentional and expected — document it in the spec.

### WAV File Generation (Python alternative)

If `sox` is unavailable, generate with Python:

```python
import wave, struct, math

def write_sine_wav(path, freq, duration=2.0, sample_rate=44100):
    with wave.open(path, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        for i in range(int(sample_rate * duration)):
            val = int(32767 * math.sin(2 * math.pi * freq * i / sample_rate))
            f.writeframes(struct.pack('<h', val))

write_sine_wav('tests/e2e/fixtures/audio/A4_440hz.wav', 440)
write_sine_wav('tests/e2e/fixtures/audio/C4_261hz.wav', 261.63)
write_sine_wav('tests/e2e/fixtures/audio/silence.wav', 0)
```

Run this once with `.venv/Scripts/python.exe` — output files are committed.

### Note Detection Tolerance

The YIN algorithm in `AudioDetector.js` may not detect 440 Hz as exactly `'A4'` every frame due to FFT windowing. The `waitForFunction` polling window (2000ms) should be sufficient for stable detection. If the test is flaky, increase to 3000ms before concluding there is a detection bug.

### References

- [Source: epics.md#FR-E2E-007]
- [Source: architecture.md#Audio Detection — Pluggable JS Adapter]
- [Roundtable: Amelia's 0-2b scope definition; Murat's absolute path warning]
- [Story 0-2a: window.__audioState.pipelineReady definition]
- [Story 0-5: window.__gameState.lastDetectedNote definition]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `launchOptions.args` cannot be set per-context — each WAV test launches its own `chromium.launch()` instance. `injectAudioFile` returns `{ context, closeBrowser }` instead of just a context.

### Completion Notes List

- WAV files generated via Python `wave` module (44100 Hz, mono, 16-bit PCM). Generation command documented in `audioHelper.ts` header comment.
- `injectAudioFile` uses `chromium.launch()` (not `browser.newContext`) because `--use-file-for-fake-audio-capture` is a browser-level arg.
- Absolute path via `path.resolve(process.cwd(), wavPath)` — relative paths silently produce no audio.
- A4 test: waits for `pipelineReady`, then polls `lastDetectedNote === 'A4'` within 2000ms.
- Silence test: waits for `pipelineReady`, waits 2000ms, asserts `lastDetectedNote === null`.
- All 10 E2E tests pass (2 new audio-injection + 8 existing).

### File List

- `tests/e2e/fixtures/audio/A4_440hz.wav` — NEW (generated)
- `tests/e2e/fixtures/audio/C4_261hz.wav` — NEW (generated)
- `tests/e2e/fixtures/audio/silence.wav` — NEW (generated)
- `tests/e2e/helpers/audioHelper.ts` — NEW
- `tests/e2e/specs/audio-injection.spec.ts` — NEW

### Change Log

- 2026-05-21: Implemented story 0-2b — WAV fixtures, audioHelper, audio-injection spec. All 10 E2E tests pass.
