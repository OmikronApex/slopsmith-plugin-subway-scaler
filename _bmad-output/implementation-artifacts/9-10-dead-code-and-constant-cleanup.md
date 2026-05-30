# Story 9.10: Dead Code Removal, Constant Consolidation & Low-Risk Cleanup

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-10
**Story Key:** 9-10-dead-code-and-constant-cleanup
**Depends on:** 9-9 (audit findings document must exist)

---

## Context

Story 9-9 produced `_bmad-output/implementation-artifacts/refactor-findings.md` — a prioritised list of dead code, duplicate constants, and low-risk performance issues across the codebase. This story implements the **Low-risk tier** of findings from that audit: all CONFIRMED removals, the two constant consolidations, backend response cleanup, poll interval fix, sprite texture caching, and the `gameNow()` helper.

Medium-risk items (MAIN-5 duplicate promote paths, SM decomposition) are deferred to a future epic.

---

## User Story

As a **developer**,
I want dead code, orphaned constants, and vestigial backend structures removed,
so that the codebase is smaller, cleaner, and easier to navigate without any gameplay regression.

---

## Acceptance Criteria

**AC-1 — Dead imports and declarations removed from `main.js`:**
Given `static/game/main.js` in its current state,
When this story is applied,
Then:
- Line 14: `quantize` removed from import (leave `midiToName`). The import line becomes `import { midiToName } from './notes.js';`
- Line 25: `const DIAG_CROSS_MS = 1200;` removed
- Line 51: `const NOTE_NAMES = [...]` removed
- Line 359: `function updateVariantHud() {}` declaration removed
- Line 880: `updateVariantHud(); // AC-4: ...` call removed
- No other constants, imports, or behaviors in `main.js` are changed

**AC-2 — Unused `Run` import removed from `NoteAcceptor.js`:**
Given `static/game/NoteAcceptor.js:5`,
When this story is applied,
Then `import { Run } from './GameState.js';` is removed. `NoteAcceptor.js` has zero remaining import of `Run`.

**AC-3 — `SceneManager` static class and dead cinematic constants removed from `SceneManager.js`:**
Given `static/game/SceneManager.js`,
When this story is applied,
Then:
- Lines 807–810 (inside `createScene()`): the four dead constants `MAX_BEND_YAW`, `DIAG_CROSS_MS`, `FIRST_WAVE_ARRIVAL_DELAY_MS`, `REPOSITION_SLIDE_MS` are removed
- Lines 2127–2247: the entire `SceneManager` static class (comment header + class body) is deleted
- `export function applyWorldCurve` and `export function createScene` remain untouched
- `SafeZoneRenderer.js` import of `applyWorldCurve` still works after the deletion

**AC-4 — `LANE_W` and `DIAG_LEN` exported from `TrackSystem.js` and deduplicated:**
Given that `LANE_W = 1.4` is declared in both `main.js:29` and `SceneManager.js:20`, and `DIAG_LEN = 45` in both `main.js:28` and `SceneManager.js:23`,
When this story is applied,
Then:
- `TrackSystem.js` exports `LANE_W = 1.4` and `DIAG_LEN = 45` as named exports
- `main.js` imports `LANE_W` and `DIAG_LEN` from `./TrackSystem.js` and removes its local declarations
- `SceneManager.js` imports `LANE_W` and `DIAG_LEN` from `./TrackSystem.js` and removes its local declarations
- Both files use the imported values with no behavior change

**AC-5 — `onGameOver` dead callback removed from `GamePoller`:**
Given `static/game/GamePoller.js` and `static/game/main.js:901`,
When this story is applied,
Then:
- `GamePoller` constructor no longer accepts `onGameOver` parameter
- The `this.onGameOver = onGameOver` assignment and any `this.onGameOver(...)` call sites inside `GamePoller.js` are removed
- `main.js:901` GamePoller construction no longer passes `onGameOver: (reason) => {}`

**AC-6 — Backend dead code removed:**
Given `services/game_engine.py`, `services/game_router.py`, and `services/schemas.py`,
When this story is applied,
Then:
- `GameEngine.fail_session()` method (lines ~263–266) is removed from `game_engine.py`
- The `GET /game/notes/{note_id}` endpoint (lines ~96–104) is removed from `game_router.py`
- `Note` import in `game_router.py` is removed (it was only imported, never used in the router after removing the endpoint)
- `game_router.py` no longer imports `Track`, `GameState`, `SpeedMultiplier` (removed below in AC-7)

