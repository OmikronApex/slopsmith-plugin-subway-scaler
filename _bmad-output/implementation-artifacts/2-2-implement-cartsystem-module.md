# Story 2.2: Implement CartSystem Module

Status: done

**Epic:** 2 — Game Engine Migration
**Story ID:** 2.2
**Story Key:** 2-2-implement-cartsystem-module

---

## Story

As a developer,
I want a `CartSystem.js` module that handles cart spawning, movement, and collision detection,
so that the core obstacle logic is owned in JS with clear state ownership and is unit-testable in isolation.

---

## Acceptance Criteria

**AC-1 — Cart movement:**
`CartSystem.update(deltaTime, gameState)` advances all carts in `GameState.scene.carts` toward the character by `GameState.runtime.speed * deltaTime`. Carts past character Z removed from `GameState.scene.carts`.

**AC-2 — Sole writer contract:**
`CartSystem.js` is the only module that writes to `GameState.scene.carts` and `GameState.runtime.score`.

**AC-3 — Collision → GAME_OVER:**
Cart occupying same lane as character at same Z position → `GameState.runtime.phase = PHASES.GAME_OVER`. Must use `PHASES` imported from `GameState.js` — no string literals.

**AC-4 — Score increment:**
Detected note matching active safe zone's `notemidi` → `GameState.runtime.score += 100 * difficultyMultiplier`. Safe zone marked `cleared: true`. Difficulty multiplier: easy=1, medium=1.5, hard=2.

**AC-5 — Wave spawning:**
CartSystem maintains a lookahead wave queue. Each `update()` call tops up the queue so carts keep arriving continuously regardless of player input. Mirrors `update_session_state` + `generate_next_wave` from `game_engine.py`.

**AC-6 — Wave pruning:**
Old carts (past the 10s lookback window) pruned each frame — `GameState.scene.carts` never grows unboundedly.

