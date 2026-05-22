# Story 4-T3: Rework CartSystem.js and SafeZoneRenderer.js to Consume WaveScheduler

**Status:** review

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4-T3
**Story Key:** 4-T3-rework-cartsystem-and-safezonerenderer-to-consume-wavescheduler
**Depends on:** 4-T2
**Prerequisite for:** 4-T4, 4-2 and all subsequent Epic 4 stories

---

## Context

After 4-T2, `WaveScheduler.js` exists and generates the authoritative wave queue.
`CartSystem.js` currently has its own duplicate wave scheduling (`_topUpWaveQueue`, `_buildCart`,
`_nextDeadlineMs`, etc.) using `Date.now()`. `SafeZoneRenderer.js` currently receives `currentWaves`
passed in from `main.js` (poll-sourced). This story replaces both of those with reads from
`WaveScheduler.waves`, making it the single source of truth.

---

## User Story

As a developer,
I want `CartSystem.js` and `SafeZoneRenderer.js` to read wave data from `WaveScheduler`,
so that wave timing is consistent across rendering, collision detection, and safe zone display.

---

## Acceptance Criteria

**AC-1 — CartSystem no longer owns wave generation:**
`CartSystem.js` does not contain `_topUpWaveQueue`, `_buildCart`, `_nextDeadlineMs`,
`_nextWaveNoteIndex`, or `_totalWavesSpawned`. The `init()` call no longer initialises those fields.

**AC-2 — CartSystem collision reads from WaveScheduler:**
`CartSystem.update(game_now, gameState, waves)` accepts the current wave array from `WaveScheduler`.
Collision detection determines the effective Z of each wave from timing:
```js
const elapsed = Math.max(0, game_now - wave.spawn_time_ms);
const z = SPAWN_Z - elapsed * wave.speed_px_per_ms * 0.5;
```
A collision occurs when a non-cleared wave is in the character's lane and `Math.abs(z - character.z) < COLLISION_THRESHOLD`.

**AC-3 — CartSystem score logic reads from WaveScheduler:**
Safe zone clearing (`cart.cleared = true`) and score increment operate on waves from the passed array.
The `cleared` flag lives on the wave object itself — `WaveScheduler.waves` entries are extended with
`cleared: false` when built, and `CartSystem` sets `wave.cleared = true` when the note is played.

**AC-4 — SafeZoneRenderer no longer accepts currentWaves from main.js:**
`SafeZoneRenderer.update(waveSchedulerWaves, ...)` receives waves from `WaveScheduler` directly
(passed by `GameLoop` in 4-T4). The signature and internal logic remain compatible — `WaveScheduler`
wave shape matches what `SafeZoneRenderer` already expects (see AC-3 of 4-T2).

**AC-5 — No Date.now() in CartSystem:**
All time-based logic in `CartSystem.js` uses the `game_now` argument (derived from `performance.now()
- gameStartTime`), never `Date.now()`.

**AC-6 — Tests pass:**
- All existing `CartSystem` tests in `tests/unit/js/CartSystem.test.js` pass with the new signature
- Tests are updated to pass a stub waves array (from `WaveScheduler` shape) instead of using the old
  internal state. Add tests for:
  - Collision detection using wave Z derived from `game_now` and `spawn_time_ms`
  - Score increment when `wave.cleared` transitions to `true`

---

## Tasks / Subtasks

- [ ] Task 1: Read before changing (AC: all)
  - [ ] Read `static/game/CartSystem.js` fully — map every field and method being removed
  - [ ] Read `static/game/ui/SafeZoneRenderer.js` fully — note the current call signature and wave fields it accesses
  - [ ] Read `static/game/GameLoop.js` — understand how `CartSystem.update()` is currently called
  - [ ] Read `tests/unit/js/CartSystem.test.js` — note which tests rely on internal wave state

- [ ] Task 2: Rework CartSystem.js (AC-1 to AC-5)
  - [ ] Remove: `_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned` static fields
  - [ ] Remove: `_topUpWaveQueue()`, `_buildCart()` methods
  - [ ] Update `init(gameState)`: remove wave cursor initialisation
  - [ ] Update `update(deltaTime, gameState)` → `update(game_now, gameState, waves)`:
    - [ ] Collision check: compute `z` from `game_now` and `wave.spawn_time_ms` (AC-2)
    - [ ] Score check: use `wave.cleared` flag on wave objects (AC-3)
    - [ ] Remove the old `gameState.scene.carts` push / prune logic (waves come from WaveScheduler now)
  - [ ] Ensure zero `Date.now()` calls remain in the file (AC-5)

- [ ] Task 3: Update SafeZoneRenderer.js call signature (AC-4)
  - [ ] Confirm that `WaveScheduler` wave shape (`wave_id`, `spawn_time_ms`, `speed_px_per_ms`,
    `safe_track`, `duration_ms`) satisfies what `SafeZoneRenderer.update()` currently accesses
  - [ ] If any field names differ, add a mapping shim inside `SafeZoneRenderer` rather than changing
    `WaveScheduler` — keep the public interface stable
  - [ ] Do NOT change the external call signature of `SafeZoneRenderer.update()` in this story —
    that wiring change happens in 4-T4

- [ ] Task 4: Update CartSystem tests (AC-6)
  - [ ] Open `tests/unit/js/CartSystem.test.js`
  - [ ] Replace tests that relied on internal `_topUpWaveQueue` with tests that pass a pre-built waves array
  - [ ] Add collision-from-timing test: wave with `spawn_time_ms = 0`, `speed_px_per_ms = 0.04`,
    `game_now = 1000` → expected Z computed; character at same lane and Z → GAME_OVER
  - [ ] Run `npm test` — all CartSystem tests green

---

## Notes

- `gameState.scene.carts` was the old collision target. After this story, collision is against the
  `waves` array passed to `update()`. `gameState.scene.carts` can be removed from `GameState.js`
  in a follow-up; for now leave it to avoid breaking `SceneManager` references — just stop writing to it.
- The `cleared` flag on wave objects is mutable state owned by `CartSystem` (the only module that
  sets it to `true`). `WaveScheduler` initialises `cleared: false` when building each wave (add to
  `_buildWave()` in WaveScheduler). `WaveScheduler.reset()` clears the array so old cleared flags
  don't persist across variant switches.
- `SafeZoneRenderer` currently takes `nowMs` and `gameStartTime` as separate args. After this story
  the caller will pass `game_now` (= `performance.now() - gameStartTime`) directly, so those two
  args can be collapsed in 4-T4. Don't change that in this story.
