# Story 4-T2: Implement WaveScheduler.js

**Status:** review

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4-T2
**Story Key:** 4-T2-implement-wavescheduler-js
**Depends on:** 4-T1
**Prerequisite for:** 4-T3, 4-T4, 4-2 and all subsequent Epic 4 stories

---

## Context

After 4-T1, the Python backend no longer generates waves. JS now owns wave scheduling entirely.
This story creates `WaveScheduler.js` — a dedicated module that replicates the logic previously
in `game_engine.py:update_session_state()` and `generate_next_wave()`, but using a single
`performance.now()` clock via a `game_now` parameter, eliminating the dual-clock instability.

`CartSystem.js` currently has its own `_topUpWaveQueue` using `Date.now()`. That internal logic
will be replaced by `WaveScheduler` in story 4-T3. This story builds the replacement in isolation
so it can be fully tested before being wired into the rest of the system.

---

## User Story

As a developer,
I want a `WaveScheduler.js` module that generates a wave queue from notes and timing constants,
so that wave timing is driven by a single `performance.now()` clock with no network dependency.

---

## Acceptance Criteria

**AC-1 — Constructor:**
`new WaveScheduler(notes, timingParams)` accepts:
- `notes`: the note sequence array from `/game/start` (each note has `midi`, `name`, `string`, `fret`, `safe_track`)
- `timingParams`: the `timing_params` object from `/game/start` (`base_duration_ms`, `wave_spacing_factor`, `wave_lookahead_ms`, `speed_increment_per_note`)

Constructor initialises the internal wave queue to empty. Does not generate any waves until `tick()` is called.

**AC-2 — tick(game_now, speedMultiplier):**
`tick(game_now, speedMultiplier)` tops up the internal wave queue so that waves are queued up to
`wave_lookahead_ms` ahead of `game_now`. Mirrors the while-loop in the old `update_session_state`:

```
while _nextDeadlineMs < game_now + timingParams.wave_lookahead_ms:
    gap = timingParams.base_duration_ms * timingParams.wave_spacing_factor / speedMultiplier
    _nextDeadlineMs += gap
    emit next wave for _nextWaveNoteIndex
    _nextWaveNoteIndex = (_nextWaveNoteIndex + 1) % notes.length
```

Prunes waves where `wave.spawn_time_ms + wave.duration_ms < game_now - 10000` from the internal array.

`game_now` is always `performance.now() - gameStartTime` — a monotonically increasing value in ms
relative to the moment the game loop started. Never uses `Date.now()`.

**AC-3 — Wave shape:**
Each wave object in `waves` has the shape:
```js
{
  wave_id: 'w-0',           // 'w-' + sequential index
  wave_index: 0,            // sequential integer
  safe_track: 2,            // note.fret - session.base_fret (clamped 0 to num_lanes-1)
  safe_midi: 60,            // note.midi
  note_name: 'C4',          // note.name
  spawn_time_ms: 1200,      // game_now (ms) when the cart reaches the safe zone
  speed_px_per_ms: 0.04,    // base_speed * speedMultiplier
  duration_ms: 2500,        // base_duration_ms / speedMultiplier
}
```
This shape is compatible with `SafeZoneRenderer.update()` and `SceneManager.setWaves()` without
modification to those consumers.

**AC-4 — waves getter:**
`waveScheduler.waves` returns the current internal array. Read-only — callers must not mutate it.

**AC-5 — reset(notes):**
`waveScheduler.reset(notes)` clears the internal wave queue and note cursor, and sets a new note
sequence. Called on variant accept when the note sequence changes mid-game.

**AC-6 — Tests pass:**
`tests/unit/js/WaveScheduler.test.js` exists and all tests pass. Tests must cover:
- After `tick()`, `waves` contains the expected number of waves for a given `game_now`
- Wave `spawn_time_ms` advances correctly with each `tick()` call
- Old waves are pruned correctly
- `reset()` clears the queue and restarts wave generation from the new sequence
- Higher `speedMultiplier` produces shorter `duration_ms` and tighter `gap` between waves
- `safe_track` calculation: `note.fret - base_fret` clamped to `[0, num_lanes-1]`

---

## Tasks / Subtasks

- [ ] Task 1: Read before writing (AC: all)
  - [ ] Read `services/game_engine.py` lines 255–328 (`update_session_state`, `generate_next_wave`) — this is the logic to port
  - [ ] Read `static/game/CartSystem.js` `_topUpWaveQueue` and `_buildCart` — understand current JS equivalent
  - [ ] Read `static/game/ui/SafeZoneRenderer.js` `update()` — understand the wave shape it expects
  - [ ] Read `static/game/SceneManager.js` `setWaves()` — understand the wave shape it expects
  - [ ] Read `_bmad-output/planning-artifacts/architecture.md` section "Architectural Amendment" — confirm the full intent

- [ ] Task 2: Create `static/game/WaveScheduler.js` (AC-1 to AC-5)
  - [ ] Export named `WaveScheduler` class (not default)
  - [ ] Constructor: store `notes`, `timingParams`, `base_fret`, `num_lanes`; init `_waves = []`, `_nextDeadlineMs = 0`, `_nextWaveNoteIndex = 0` (first wave = note index 0), `_totalWavesSpawned = 0`
  - [ ] `tick(game_now, speedMultiplier)`: top-up loop + prune (see AC-2)
  - [ ] `_buildWave(note, deadlineMs, speedMultiplier)`: produces the wave object shape from AC-3
  - [ ] `get waves()`: returns `this._waves` (do not return a copy — callers read, never write)
  - [ ] `reset(notes)`: clears `_waves`, resets `_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned`; stores new `notes`

- [ ] Task 3: Constructor needs base_fret and num_lanes (AC-3)
  - [ ] `new WaveScheduler(notes, timingParams, baseFret, numLanes)`
  - [ ] `safe_track = Math.max(0, Math.min(numLanes - 1, note.fret - baseFret))`

- [ ] Task 4: Write tests (AC-6)
  - [ ] Create `tests/unit/js/WaveScheduler.test.js`
  - [ ] Test wave count after tick at `game_now = 0` with 10s lookahead
  - [ ] Test wave pruning (advance game_now past `spawn_time_ms + duration_ms + 10000`)
  - [ ] Test reset clears queue
  - [ ] Test safe_track clamping
  - [ ] Run `npm test` — all WaveScheduler tests pass

---

## Notes

- `_nextDeadlineMs` is initialised to `0`. On the very first `tick(0, 1.0)` the while-loop condition
  `0 < 0 + 10000` is immediately true, so the queue will be pre-filled. This matches the old Python
  behaviour where `next_deadline_ms=base_duration` was set at session create — the first tick fills it.
- `speed_px_per_ms` formula: `(100.0 / base_duration_ms) * speedMultiplier`. Mirrors Python's
  `base_speed = 100.0 / base_duration` and `current_speed = base_speed * session.speed_multiplier`.
- `duration_ms` formula: `base_duration_ms / speedMultiplier`.
- Do NOT import from `GameState.js` or depend on any game phase. `WaveScheduler` is a pure data
  structure — it knows nothing about phases, collisions, or audio.
