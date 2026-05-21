# Story 2.3: Implement DifficultyManager Module

Status: done

**Epic:** 2 — Game Engine Migration
**Story ID:** 2.3
**Story Key:** 2-3-implement-difficultymanager-module

---

## Story

As a developer,
I want a `DifficultyManager.js` module that owns speed and cart frequency scaling,
so that difficulty progression is isolated, testable, and configurable without touching game loop logic.

---

## Acceptance Criteria

**AC-1 — Initialisation:**
`new DifficultyManager(difficulty, options?)` sets `GameState.runtime.speed` to the difficulty base speed. Easy < Medium < Hard. `DifficultyManager.js` is sole writer to `GameState.runtime.speed`.

**AC-2 — tick(true) increases speed:**
`dm.tick(true, gameState)` multiplies `gameState.runtime.speed` by `1.05` (5% increase — ported from `game_engine.py`).

**AC-3 — tick(false) is no-op:**
`dm.tick(false, gameState)` does NOT change `gameState.runtime.speed`.

**AC-4 — Speed cap enforced:**
`gameState.runtime.speed` never exceeds `dm.speedCap`. Cap differs per difficulty. `dm.speedCap` is a public property.

**AC-5 — Variant offer trigger:**
`dm.onLoopComplete(gameState)` increments internal loop counter. When counter exceeds `dm.variantOfferLoopCount`, fires `options.onVariantOffer(offer)` callback. Offer includes two options: `rootMidi + 5` (RIGHT) and `rootMidi - 2` (LEFT). Both validated to stay in [21, 108].

**AC-6 — Variant offer interval by difficulty:**
`dm.variantOfferLoopCount` is smaller for hard than easy (more frequent offers on hard). Mirrors Python `OCTAVES_PER_VARIANT = 2` as the medium/default baseline.

**AC-7 — Window expired resets loop:**
`dm.onDecisionWindowExpired(gameState)` resets `dm.loopCount` to 0. No score penalty.

