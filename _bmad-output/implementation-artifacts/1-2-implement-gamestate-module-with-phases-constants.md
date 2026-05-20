# Story 1.2: Implement GameState Module with PHASES Constants

**Status:** review
**Epic:** 1 — Foundation & Session Setup
**Story ID:** 1.2
**Story Key:** 1-2-implement-gamestate-module-with-phases-constants

---

## User Story

As a developer,
I want a structured GameState module that exports the canonical state object and PHASES constants,
So that all game modules share a single authoritative state shape and phase transitions are made safely without string literals.

---

## Acceptance Criteria

**AC-1 — GameState object export:**
- `static/game/GameState.js` exports an object named `GameState` (not a class)
- Shape is exactly: `{ session: { scale, rootMidi, difficulty, instrument }, runtime: { score, speed, phase, currentNote }, scene: { carts: [], tracks: [], character: {} } }`
- All properties are present at initialization (not lazy-created)
- `GameState.runtime.phase` initializes to the value of `PHASES.IDLE` (not the string 'idle')

**AC-2 — PHASES constants:**
- `static/game/GameState.js` exports an object named `PHASES`
- Exact structure: `{ IDLE: 'idle', PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'game_over', RESTARTING: 'restarting' }`
- Constant values are lowercased strings (no hyphens)
- All game modules import PHASES and use `PHASES.STATE` not string literals

**AC-3 — Tests validate shape & exports:**
- `tests/unit/js/GameState.test.js` (ATDD scaffold exists, currently all it.skip()) runs
- Tests validate initial state shape matches exactly
- Tests validate PHASES object has exactly 5 properties with correct values
- Tests validate module exports (GameState object + PHASES object both present)
- All tests pass (0 failures, skipped tests ≠ failures)

**AC-4 — No breaking changes:**
- Story 1.1 renamed `runState.js` → `GameState.js`, preserving the `Run` class and `difficultyToTimePerNoteMs()` function
- Those exports MUST remain accessible (existing main.js imports from GameState.js for `Run` and `difficultyToTimePerNoteMs`)
- New `GameState` object and `PHASES` export alongside them, not replacing them
- Existing `Run` tests (runState.test.js → GameState.test.js) continue to pass

---

## Developer Context

### What This Story Does

This story transforms `GameState.js` from a simple module rename (keeping old `Run` class + utilities) into a **dual-purpose module**:
1. **Keeps:** Existing `Run` class + `difficultyToTimePerNoteMs()` (used by main.js, tested by grid.test.js)
2. **Adds:** New `GameState` object (canonical game state) + `PHASES` object (state machine constants)

This is **not** a rewrite of the `Run` class. Story 1.2 adds the state structure that later stories (GameLoop, CartSystem, etc.) will populate and transition through.

### Why PHASES Matter

The game loop has five phases:
- **IDLE:** Plugin loaded, setup screen showing. No game running.
- **PLAYING:** Game session active, character moving, score incrementing.
- **PAUSED:** Session paused (Escape key), awaiting RESUME.
- **GAME_OVER:** Collision detected or session ended, showing game-over overlay.
- **RESTARTING:** Transitional state between game-over and next session start.

All phase transitions are driven by GameLoop (Story 3.4), but PHASES constants must exist first so:
- GameState can initialize correctly
- Other modules can import them without circular dependencies
- Tests validate the shape before GameLoop uses it

### Key Pattern: State Ownership

Later stories will populate GameState like this:
- **session:** Set by GameLoop at startup (from /game/session-config response)
- **runtime:** Updated by CartSystem (score, speed), AudioDetector (currentNote), GameLoop (phase)
- **scene:** Updated by SceneManager (carts[], tracks[], character{})

Each top-level property is owned by exactly one module. Do NOT pre-populate with data — initialize with empty/default values only. Future stories will fill these in.

### Current RunState.js Content

Story 1.1 renamed `runState.js` → `GameState.js` with content verbatim. Current exports:
```js
// Current GameState.js (from runState.js)
export const DIFF_TABLE = { easy: 4000, medium: 2500, hard: 1500 };
export function difficultyToTimePerNoteMs(difficulty) { ... }
export class Run { ... }
```

**Keep these.** Add the new `GameState` object and `PHASES` alongside them.

### File Locations

- **Implementation:** `static/game/GameState.js` (modify in-place, keep existing Run class)
- **Tests:** `tests/unit/js/GameState.test.js` (ATDD scaffold exists with it.skip())
- **Old tests:** `tests/unit/js/runState.test.js` (import from GameState.js now, continue to pass)

### Existing Test File

`tests/unit/js/GameState.test.js` is an ATDD scaffold created by story 1.1's test generation. It imports `{ GameState, PHASES }` from the module but currently imports from non-existent names. This story makes those imports resolve correctly by exporting them.

### Architecture Ownership Reference

From the project context and architecture doc:
- **GameState.runtime.phase:** Owned by GameLoop (Story 3.4). GameLoop writes phase transitions. All modules read-only.
- **GameState.runtime.score, GameState.runtime.speed:** Owned by CartSystem (Story 2.2). GameLoop reads for speed checks, SceneManager reads for visual feedback.
- **GameState.session:** Owned by GameLoop at startup. Read-only to all other modules.
- **GameState.scene:** Owned by SceneManager (Story 3.1). Populated with cart/track/character objects. CartSystem reads to check collisions. GameLoop reads for game-over condition.

