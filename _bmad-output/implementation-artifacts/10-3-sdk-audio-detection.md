# Story 10.3: SDK Audio Detection via createContinuous()

Status: review

## Story

As the **game engine**,
I want to use the SDK's built-in YIN pitch tracker (`scoring.createContinuous()`) as the primary audio source,
So that pitch detection comes from a shared SDK component rather than the game's own `yin.js`.

## Acceptance Criteria

1. **SDK pitch tracker starts** — When `start()` is called and session begins, `sdk.scoring.createContinuous({ expectedBaseFreqHz, smoothingMs })` is invoked. `expectedBaseFreqHz = 440 * 2^((rootMidi - 69) / 12)`. `smoothingMs` defaults to 30.

2. **Pitch events converted** — `'pitch'` event `{freqHz, midiFloat, cents, confidence, tMs}` → `{midi: Math.round(midiFloat) in [21,108], confidence, cents, tMs}` → passed to `GameLoop` via `runtime.currentNote`.

3. **Fallback on failure** — If `createContinuous()` throws/rejects → log warning → use existing `YinDetector` (wrapping `yin.js`/`yin-worklet.js`). Gameplay continues.

4. **Low confidence = silence** — Confidence < 0.3 → treat as silence, no note detection fires.

5. **Cleanup** — On quit/stop → `handle.stop()` releases `getUserMedia` stream, closes AudioContext.

6. **Inert without SDK** — No session → no audio detection initialized.

## Tasks / Subtasks

- [x] Add `startPitchDetection(rootMidi)` to `SdkBridge.js` (AC: #1)
  - [x] Compute `expectedBaseFreqHz` from root MIDI
  - [x] Call `sdk.scoring.createContinuous({ expectedBaseFreqHz, smoothingMs: 30 })`
  - [x] Register `'pitch'` event handler
- [x] Implement `SdkDetector` class implementing `AudioDetector` interface (AC: #2)
  - [x] Buffer latest event; `detect()` returns it synchronously
  - [x] Convert pitch event fields to existing shape
- [x] Add `stopPitchDetection()` to `SdkBridge.js` (AC: #5)
  - [x] Call `handle.stop()` on the continuous tracker
- [x] Implement fallback chain (AC: #3)
  - [x] Try SDK tracker first; catch → log → use `YinDetector`
- [x] Tests (AC: #1-#6)

## Dev Notes

### Architecture Compliance

- `SdkDetector` must implement the existing `AudioDetector` adapter interface from Architecture doc: `async detect()` returning `{midi, confidence, cents, tMs}` or `null`
- SDK emits events asynchronously via `on('pitch', cb)` — `SdkDetector` stores latest event, `detect()` returns it synchronously, matching existing pattern where `run.onDetection()` reads the latest audio frame
- The SDK's `createContinuous` handles its own `getUserMedia` + AudioContext via `ScriptProcessor` → no double-initialization risk
- Do NOT modify `yin.js` or `yin-worklet.js` — they remain as fallback only

### expectedBaseFreqHz Computation

```js
const expectedBaseFreqHz = 440 * Math.pow(2, (rootMidi - 69) / 12);
// rootMidi = 60 → 261.63 Hz (C4)
// rootMidi = 57 → 220.0 Hz (A3)
```

### SDK createContinuous Interface

From `slopsmith-plugin-minigames/screen.js`:
```js
const handle = sdk.scoring.createContinuous({ expectedBaseFreqHz, smoothingMs });
handle.on('pitch', ({freqHz, midiFloat, cents, confidence, tMs}) => { ... });
handle.stop();  // releases mic, closes AudioContext
```

Pitch events fire at ~60Hz (every audio callback). Energy gate at -60dBFS RMS = 0.001. Confidence fades at 0.85× per frame when no signal.

### Files to Touch

| File | Action |
|---|---|
| `static/game/SdkBridge.js` | UPDATE — add `startPitchDetection()`, `stopPitchDetection()`, `SdkDetector` class |
| `static/game/AudioDetector.js` | NO CHANGE — interface stays; `SdkDetector` implements same shape |
| `static/game/yin.js` | NO CHANGE — fallback only |
| `static/game/GameLoop.js` | NO CHANGE — already consumes `runtime.currentNote` |

### Testing

- Vitest with mock SDK's `scoring.createContinuous()`: emit fake pitch events, verify `{midi, confidence, cents, tMs}` shape
- Vitest: mock throws → verify fallback to `YinDetector` called
- Vitest: mock confidence < 0.3 → verify no detection fires
- Vitest: verify `handle.stop()` called on cleanup

### References

- [Source: epics.md § Epic 10 — Story 10-3]
- [Source: slopsmith-plugin-minigames/screen.js lines 94-261 (createContinuous implementation)]
- [Source: Architecture doc § AudioDetector adapter pattern]
- [Source: Architecture doc § State Split — JS-owned timing]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- SdkDetector class buffers latest pitch event, filters confidence<0.3 and MIDI out of [21,108]
- createSdkAudioHandle() adapts SdkDetector's pull API to main.js's push (onDetection callback) model via 16ms polling
- window.__slopsmithSdkBridge.sdkAudioHandle holds the fake handle; main.js checks this before startAudio()
- fallback: if createContinuous() throws, logs warning and main.js falls back to YinDetector via startAudio()
- stopPitchDetection() calls handle.stop() and clears both sdkDetector and sdkAudioHandle

### File List
- static/game/SdkBridge.js
- static/game/main.js
- tests/unit/js/SdkBridge.test.js

### Change Log
- 2026-05-30: Implemented SDK audio detection via createContinuous() with fallback (Story 10-3)