**AC-8 — Tests pass:**
All tests in `tests/unit/js/DifficultyManager.test.js` pass (currently `.skip`'d). Tests cover: init base speeds, tick(true) 5% increase, tick(false) no-op, cap enforcement, variant offer callback, MIDI range validation, timeout reset. Reference `docs/game-engine-analysis.md` for Python parity.

---

## Tasks / Subtasks

- [x] Task 1: Read analysis doc and test scaffold (AC: all)
  - [x] Read `docs/game-engine-analysis.md` — required before writing code
  - [x] Read `tests/unit/js/DifficultyManager.test.js` fully — defines API contract
  - [x] Note: test expects `dm.baseSpeed`, `dm.speedCap`, `dm.variantOfferLoopCount`, `dm.loopCount` as public props
- [x] Task 2: Create `static/game/DifficultyManager.js` (AC: 1–7)
  - [x] Export named class: `export class DifficultyManager`
  - [x] Constructor: `constructor(difficulty, options = {})`
  - [x] `options.onVariantOffer` — callback for variant trigger
- [x] Task 3: Implement init / base speeds (AC: 1)
  - [x] Define `BASE_SPEED` constants per difficulty (easy < medium < hard)
  - [x] Define `SPEED_CAP` constants per difficulty
  - [x] `init(gameState)` sets `gameState.runtime.speed = this.baseSpeed`
  - [x] Expose `this.baseSpeed` and `this.speedCap` as public properties
- [x] Task 4: Implement tick() (AC: 2, 3, 4)
  - [x] `tick(noteDetected, gameState)`:
    - [x] If noteDetected: `gameState.runtime.speed = Math.min(gameState.runtime.speed * 1.05, this.speedCap)`
    - [x] If !noteDetected: no-op
- [x] Task 5: Implement octave loop tracking (AC: 5, 6)
  - [x] `this.loopCount = 0` initialised in constructor
  - [x] `onLoopComplete(gameState)`: increment `this.loopCount`; if `this.loopCount > this.variantOfferLoopCount`: fire offer callback and reset `this.loopCount = 0`
  - [x] `variantOfferLoopCount`: easy=3, medium=2, hard=1 (hard=more frequent)
- [x] Task 6: Implement variant offer callback (AC: 5)
  - [x] Build offer object: `{ options: [{ rootMidi: root+5, side: 'RIGHT' }, { rootMidi: root-2, side: 'LEFT' }] }`
  - [x] Validate each option: if outside [21, 108], replace with in-range alternative (flip to other direction or clamp)
  - [x] Fire `this._onVariantOffer(offer)` if callback provided
- [x] Task 7: Implement window timeout reset (AC: 7)
  - [x] `onDecisionWindowExpired(gameState)`: `this.loopCount = 0`. No score change.
- [x] Task 8: Un-skip and green all DifficultyManager tests (AC: 8)
  - [x] Remove `.skip` from each `it.skip()` in `tests/unit/js/DifficultyManager.test.js`
  - [x] Run `npm test` — all DifficultyManager tests must pass
  - [x] Do NOT reduce existing 93-test pass count

### Review Findings

- [x] [Review][Defer] AC-1 says constructor sets `gameState.runtime.speed`, but implementation requires separate `init(gameState)` call per Dev Notes API spec; callers who skip `init()` get stale speed [`static/game/DifficultyManager.js:17-19`] — deferred, AC-1 ambiguous; Dev Notes API spec takes precedence

---

## Dev Notes

### CRITICAL: Read analysis doc first

`docs/game-engine-analysis.md` (Story 2.1) must be read before coding. It maps Python `game_engine.py` constants and logic to JS equivalents. Skipping causes divergence from game_engine.py parity.

### File locations

| File | Action | Notes |
|------|--------|-------|
| `static/game/DifficultyManager.js` | CREATE | Named export: `export class DifficultyManager` |
| `tests/unit/js/DifficultyManager.test.js` | MODIFY | Un-skip tests only |

No other files touched.

### Expected DifficultyManager API (from test scaffold)

```js
import { DifficultyManager } from '../../../static/game/DifficultyManager.js';

// Constructor
const dm = new DifficultyManager('medium');
const dm = new DifficultyManager('medium', { onVariantOffer: fn });

// Public properties (tests access these directly)
dm.baseSpeed          // Number — base speed for this difficulty
dm.speedCap           // Number — max speed allowed
dm.variantOfferLoopCount  // Number — loops before variant fires
dm.loopCount          // Number — current loop counter

// Methods
dm.tick(noteDetected, gameState)      // per-frame
dm.init(gameState)                    // set initial speed on GameState
dm.onLoopComplete(gameState)          // call when note index wraps to 0
dm.onDecisionWindowExpired(gameState) // call when variant window times out
```

### Speed constants (JS, not Python px/ms)

Python duration_map (4000/2500/1500ms) gives relative ordering only — the actual px/ms values are backend coordinate system. JS uses its own units (units/second for rAF).

Recommended JS constants (dev agent may adjust if tests require different values):

```js
const BASE_SPEED = { easy: 10, medium: 16, hard: 25 };   // units/s
const SPEED_CAP  = { easy: 25, medium: 50, hard: 80 };   // units/s
```

Invariant the tests enforce: `easy.baseSpeed < medium.baseSpeed < hard.baseSpeed`. Tests do NOT hardcode specific values — they only compare relative ordering. Pick values that satisfy this.

### Speed multiplier: exact port from Python

```python
session.speed_multiplier *= 1.05  # game_engine.py line 197
```

JS equivalent (with cap):

```js
tick(noteDetected, gameState) {
  if (!noteDetected) return;
  gameState.runtime.speed = Math.min(
    gameState.runtime.speed * 1.05,
    this.speedCap
  );
}
```

### Variant offer: exact port from Python

```python
OCTAVES_PER_VARIANT = 2     # baseline (medium)
VARIANT_SHIFT_UP = 5        # +5 semitones = RIGHT
VARIANT_SHIFT_DOWN = 2      # -2 semitones = LEFT
```

JS offer validation — MIDI range [21, 108]:

```js
_buildOffer(rootMidi) {
  let upMidi = rootMidi + 5;
  let downMidi = rootMidi - 2;
  // Replace out-of-range with opposite direction (fallback: clamp)
  if (upMidi > 108) upMidi = rootMidi - 2;   // use down if up invalid
  if (downMidi < 21) downMidi = rootMidi + 5; // use up if down invalid
  return {
    options: [
      { rootMidi: upMidi, side: 'RIGHT' },
      { rootMidi: downMidi, side: 'LEFT' },
    ]
  };
}
```

If both out-of-range: still fire callback with clamped values — Epic 5 handles gracefully.

### Variant offer frequency by difficulty

```js
const VARIANT_OFFER_LOOP_COUNT = { easy: 3, medium: 2, hard: 1 };
```

Test enforces: `dmHard.variantOfferLoopCount < dmEasy.variantOfferLoopCount`.

### Octave loop detection: NOT DifficultyManager's job

DifficultyManager does NOT detect loops internally. GameLoop.js calls `dm.onLoopComplete(gameState)` when it detects that `GameState.runtime.currentNote` has wrapped from the last note back to the root. DifficultyManager just counts and fires.

### Sole writer contract for runtime.speed

From architecture:

| Sub-object | Owner (writes) |
|---|---|
| `runtime.speed` | `DifficultyManager.js` |

CartSystem reads `gameState.runtime.speed` but never writes it. DifficultyManager never writes `runtime.score` or `scene.carts`.

### Architecture compliance

- No PHASES import needed (DifficultyManager doesn't set phase)
- No PHASES string literals
- Does NOT write to: `GameState.runtime.score`, `GameState.scene.*`, `GameState.session.*`
- Writes ONLY: `GameState.runtime.speed`
- Tests in `tests/unit/js/` — correct location already

### Testing framework

Vitest. Test file: `tests/unit/js/DifficultyManager.test.js`. All tests `.skip`'d. Un-skip; make green.

The test file also includes Story 5.1 variant offer tests (bottom block `describe('DifficultyManager — variant offer (Story 5.1)')`). These should also be un-skipped and made green in this story since the variant offer API is part of this module.

### Previous story learnings

- Epic 1 test count: 93 passed, 0 failed — do not reduce this
- `npm test` is the test runner; vitest configured in `vitest.config.js` at project root
- Test files in `tests/unit/js/` not `static/game/tests/` (confirmed correct in architecture)

### Do NOT touch

- `services/game_engine.py` — read-only reference
- `CartSystem.js` — Story 2.2's responsibility
- Any test files other than `DifficultyManager.test.js`
- `GameState.js`, `main.js`, or any other existing module

### References

- `docs/game-engine-analysis.md` — Story 2.1 output (required reading)
- `services/game_engine.py` — speed multiplier (line 197), variant constants (lines 19–26), difficulty map (lines 130, 257)
- `tests/unit/js/DifficultyManager.test.js` — API contract, test cases
- `_bmad-output/planning-artifacts/architecture.md` — "Module Ownership of GameState", "Phase Transitions"
- `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.3 ACs; Epic 5, Story 5.1 ACs

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Read `docs/game-engine-analysis.md` and `tests/unit/js/DifficultyManager.test.js` before coding
- Speed cap values in story dev notes (easy=25, medium=50, hard=80) are too low for tick test — test starts speed=100 for medium, expects 105. Used easy=100, medium=200, hard=400 instead
- `variantOfferLoopCount`: easy=3, medium=2, hard=1; trigger fires when loopCount > variantOfferLoopCount (needs +1 calls to fire)
- Variant offer MIDI range enforcement: if upMidi>108 → use downMidi; if downMidi<21 → use upMidi
- All 14 DifficultyManager tests pass (114 total, up from 100; 43 skipped, down from 57)
- 6 pre-existing failing suites (Story 1-8 UI stubs + SceneManager) unaffected

### File List

- `static/game/DifficultyManager.js` (created)
- `tests/unit/js/DifficultyManager.test.js` (modified — un-skipped all tests)

### Change Log

- 2026-05-21: Implemented DifficultyManager.js with base speeds, speed cap, tick, loop tracking, variant offer; un-skipped 14 DifficultyManager tests; all pass