**AC-7 — `GameState(carts=[])` bloat removed from `/start` and `/session` responses:**
Given `services/game_router.py` `/start` and `/{session_id}` endpoints,
When this story is applied,
Then:
- `POST /start` response no longer includes a `game_state` key (the entire `game_state = GameState(...)` block and `"game_state": game_state` entry removed)
- `GET /{session_id}` response no longer includes a `game_state` key
- Both responses still include `speed_multiplier` as a top-level float field (already present)
- `GameState`, `Track`, `SpeedMultiplier` pydantic models are removed from `services/schemas.py`
- The following tests are updated to remove or fix `game_state` assertions:
  - `tests/contract/test_game_start.py`: remove `assert "game_state" in data`
  - `tests/contract/test_game_state.py`: remove `assert "game_state" in data` (or replace with an assertion about a field that still exists)
  - `tests/integration/test_game_loop.py:36`: change `final_data["game_state"]["speed_multiplier"]["current_value"]` → `final_data["speed_multiplier"]` (now a float)
- `tests/integration/test_game_failure.py` assertions on `play_resp.json()["game_state"]["status"]` are **NOT changed** — the `play_note` endpoint returns its own inline `game_state: {status, score}` dict from `game_engine.play_note()` which is NOT the pydantic `GameState` model and must be preserved

**AC-8 — Poll interval increased to 1000ms:**
Given `static/game/GamePoller.js:25` where `start(intervalMs = 200)` is called,
When this story is applied,
Then `start(intervalMs = 1000)` is the new default. Any existing explicit `poller.start()` calls in `main.js` with no argument benefit automatically.

**AC-9 — `CanvasTexture` objects cached per frame in `SceneManager.js`:**
Given `updateCharacterSprite()` at `static/game/SceneManager.js:766` which creates a new `CanvasTexture` on every sprite frame change,
When this story is applied,
Then:
- `initSpriteFrames()` pre-creates a `CanvasTexture` for each frame immediately after loading frames (both placeholder and GIF frames)
- `updateCharacterSprite()` reuses cached textures instead of constructing new ones
- When GIF frames replace placeholder frames (async load), old cached textures are disposed and new ones created
- No behavior change to sprite animation; `character.material.needsUpdate = true` still set on frame change

**AC-10 — `gameNow()` helper introduced in `main.js`:**
Given `_now() - gameStartTime` computed inline at 6+ sites inside `start()` in `main.js`,
When this story is applied,
Then:
- A closure `const gameNow = () => _now() - gameStartTime;` is declared once inside `start()`, after `gameStartTime` is initialised
- All occurrences of `_now() - gameStartTime` within `start()` (except the initial `game_now` const in the RAF loop which may stay for clarity or also use `gameNow()`) are replaced with `gameNow()`
- Behavior is identical; only the inline expression is replaced

**AC-11 — All tests pass:**
Given the changes above,
When the full test suite runs (`pytest` + any existing JS unit tests),
Then zero regressions. The Playwright E2E suite (if runnable) passes or was already skipped before this story.

**AC-12 — No production code changed beyond what's specified:**
Given the scope of this story,
When the story is complete,
Then no files outside those listed in the File List section are modified.

---

## Tasks / Subtasks

- [x] **T1 — main.js dead code removal (AC-1)**
  - [x] Remove `quantize` from `notes.js` import line
  - [x] Remove `const DIAG_CROSS_MS = 1200;`
  - [x] Remove `const NOTE_NAMES = [...]`
  - [x] Remove `function updateVariantHud() {}` declaration
  - [x] Remove `updateVariantHud();` call at line ~880
  - [x] Run grep to confirm zero remaining references to these symbols in main.js

- [x] **T2 — NoteAcceptor.js dead import removal (AC-2)**
  - [x] Remove `import { Run } from './GameState.js';`

- [x] **T3 — SceneManager.js dead class + dead constants removal (AC-3)**
  - [x] Remove lines 807–810 (4 dead cinematic constants inside createScene)
  - [x] Remove lines 2127–2247 (SceneManager static class + header comment)
  - [x] Verify `applyWorldCurve` export still present and importable