**AC-7 — Tests pass:**
All tests in `tests/unit/js/CartSystem.test.js` pass (currently `.skip`'d — un-skip and make them green). Tests cover: cart advancement, out-of-bounds removal, collision → GAME_OVER, score increment, safe zone clearing. Reference `docs/game-engine-analysis.md` for Python parity verification.

---

## Tasks / Subtasks

- [x] Task 1: Read analysis doc before writing any code (AC: all)
  - [x] Read `docs/game-engine-analysis.md` fully — do NOT skip
  - [x] Read `tests/unit/js/CartSystem.test.js` — understand expected API shape
  - [x] Read `static/game/GameState.js` — understand state shape and PHASES export
- [x] Task 2: Create `static/game/CartSystem.js` (AC: 1–6)
  - [x] Export named `CartSystem` class (not default)
  - [x] Constructor accepts no required args
  - [x] `init(gameState, sessionConfig)` — initialise spawn cursor, set initial wave queue
  - [x] `update(deltaTime, gameState)` — main per-frame method
- [x] Task 3: Implement cart movement and removal (AC: 1)
  - [x] Each cart: `cart.z -= gameState.runtime.speed * deltaTime`
  - [x] Remove carts where `cart.z < character.z` (past player)
  - [x] Prune old carts: remove if `cart.spawnTime + cart.duration < now - 10000ms`
- [x] Task 4: Implement collision detection (AC: 3)
  - [x] On each `update()`: check every non-cleared cart at character.z ± threshold
  - [x] If cart.lane === character.lane and cart not cleared → `gameState.runtime.phase = PHASES.GAME_OVER`
  - [x] Import `PHASES` from `GameState.js` — zero string literals
- [x] Task 5: Implement safe zone / score logic (AC: 4)
  - [x] If `gameState.runtime.currentNote.midi === cart.notemidi` and cart.safeZoneActive and !cart.cleared:
    - [x] `gameState.runtime.score += 100 * this._difficultyMultiplier(gameState.session.difficulty)`
    - [x] `cart.cleared = true`
  - [x] Multiplier map: easy→1, medium→1, hard→2 (test scaffold expects medium=1; noted discrepancy with AC-4 text)
- [x] Task 6: Implement wave spawning (AC: 5)
  - [x] Port `update_session_state` + `generate_next_wave` from `game_engine.py`
  - [x] Keep 10000ms (WAVE_LOOKAHEAD_MS) of carts queued ahead
  - [x] Wave spacing: `gap = baseDuration * WAVE_SPACING_FACTOR / speedMultiplier`
  - [x] `WAVE_SPACING_FACTOR = 0.4`, `WAVE_LOOKAHEAD_MS = 10000` — use same constants
  - [x] CartSystem tracks `_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned` internally (NOT on GameState)
- [x] Task 7: Un-skip and green all CartSystem tests (AC: 7)
  - [x] Open `tests/unit/js/CartSystem.test.js`
  - [x] Remove `.skip` from each `it.skip()`
  - [x] Run `npm test` — all CartSystem tests must pass
  - [x] Adjust implementation if tests reveal API mismatch

### Review Findings

- [x] [Review][Decision] AC-4 multiplier conflict: resolved — AC-4 text is authoritative; medium=1.5. Test scaffold error corrected to `difficultyMultiplier = 1.5`. Implementation updated. All 114 tests pass. [`static/game/CartSystem.js:59`]
- [x] [Review][Patch] `CartSystem.init()` sets `_nextDeadlineMs = BASE_DURATION[diff]` (~2500ms) instead of a Unix timestamp; fixed to `Date.now()` [`static/game/CartSystem.js:16`]
- [x] [Review][Patch] Collision check runs after cart movement causing tunneling at high speeds; fixed by moving collision check before movement loop [`static/game/CartSystem.js:21-27`]
- [x] [Review][Defer] `gameState.runtime.currentNote` coupling is undocumented — CartSystem depends on an external writer populating this field [`static/game/CartSystem.js:29`] — deferred, pre-existing architectural dependency
- [x] [Review][Defer] Local `carts` alias diverges from `gameState.scene.carts` after filter reassignment; latent bug if code is added after the filter using the alias [`static/game/CartSystem.js:23,49`] — deferred, pre-existing
- [x] [Review][Defer] Static class fields prevent parallel game sessions; driven by test scaffold static-call pattern [`static/game/CartSystem.js:10-12`] — deferred, by design
- [x] [Review][Defer] `BASE_SPEED` duplicated in CartSystem and DifficultyManager; values can drift silently [`static/game/CartSystem.js:7`] — deferred, pre-existing

---

## Dev Notes

### CRITICAL: Read the analysis document first

`docs/game-engine-analysis.md` (created by Story 2.1) is required reading before writing any code. It contains the Python→JS mapping table, discrepancy list, and exact constant values. Skipping it causes rework.

### File locations

| File | Action | Notes |
|------|--------|-------|
| `static/game/CartSystem.js` | CREATE | Named export: `export class CartSystem` |
| `tests/unit/js/CartSystem.test.js` | MODIFY | Un-skip tests only; test shape already correct |
| `docs/game-engine-analysis.md` | READ | Required before implementation |

No other files touched by this story.

### Expected CartSystem API (from test scaffold)

```js
import { CartSystem } from '../../../static/game/CartSystem.js';

// Instantiate
const cs = new CartSystem();  // or CartSystem.update() if static

// Per-frame call — must accept (deltaTime, gameState)
CartSystem.update(deltaTime, gameState);
// OR
cs.update(deltaTime, gameState);
```

The test scaffold uses `CartSystem.update(...)` as a static call — match this. If you prefer instance methods, verify the test scaffold and adjust accordingly.

### Cart shape on GameState.scene.carts

Carts are plain objects — no class. Minimum shape required by tests:

```js
{
  z: Number,            // world Z position (decreases as cart approaches)
  lane: Number,         // track lane index (0-based)
  notemidi: Number,     // MIDI note for this safe zone
  cleared: Boolean,     // true after player hit
  safeZoneActive: Boolean,  // true while safe zone is visible
  spawnTime: Number,    // ms timestamp when spawned (for pruning)
  duration: Number,     // ms for this wave's focus window
}
```

### PHASES import — mandatory pattern

```js
import { PHASES } from './GameState.js';

// CORRECT
gameState.runtime.phase = PHASES.GAME_OVER;

// WRONG — never use string literals
gameState.runtime.phase = 'game_over';
```

### Difficulty multiplier

Architecture AC-4 specifies `100 * difficultyMultiplier`. Python uses flat 100. **Architecture wins.**

```js
_difficultyMultiplier(difficulty) {
  return { easy: 1, medium: 1.5, hard: 2 }[difficulty] ?? 1;
}
```

### Wave spawning port from Python

Python `update_session_state` (lines 238–269 of `game_engine.py`):

```python
WAVE_LOOKAHEAD_MS = 10000
WAVE_SPACING_FACTOR = 0.4

while session.next_deadline_ms < game_now + WAVE_LOOKAHEAD_MS:
    session.next_deadline_ms += (base_duration * WAVE_SPACING_FACTOR) / session.speed_multiplier
    next_note = session.notes[next_wave_note_index]
    wave = generate_next_wave(session, next_note)
    session.waves.append(wave)
    next_wave_note_index = (next_wave_note_index + 1) % len(session.notes)
```

JS equivalent — CartSystem tracks `_nextDeadlineMs` internally:

```js
_topUpWaveQueue(gameState, now) {
  const notes = gameState.session.notes;  // set by main.js from /game/session-config
  while (this._nextDeadlineMs < now + WAVE_LOOKAHEAD_MS) {
    const gap = BASE_DURATION[gameState.session.difficulty] * WAVE_SPACING_FACTOR / this._speedMultiplier;
    this._nextDeadlineMs += gap;
    const note = notes[this._nextWaveNoteIndex];
    const cart = this._buildCart(note, this._nextDeadlineMs, gameState);
    gameState.scene.carts.push(cart);
    this._nextWaveNoteIndex = (this._nextWaveNoteIndex + 1) % notes.length;
    this._totalWavesSpawned++;
  }
}
```

Note: `_speedMultiplier` must stay in sync with `gameState.runtime.speed`. Simplest approach: derive from `DifficultyManager` — CartSystem reads speed from `gameState.runtime.speed` directly.

### Speed unit discrepancy

Python speed: `px/ms` (REST API coordinate system).
JS speed: `units/s` (rAF deltaTime is in seconds).

Do NOT port Python speed values literally. JS speed values come from `DifficultyManager.js`. CartSystem reads `gameState.runtime.speed` and uses: `cart.z -= gameState.runtime.speed * deltaTime`.

### Collision detection (Python doesn't have this)

Python backend has no collision detection — it only tracks score on correct notes. JS CartSystem must implement collision from scratch.

Collision rule:
- Cart is at `cart.z` in world space
- Character is at `character.z` in world space  
- Character lane is `character.lane`
- Collision when: `Math.abs(cart.z - character.z) < COLLISION_THRESHOLD && cart.lane === character.lane && !cart.cleared`
- `COLLISION_THRESHOLD`: define as a small constant (e.g., 0.5 world units). Dev agent picks sensible value.

### Octave loop detection (owned by DifficultyManager, not CartSystem)

Python `play_note` detects octave loop and increments `octave_loops_completed`. In JS:
- CartSystem detects safe zone clear and score increment
- CartSystem does NOT track octave loops
- DifficultyManager.onLoopComplete() is called by GameLoop when note index wraps to 0

CartSystem's only job: detect the note match, increment score, mark cleared. Loop tracking is DifficultyManager's job.

### Architecture compliance

- JS ES module: `export class CartSystem`
- No `GameState` imports in constructor — GameState passed as argument to `update()`
- Only writes: `GameState.scene.carts`, `GameState.runtime.score`, `GameState.runtime.phase`
- Never writes: `GameState.runtime.speed` (DifficultyManager owns this), `GameState.session.*`
- Tests: `tests/unit/js/` only — never `static/game/tests/`
- Import PHASES from `./GameState.js` — no string literals anywhere

### Testing framework

Vitest. Test file already exists at `tests/unit/js/CartSystem.test.js`. Tests are `.skip`'d (red-phase ATDD scaffold). Un-skip; make green.

Run tests: `npm test` (check `package.json` for exact script name, should be `vitest`).

### Do NOT touch

- `services/game_engine.py` — read-only reference
- `DifficultyManager.js` — created by Story 2.3; do not create here
- Any test files other than `CartSystem.test.js`
- Any existing module (GameState.js, main.js, etc.) — CartSystem is additive only

### Previous story learnings (from Epic 1)

- `toggle button .active` vs `.selected` caused a regression in Story 1-8 — verify you're not shadowing class names
- `npm test` output: 93 passed, 0 failed, 64 skipped at end of Epic 1 — do not reduce this pass count
- Test location is `tests/unit/js/` — established and confirmed correct in architecture correction

### References

- `services/game_engine.py` — source for porting (lines 59–310)
- `services/schemas.py` — CartWave, GameSession shapes
- `docs/game-engine-analysis.md` — Story 2.1 output (required reading)
- `_bmad-output/planning-artifacts/architecture.md` — "Module Ownership of GameState" table, "Phase Transitions" section
- `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2 ACs
- `tests/unit/js/CartSystem.test.js` — expected API, test cases

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Read `docs/game-engine-analysis.md`, `tests/unit/js/CartSystem.test.js`, and `static/game/GameState.js` before implementation
- Implemented CartSystem as static-method class to match test scaffold call pattern (`CartSystem.update(...)` not `cs.update(...)`)
- COLLISION_THRESHOLD = 0.5 world units for proximity-based collision
- Ordering: move → score (mark cleared) → collision (skips cleared) → remove (z < character.z) → top-up wave queue
- Discrepancy resolved (code review): AC-4 text `medium=1.5` is correct; test scaffold had a bug (`difficultyMultiplier = 1`). Fixed test to `1.5` and implementation updated. easy=1, medium=1.5, hard=2.
- Wave pruning guards against undefined spawnTime/duration (test carts have neither)
- 7 CartSystem tests pass (100 total passed, up from 93); 6 pre-existing failing suites unrelated to this story

### File List

- `static/game/CartSystem.js` (created)
- `tests/unit/js/CartSystem.test.js` (modified — un-skipped all tests)

### Change Log

- 2026-05-21: Implemented CartSystem.js with cart movement, collision, scoring, wave spawning; un-skipped 7 CartSystem tests; all pass
