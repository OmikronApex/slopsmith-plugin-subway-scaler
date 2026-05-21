# Story 0.2a: Fake Microphone Device

Status: review

## Story

As a developer,
I want the Playwright test suite to launch Chromium with a fake microphone device that auto-grants mic permission,
so that the plugin's `getUserMedia` call succeeds in test context without requiring real hardware or a permission dialog.

## Acceptance Criteria

1. The Chromium project in `playwright.config.ts` is updated with `launchOptions.args` containing `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`.
2. A Playwright test `tests/e2e/specs/mic-access.spec.ts` passes confirming that `navigator.mediaDevices.getUserMedia({ audio: true })` resolves without throwing (the plugin receives a non-null `MediaStream`).
3. `window.__audioState.micActive` becomes `true` within 3000ms of page load (verified in the same test).
4. `window.__audioState.pipelineReady` becomes `true` within 5000ms of page load (Web Audio pipeline fully initialized).
5. `window.__audioState.streamType` equals `'fake'` when the Chromium fake device is active.
6. All tests in `tests/e2e/specs/mic-access.spec.ts` are skipped on non-Chromium browser projects with: `test.skip(browserName !== 'chromium', 'mic mock requires Chromium fake device flag')`.
7. The `window.__audioState` interface is defined and writable by the plugin code (see Dev Notes for required shape).

## Tasks / Subtasks

- [x] Task 1 — Update `playwright.config.ts` Chromium project (AC: 1)
  - [x] Add `launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }` to the Chromium project entry
  - [x] Confirm the smoke test from story 0-2 still passes after this change

- [x] Task 2 — Expose `window.__audioState` from plugin code (AC: 3, 4, 5, 7)
  - [x] In the plugin's audio initialization path (where `getUserMedia` is called and `AudioContext` is created), write to `window.__audioState`:
    - Set `micActive = true` immediately after `getUserMedia` resolves
    - Set `pipelineReady = true` after `AudioContext` and processing nodes are initialized
    - Set `streamType = 'fake'` if the stream is from the Chromium fake device (detect via `stream.getTracks()[0].label` containing `'fake'` or `'Mock'`), else `'real'`
  - [x] Initialize `window.__audioState` with all fields set to defaults (`false`, `null`, `0`) before `getUserMedia` is called, so tests can poll immediately on page load

- [x] Task 3 — Write mic-access spec (AC: 2, 3, 4, 5, 6)
  - [x] Create `tests/e2e/specs/mic-access.spec.ts`
  - [x] Use `test.skip` guard for non-Chromium (see AC-6)
  - [x] Call `page.evaluate` to invoke `getUserMedia` directly as a secondary check
  - [x] Use `page.waitForFunction` to poll `window.__audioState.micActive` and `pipelineReady`
  - [x] Assert `window.__audioState.streamType === 'fake'`

## Dev Notes

### This Story Is Chromium-Only — By Design

The fake device flags are Chromium-specific. Firefox uses `media.navigator.streams.fake` via `firefoxUserPrefs`, which is a separate concern deferred to a future story if cross-browser audio testing is needed. For now: Chromium is the canonical E2E browser for audio-dependent tests. Document this in the spec file with a comment.

### `window.__audioState` Required Shape

The plugin code (wherever `getUserMedia` and `AudioContext` are initialized — likely `AudioDetector.js`) must write this interface to `window`:

```ts
window.__audioState = {
  micActive: boolean,          // true after getUserMedia resolves
  pipelineReady: boolean,      // true after AudioContext + nodes initialized
  lastDetectedNote: string | null,  // e.g. "A4" — written by pitch detection loop
  detectionConfidence: number, // 0.0–1.0
  streamType: 'real' | 'fake' | 'injected' | null  // null before init
}
```

Initialize all fields to defaults before `getUserMedia` is called:
```js
window.__audioState = {
  micActive: false, pipelineReady: false,
  lastDetectedNote: null, detectionConfidence: 0, streamType: null
};
```

**Note:** `lastDetectedNote` is defined here but is written to by the pitch detection loop (YinDetector). This story only sets `micActive`, `pipelineReady`, and `streamType`. The `lastDetectedNote` field will be exercised in story 0-2b.

### Where the Plugin Calls getUserMedia

From `architecture.md`: audio detection uses `YinDetector extends AudioDetector` in `static/game/AudioDetector.js`. The `getUserMedia` call and `AudioContext` initialization are inside this module. That is where `window.__audioState` must be written.

### Detecting Fake vs Real Stream

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const trackLabel = stream.getAudioTracks()[0]?.label ?? '';
window.__audioState.streamType = trackLabel.toLowerCase().includes('fake')
  ? 'fake' : 'real';
window.__audioState.micActive = true;
```

Chromium's fake device label is typically `'fake_device_for_media_stream'`. This check is reliable.

### Not in Scope

- Story 0-2a does NOT test `lastDetectedNote` — that is story 0-2b (requires 0-5 first)
- Story 0-2a does NOT inject specific pitches — the fake stream is a Chromium-generated tone, used only to prove the pipeline initializes
- Story 0-2a does NOT add Firefox or Safari mic support

### waitForFunction Pattern

```ts
await page.waitForFunction(
  () => (window as any).__audioState?.pipelineReady === true,
  { timeout: 5000 }
);
```

### References

- [Source: epics.md#NFR-E2E-002]
- [Source: architecture.md#Audio Detection — Pluggable JS Adapter]
- [Roundtable decision: 0-2a = mic unblocked only; 0-2b = note injection]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- AudioContext suspended in headless Chromium — fixed by adding `--autoplay-policy=no-user-gesture-required` to launchOptions.args
- `menu.style.display = 'none'` (inline) conflicted with `classList.remove('hidden')` — fixed in main.js + added `.menu.hidden { display: none; }` to styles.css
- Playwright strict mode violation on "Audio Settings" — fixed to `getByRole('button', { name: 'Audio Settings' })`
- Plugins nav: element existed in hidden mobile nav — fixed to click Plugins dropdown first

### Completion Notes List

- All 5 E2E tests pass (smoke + 4 mic-access) in headless Chromium
- `window.__audioState` initialized in both `bootstrap()` (main.js) and `startAudio()` (AudioDetector.js)
- `streamType` detection uses `getAudioTracks()[0].label.toLowerCase().includes('fake')` — reliable for Chromium fake device
- Discovered and fixed root bug: game menu hidden via inline style but shown via class removal — changed to class-based toggle throughout
- Added `--autoplay-policy=no-user-gesture-required` to unblock AudioWorklet in headless Chromium

### File List

- `playwright.config.ts` — UPDATED (fake mic flags + autoplay policy arg)
- `static/game/AudioDetector.js` — UPDATED (window.__audioState micActive/pipelineReady/streamType)
- `static/game/main.js` — UPDATED (window.__audioState defaults in bootstrap; menu.classList.add('hidden') bug fix)
- `static/styles.css` — UPDATED (added .subway-scaler .menu.hidden { display: none; })
- `tests/e2e/specs/mic-access.spec.ts` — NEW

### Change Log

- 2026-05-21: Implemented story 0-2a — fake mic device flags, window.__audioState interface, mic-access E2E spec. Fixed game menu visibility bug (inline style vs class toggle). All 5 tests pass.