- [x] **T4 — Constant consolidation: LANE_W and DIAG_LEN to TrackSystem.js (AC-4)**
  - [x] Add `export const LANE_W = 1.4;` to TrackSystem.js
  - [x] Add `export const DIAG_LEN = 45;` to TrackSystem.js
  - [x] Update main.js: import LANE_W, DIAG_LEN from './TrackSystem.js'; remove local declarations
  - [x] Update SceneManager.js: import LANE_W, DIAG_LEN from './TrackSystem.js'; remove local declarations
  - [x] Grep to confirm no other local LANE_W/DIAG_LEN declarations remain

- [x] **T5 — GamePoller onGameOver cleanup (AC-5)**
  - [x] Remove `onGameOver` parameter from GamePoller constructor
  - [x] Remove `this.onGameOver = onGameOver` and any call sites
  - [x] Update main.js GamePoller construction to remove `onGameOver` entry

- [x] **T6 — Backend dead code removal (AC-6)**
  - [x] Remove `GameEngine.fail_session()` from game_engine.py
  - [x] Remove `GET /game/notes/{note_id}` endpoint from game_router.py
  - [x] Remove unused imports from game_router.py: `Note`, `Track`, `GameState`, `SpeedMultiplier`

- [x] **T7 — Remove GameState bloat from responses + update tests (AC-7)**
  - [x] Remove `game_state = GameState(...)` block from `/start` handler
  - [x] Remove `"game_state": game_state` from `/start` return dict
  - [x] Remove `game_state = GameState(...)` block from `/{session_id}` GET handler
  - [x] Remove `"game_state": game_state.model_dump()` from `/{session_id}` return dict
  - [x] Remove `GameState`, `Track`, `SpeedMultiplier` from schemas.py
  - [x] Update `tests/contract/test_game_start.py` — remove `assert "game_state" in data`
  - [x] Update `tests/contract/test_game_state.py` — remove `assert "game_state" in data`
  - [x] Update `tests/integration/test_game_loop.py:36` — `final_data["speed_multiplier"]` (float)
  - [x] Run pytest to verify all tests pass

- [x] **T8 — Poll interval default to 1000ms (AC-8)**
  - [x] Change `start(intervalMs = 200)` to `start(intervalMs = 1000)` in GamePoller.js

- [x] **T9 — CanvasTexture caching in SceneManager.js (AC-9)**
  - [x] Add `_spriteTextures = null` alongside `_spriteFrames` state variable
  - [x] In `initSpriteFrames()` after assigning `_spriteFrames`, pre-create textures: `_spriteTextures = _spriteFrames.map(f => { const t = new THREE.CanvasTexture(f); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; return t; });`
  - [x] In the async GIF load callback, after replacing `_spriteFrames`: dispose old textures, then pre-create new textures into `_spriteTextures`
  - [x] Update `updateCharacterSprite()`: replace `const tex = new THREE.CanvasTexture(...)` + assignment with `character.material.map = _spriteTextures[frameIdx];` (remove `needsUpdate` line — CanvasTexture does not auto-dirty; set `character.material.needsUpdate = true` only on frame change, which is already gated by `frameIdx !== _charLastFrameIdx`)

- [x] **T10 — gameNow() helper in main.js (AC-10)**
  - [x] After `gameStartTime` is set (line ~894), declare `const gameNow = () => _now() - gameStartTime;`
  - [x] Replace all remaining `_now() - gameStartTime` inline expressions within `start()` with `gameNow()`
  - [x] Verify the RAF loop's local `const game_now = _now() - gameStartTime;` — replaced with `gameNow()`

- [x] **T11 — Full test suite validation (AC-11)**
  - [x] Run `pytest` — 81 passed, 1 pre-existing failure (ionian/aeolian scales unrelated to this story)
  - [x] No JS unit test runner configured; no regressions introduced

---

## Dev Notes

### Scope boundaries — do NOT touch

- Do NOT change any game logic, cinematic timing, collision detection, or variant state machine
- Do NOT extract TransitionOrchestrator (MAIN-1/2) or deduplicate promote paths (MAIN-5) — deferred to future epic
- Do NOT decompose SceneManager into sub-modules (SM-1 through SM-7) — future epic
- Do NOT consolidate dual pause UI (MAIN-6) — medium risk, future story
- CONS-3 (`_pauseReason` comment) — add the documentation comment inline at `_pauseReason` declaration if time permits, but this is not a required AC

### AC-3: Removing the SceneManager static class

