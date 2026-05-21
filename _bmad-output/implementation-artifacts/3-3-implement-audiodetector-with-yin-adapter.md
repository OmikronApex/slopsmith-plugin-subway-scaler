# Story 3.3: Implement AudioDetector with YIN Adapter

Status: review

**Epic:** 3 — Core Gameplay Loop
**Story ID:** 3.3
**Story Key:** 3-3-implement-audiodetector-with-yin-adapter

---

## Story

As a developer,
I want an `AudioDetector.js` that wraps YIN detection behind a pluggable adapter interface,
so that note detection works now via `YinDetector` and can be swapped for `SlopsmithDetector` with no changes to the game loop.

---

## Acceptance Criteria

**AC-1 — Class hierarchy:**
`AudioDetector.js` exports an `AudioDetector` base class with `async detect()` that throws `NotImplementedError`. `YinDetector extends AudioDetector` wraps the existing `yin.js` / `yin-worklet.js` implementation.

**AC-2 — detect() return shape:**
`YinDetector.detect()` returns `{ midi, confidence }` or throws `AudioDetectorError` on failure.

**AC-3 — No GameState coupling:**
`AudioDetector.js` does NOT import or reference `GameState` directly. It only returns a value — callers write to GameState.

**AC-4 — Error propagation:**
`AudioDetectorError` is thrown (not swallowed) when audio detection fails. `GameLoop.js` (Story 3.4) catches it and handles phase transition.

**AC-5 — Tests pass:**
All 7 tests in `tests/unit/js/AudioDetector.test.js` pass (currently `.skip()`'d). Tests cover: class hierarchy, detect() return shape, AudioDetectorError, no GameState import.

---

## Tasks / Subtasks

- [x] Task 1: Read existing code and test scaffold (AC: all)
  - [x] Read ALL 72 lines of `static/game/AudioDetector.js` — understand existing implementation
  - [x] Read ALL 98 lines of `tests/unit/js/AudioDetector.test.js` — defines exact API contract
  - [x] Read `static/game/yin.js` (first 50 lines) — understand what YIN provides
- [x] Task 2: Create AudioDetectorError class (AC: 4)
  - [x] Export `class AudioDetectorError extends Error` from `AudioDetector.js`
  - [x] Constructor: `super(message); this.name = 'AudioDetectorError'`
- [x] Task 3: Create AudioDetector base class (AC: 1, 3)
  - [x] Export `class AudioDetector` with `async detect() { throw new Error('Not implemented') }`
  - [x] NO import of GameState anywhere in the file
- [x] Task 4: Create YinDetector (AC: 1, 2, 4)
  - [x] `export class YinDetector extends AudioDetector`
  - [x] Wraps existing YIN audio detection logic from current `AudioDetector.js`
  - [x] `async detect()` returns `{ midi: Number, confidence: Number }`
  - [x] On failure: throws `AudioDetectorError` (never swallows)
  - [x] Existing audio device enumeration/switching logic may remain as helper methods
- [x] Task 5: Un-skip and green all AudioDetector tests (AC: 5)
  - [x] Remove `.skip` from all `it.skip()` in `tests/unit/js/AudioDetector.test.js`
  - [x] Run `npm test` — all 7 AudioDetector tests must pass
  - [x] Do NOT reduce existing 114-test pass count

---

## Dev Notes

### File locations

| File | Action |
|------|--------|
| `static/game/AudioDetector.js` | MODIFY — add class hierarchy, keep existing YIN logic |
| `tests/unit/js/AudioDetector.test.js` | MODIFY — un-skip all tests |

### CRITICAL: Keep existing YIN logic intact

The existing 72-line AudioDetector.js has working audio capture + YIN worklet integration. The refactor adds the class hierarchy AROUND it — do not rewrite the YIN detection internals.

Current file structure (approximate):
```js
export function enumerateInputs() { ... }   // list microphones
export function startAudio() { ... }        // AudioContext + worklet setup
// Returns: { onDetection(cb), pause(), resume(), switchInput(), stop() }
```

After refactor:
```js
export class AudioDetectorError extends Error { ... }

export class AudioDetector {
  async detect() { throw new Error('Not implemented') }
}

export class YinDetector extends AudioDetector {
  constructor() { ... } // sets up AudioContext, worklet
  async detect() { ... } // returns { midi, confidence }
}

// Keep existing helpers if needed by YinDetector internals
```

### detect() pattern

The test expects `detect()` to be async and return `{ midi, confidence }`. The existing implementation works via callback (`onDetection(cb)`). The refactor converts this to a Promise:

```js
async detect() {
  return new Promise((resolve, reject) => {
    // Use existing worklet message handler once
    this._workletNode.port.onmessage = (event) => {
      const { frequency, confidence } = event.data;
      if (frequency <= 0) return; // below threshold
      const midi = Math.round(12 * Math.log2(frequency / 440) + 69);
      resolve({ midi, confidence });
    };
  });
}
```

Read the test carefully — it may mock the worklet and verify the return shape.

### Error propagation (architecture requirement)

```js
// CORRECT
async detect() {
  try { return await this._runDetection(); }
  catch (err) { throw new AudioDetectorError(err.message); }
}

// WRONG — never silent swallow
async detect() {
  try { return await this._runDetection(); }
  catch { return null; }
}
```

### No GameState import

```js
// WRONG
import { GameState } from './GameState.js';

// CORRECT — AudioDetector knows nothing about GameState
// GameLoop.js writes: gameState.runtime.currentNote = await detector.detect()
```

### AudioDetectorError

```js
export class AudioDetectorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AudioDetectorError';
  }
}
```

### Test may check constructor name

AudioDetector.test.js likely checks:
- `new YinDetector() instanceof AudioDetector` — class hierarchy
- `result.midi` and `result.confidence` are numbers
- `new AudioDetectorError()` is `instanceof Error` with correct `.name`

### Do NOT touch
- `static/game/yin.js` — keep unchanged
- `static/game/yin-worklet.js` — keep unchanged
- Other test files

### Previous story learnings (Epic 2)
- Read the test scaffold completely before implementing — it defines the authoritative API
- 114 tests must remain passing

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- AudioDetector.test.js had all tests `.skip()`'d; un-skipped all 7

### Completion Notes List
- AC-1: AudioDetector base class + YinDetector extends AudioDetector + AudioDetectorError extends Error all exported from AudioDetector.js
- AC-2: YinDetector.detect() returns { midi, confidence }; throws AudioDetectorError on failure
- AC-3: No GameState import in AudioDetector.js
- AC-4: AudioDetectorError thrown (not swallowed); GameLoop catches it and sets phase=PAUSED
- AC-5: All 7 AudioDetector tests un-skipped and passing

### File List
- static/game/AudioDetector.js (modified — prepended class hierarchy before existing functional code)
- tests/unit/js/AudioDetector.test.js (modified — un-skipped all 7 tests)

### Change Log
- 2026-05-21: Added AudioDetectorError, AudioDetector base class, YinDetector subclass; un-skipped all 7 tests