This story doesn't populate these — it just defines the canonical shape.

### No Game Loop Wiring

Do NOT wire PHASES to GameLoop in this story. That's Story 3.4. Just define the constants and initial state shape. Later stories will wire transitions.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `static/game/GameState.js` | MODIFY | Add GameState object + PHASES export alongside existing Run class |
| `tests/unit/js/GameState.test.js` | ENABLE | Un-skip ATDD scaffold tests; they should pass with the new exports |
| `tests/unit/js/runState.test.js` | NO CHANGE | Continues to pass (imports from GameState.js); Run class still exists |

---

## State Object Template

```js
export const GameState = {
  session: {
    scale: null,        // scale_id from /game/session-config
    rootMidi: null,     // root MIDI value (21-108)
    difficulty: null,   // 'easy' | 'medium' | 'hard'
    instrument: null,   // { id, name, tuning, ... }
  },
  runtime: {
    score: 0,
    speed: 1.0,
    phase: null,        // Will be set to PHASES.IDLE after PHASES exported
    currentNote: null,  // { midi, name, confidence, centsOffset } or null
  },
  scene: {
    carts: [],          // Array of cart objects (populated by CartSystem)
    tracks: [],         // Array of track objects (populated by SceneManager)
    character: {},      // Character position/state (populated by SceneManager)
  },
};
```

After defining GameState, set:
```js
GameState.runtime.phase = PHASES.IDLE;
```

---

## PHASES Template

```js
export const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};
```

No methods, no aliases. Just five constants mapping to strings. This is the single source of truth — all game modules import this object, not magic strings.

---

## Test Requirements (Red-Green-Refactor)

### Red Phase (Write Failing Tests)

The ATDD scaffold `tests/unit/js/GameState.test.js` already exists. It contains test cases like:
- ✓ "exports GameState object"
- ✓ "GameState.runtime.phase is PHASES.IDLE"
- ✓ "GameState.session has scale, rootMidi, difficulty, instrument"
- ✓ "GameState.runtime has score, speed, phase, currentNote"
- ✓ "GameState.scene has carts, tracks, character"
- ✓ "PHASES exports { IDLE, PLAYING, PAUSED, GAME_OVER, RESTARTING }"
- ✓ "PHASES.IDLE === 'idle'"

Currently these are all `it.skip()`. Before implementation, un-skip them. They will FAIL because GameState object doesn't exist yet.

### Green Phase (Implement to Pass Tests)

Add the GameState object and PHASES constants. Tests pass.

### Refactor Phase

No refactoring needed — shape is mandated by story ACs.

---

## Definition of Done

- [x] GameState object exported from `static/game/GameState.js` with exact shape (session, runtime, scene)
- [x] GameState.runtime.phase initialized to `PHASES.IDLE`
- [x] PHASES object exported with exactly 5 constants (IDLE, PLAYING, PAUSED, GAME_OVER, RESTARTING)
- [x] Existing Run class + difficultyToTimePerNoteMs() remain (no breaking changes)
- [x] `tests/unit/js/GameState.test.js` tests un-skipped and all pass
- [x] `tests/unit/js/runState.test.js` (old tests for Run class) continue to pass
- [x] No import errors or circular dependencies
- [x] `rtk vitest` runs with 0 new failures

---

## Dev Agent Record

### Implementation Plan

Straightforward addition of two exports to existing GameState.js (was runState.js from story 1.1):
1. Export `PHASES` object with 5 constants (IDLE, PLAYING, PAUSED, GAME_OVER, RESTARTING)
2. Export `GameState` object with canonical shape: { session, runtime, scene }
3. Initialize `GameState.runtime.phase` to `PHASES.IDLE` (not string literal)
4. Preserve existing `Run` class and `difficultyToTimePerNoteMs()` for backward compatibility
5. Un-skip ATDD test scaffolds that were already in place from Story 1.1

### Completion Notes

✅ Implemented 2026-05-21. All ACs satisfied:
- AC-1: GameState object exported with exact shape (session, runtime, scene) ✓
- AC-2: PHASES constants exported { IDLE, PLAYING, PAUSED, GAME_OVER, RESTARTING } ✓
- AC-3: 15 ATDD tests un-skipped and all pass ✓
- AC-4: Run class + difficultyToTimePerNoteMs() continue to export without changes ✓

Test results: 135 pass, 2 pre-existing failures (SafeZoneRenderer Z-positioning — story 1.1 legacy). Zero new failures from this story.

---

## File List

- `static/game/GameState.js` (modified) — added PHASES export + GameState export at top
- `tests/unit/js/GameState.test.js` (modified) — un-skipped 15 ATDD test cases

---

## Change Log

- 2026-05-21: Story created. GameState + PHASES constants scaffolded per epic requirements.
- 2026-05-21: Implementation complete. PHASES constants + GameState object exported. Tests pass (135 pass, 2 pre-existing failures).