The class lives at lines 2127–2247 (file verified post-story-9-8). The comment header just before it reads:
```
// ===== SceneManager — Story 3.1: static class owning renderer, camera, scene =====
```
Delete from this comment through the closing `}` at line 2247. The `export function applyWorldCurve` at line 46 and `export function createScene` at line 72 are completely separate and must remain.

**Verify before deleting:** `grep -n "SceneManager\." static/game/ --include="*.js" -r` — should show zero results outside of `SceneManager.js` itself (other than the internal `SceneManager.onResize` call inside `SceneManager.init()` which also gets deleted).

### AC-4: TrackSystem.js already exports geometry constants

`TrackSystem.js` already exports: `LANE_X_SCALE`, `ROW_DZ`, `WINDOW`, `QUEUE_DZ`, `SPAWN_Z`. The new exports `LANE_W` and `DIAG_LEN` follow the same pattern. TrackSystem is the correct home — it owns `laneX()` which depends on lane width semantics.

**main.js import to update:**
```js
// Before:
import { laneX, SPAWN_Z } from './TrackSystem.js';
// After:
import { laneX, SPAWN_Z, LANE_W, DIAG_LEN } from './TrackSystem.js';
```

**SceneManager.js import to update:**
```js
// Before:
import { laneX, cameraForPitch, SPAWN_Z, LANE_X_SCALE } from './TrackSystem.js';
// After:
import { laneX, cameraForPitch, SPAWN_Z, LANE_X_SCALE, LANE_W, DIAG_LEN } from './TrackSystem.js';
```

LANE_W is used in SceneManager at lines 984, 988, 993, 995, 1159 and in `buildVariantTrackGroup`. DIAG_LEN is used at lines 23 (declaration to delete), 519, 525, 986, 988, 993, 995, 1158, 1807, 1857.

### AC-7: BE-2 — What to keep in `/play-note` response

`game_engine.play_note()` returns `{"success": True, "game_state": {"status": ..., "score": ..., "current_track": ...}}` — this is an **inline dict**, not the pydantic `GameState` model. Do NOT touch it. `test_game_failure.py` reads `play_resp.json()["game_state"]["status"]` which reads this inline dict. Leave it alone.

The pydantic `GameState(carts=[], track=Track(...), speed_multiplier=SpeedMultiplier(...))` only appears in `/start` and `GET /{session_id}`. Remove only those.

**`/{session_id}` response after BE-2:** Keep `score`, `speed_multiplier` (top-level float), `current_note_index`, `next_expected_note`, `scale_passes_completed`, `last_pass_direction`, `active_variant`, `active_window`. Remove `game_state`.

**`/start` response after BE-2:** Keep `session_id`, `initial_track`, `base_fret`, `num_lanes`, `notes`, `root_note`, `ascending_note_count`, `timing_params`. Remove `game_state`.

**test_game_loop.py line 36 fix:**
```python
# Before:
assert final_data["game_state"]["speed_multiplier"]["current_value"] > 1.0
# After:
assert final_data["speed_multiplier"] > 1.0
```
`speed_multiplier` is already a top-level float in the `/{session_id}` response.

### AC-9: CanvasTexture caching pattern

The `_spriteTextures` array should be created alongside `_spriteFrames` and disposed/rebuilt when frames change. Key pattern:

```js
// In initSpriteFrames(), after _spriteFrames = generatePlaceholderFrames(...):
_spriteTextures = _spriteFrames.map(f => {
  const t = new THREE.CanvasTexture(f);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  return t;
});

// In GIF load callback, after _spriteFrames = frames:
if (_spriteTextures) _spriteTextures.forEach(t => t.dispose());
_spriteTextures = _spriteFrames.map(f => {
  const t = new THREE.CanvasTexture(f);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  return t;
});
```

```js
// In updateCharacterSprite(), replace:
//   const tex = new THREE.CanvasTexture(_spriteFrames[frameIdx]);
//   tex.colorSpace = ...
//   character.material.map = tex;
//   character.material.needsUpdate = true;
// With:
if (!_spriteTextures) return;
character.material.map = _spriteTextures[frameIdx];
character.material.needsUpdate = true;
```

### AC-10: gameNow() placement

`gameNow` must be declared AFTER `gameStartTime` is first set but INSIDE `start()` so it captures both `_now` and `gameStartTime` from the same closure scope. The right location is immediately after:
```js
gameStartTime = countdownStart + 3500;
```
at line ~894.

The RAF loop `const game_now = _now() - gameStartTime;` at line ~854 is also inside `start()` so it can safely call `gameNow()` once the helper is declared.

### AC-5: GamePoller cleanup detail

Current `GamePoller` constructor (GamePoller.js):
```js
constructor({ gameClient, scoreDisplay, variantController, scene, onGameOver }) {
    ...
    this.onGameOver = onGameOver;
```

After:
```js
constructor({ gameClient, scoreDisplay, variantController, scene }) {
    ...
    // (remove this.onGameOver assignment)
```

Check GamePoller.js for any `this.onGameOver(...)` call in the `pollState.status === 'failed'` block and remove it (only the empty callback needed removing — the `if (this.run) this.run.state = 'failed';` logic stays).

### Files to modify (complete list)

| File | Change |
|------|--------|
| `static/game/main.js` | AC-1, AC-4 (import), AC-5 (constructor), AC-10 |
| `static/game/NoteAcceptor.js` | AC-2 |
| `static/game/SceneManager.js` | AC-3, AC-4 (import + local deletions), AC-9 |
| `static/game/GamePoller.js` | AC-5, AC-8 |
| `static/game/TrackSystem.js` | AC-4 (add exports) |
| `services/game_engine.py` | AC-6 |
| `services/game_router.py` | AC-6, AC-7 |
| `services/schemas.py` | AC-7 |
| `tests/contract/test_game_start.py` | AC-7 |
| `tests/contract/test_game_state.py` | AC-7 |
| `tests/integration/test_game_loop.py` | AC-7 |

### CartSystem.js / DifficultyManager.js (DC-5/DC-6)

These files **do not exist on disk** — confirmed during audit by grep returning empty + `find` finding nothing. DC-5 and DC-6 are already resolved. No action needed.

---

## Dev Agent Record

### Status
review

### Completion Notes

All Low-risk audit findings implemented:
- **T1**: Removed `quantize` import, `DIAG_CROSS_MS`, `NOTE_NAMES`, `updateVariantHud` declaration and call from `main.js`
- **T2**: Removed unused `Run` import from `NoteAcceptor.js`
- **T3**: Removed 4 dead cinematic constants (lines 807–810) and entire `SceneManager` static class + header comment from `SceneManager.js`
- **T4**: Exported `LANE_W` and `DIAG_LEN` from `TrackSystem.js`; updated imports in `main.js` and `SceneManager.js`; removed local declarations
- **T5**: Removed `onGameOver` param from `GamePoller` constructor; removed `main.js` call-site entry
- **T6**: Removed `GameEngine.fail_session()`, `GET /notes/{note_id}` endpoint, and unused schema imports from `game_engine.py` / `game_router.py`
- **T7**: Removed pydantic `GameState`/`Track`/`SpeedMultiplier` bloat from `/start` and `/{session_id}` responses; removed models from `schemas.py`; updated 3 test files
- **T8**: Poll interval default changed 200ms → 1000ms
- **T9**: `CanvasTexture` objects pre-created per frame in `_spriteTextures`; reused in `updateCharacterSprite()`; disposed and rebuilt on GIF load
- **T10**: `gameNow()` closure declared after `gameStartTime` set; all 6 inline `_now() - gameStartTime` expressions replaced
- **T11**: 81 tests pass; 1 pre-existing failure (`ionian`/`aeolian` scale IDs) unrelated to this story

---

## File List

- `static/game/main.js`
- `static/game/NoteAcceptor.js`
- `static/game/SceneManager.js`
- `static/game/GamePoller.js`
- `static/game/TrackSystem.js`
- `services/game_engine.py`
- `services/game_router.py`
- `services/schemas.py`
- `tests/contract/test_game_start.py`
- `tests/contract/test_game_state.py`
- `tests/integration/test_game_loop.py`

---

## Change Log

- 2026-05-29: Story created from 9-9 refactor-findings.md — implements all Low-risk findings from audit
- 2026-05-29: Implemented all T1–T11 — dead code removal, constant consolidation, backend cleanup, texture caching, gameNow helper
- 2026-05-30: Removed `_find_root_for_highest` dead code from game_engine.py; simplified RIGHT variant accept to use the same `VARIANT_SHIFT_DOWN` offset as LEFT (search loop was over-engineered and produced inconsistent results)
