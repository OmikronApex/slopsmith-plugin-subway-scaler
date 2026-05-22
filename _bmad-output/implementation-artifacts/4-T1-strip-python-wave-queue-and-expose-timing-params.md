# Story 4-T1: Strip Python Wave Queue and Expose timing_params

**Status:** review

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4-T1
**Story Key:** 4-T1-strip-python-wave-queue-and-expose-timing-params
**Prerequisite for:** 4-T2, 4-T3, 4-T4, 4-2 and all subsequent Epic 4 stories

---

## Context

The architecture amendment (2026-05-22, `_bmad-output/planning-artifacts/architecture.md`) migrates
wave scheduling from Python to JS to eliminate the dual-clock instability between `time.time()` and
`performance.now()`. This story handles the Python-side of that migration: strip the wave queue from
`game_engine.py` and `GameSession`, and add a `timing_params` block to the `/game/start` response so
JS has the constants it needs to replicate the same scheduling behaviour.

---

## User Story

As a developer,
I want the Python backend to be free of wave queue state and to return timing constants at session start,
so that JS owns all wave scheduling with a single `performance.now()` clock.

---

## Acceptance Criteria

**AC-1 — timing_params in /game/start response:**
`POST /game/start` response includes a `timing_params` object:
```json
{
  "base_duration_ms": 2500,
  "wave_spacing_factor": 0.4,
  "wave_lookahead_ms": 10000,
  "speed_increment_per_note": 0.05
}
```
`base_duration_ms` reflects the selected difficulty (`easy: 4000`, `medium: 2500`, `hard: 1500`).
All other fields are constants. The existing `waves` field is removed from the response.

**AC-2 — /game/{id} poll response contains no waves:**
`GET /game/{id}` response no longer includes a `waves` field under `game_state`.
The response shape is:
```json
{
  "session_id": "...",
  "status": "running",
  "score": 0,
  "current_note_index": 0,
  "next_expected_note": {...},
  "octave_loops_completed": 0,
  "active_variant": null,
  "active_window": null
}
```

**AC-3 — Wave queue removed from GameSession:**
`GameSession` no longer has the following fields:
- `waves: List[CartWave]`
- `next_deadline_ms: int`
- `next_wave_note_index: int`
- `total_waves_spawned: int`

**AC-4 — Wave generation methods removed from GameEngine:**
`GameEngine` no longer has:
- `update_session_state()`
- `generate_next_wave()`
- `WAVE_LOOKAHEAD_MS` constant
- `WAVE_SPACING_FACTOR` constant

**AC-5 — play-note response unchanged:**
`POST /game/{id}/play-note` still returns `speed_multiplier` in `game_state`. No behaviour change.

**AC-6 — Python tests pass:**
All tests in `tests/` pass after this change. Tests that assert on `session.waves` content or call
`update_session_state` directly are deleted (not commented out). No test failures from removal.

---

## Tasks / Subtasks

- [ ] Task 1: Read before touching (AC: all)
  - [ ] Read `services/game_engine.py` fully — understand all references to `waves`, `next_deadline_ms`, `next_wave_note_index`, `total_waves_spawned`
  - [ ] Read `services/game_router.py` — find every place `session.waves` is read or the response includes waves
  - [ ] `rtk grep -r "waves\|next_deadline\|next_wave_note\|total_waves_spawned\|update_session_state\|generate_next_wave" services/` — confirm all hit sites
  - [ ] Read `services/schemas.py` — check if `CartWave` or wave fields appear in shared schemas used by tests
  - [ ] Run `rtk pytest tests/` — record baseline pass/fail before making any changes

- [ ] Task 2: Add timing_params to /game/start response (AC-1)
  - [ ] In `game_router.py` `start_game()`: build `timing_params` dict from `session.difficulty`
  - [ ] `base_duration_ms`: `{"easy": 4000, "medium": 2500, "hard": 1500}.get(difficulty, 2500)`
  - [ ] Add `"timing_params": timing_params` to the return dict
  - [ ] Remove `"waves": session.waves` from the return dict

- [ ] Task 3: Strip wave fields from GET /game/{id} (AC-2)
  - [ ] In `game_router.py` `get_session_route()`: remove the `engine.update_session_state(session)` call
  - [ ] Remove `"waves": waves` from the `game_state` dict in the response
  - [ ] Remove the `waves = session.waves` local variable

- [ ] Task 4: Strip wave fields from GameSession (AC-3)
  - [ ] In `game_engine.py` `GameSession`: delete `waves`, `next_deadline_ms`, `next_wave_note_index`, `total_waves_spawned` fields
  - [ ] In `create_session()`: remove the `first_wave` construction and `waves=[first_wave]` / `total_waves_spawned=1` / `next_deadline_ms=base_duration` init args
  - [ ] In `accept_variant()`: remove the `session.waves = []`, `session.next_wave_note_index`, wave-related reset code

- [ ] Task 5: Remove wave generation methods from GameEngine (AC-4)
  - [ ] Delete `update_session_state()` method
  - [ ] Delete `generate_next_wave()` method
  - [ ] Delete `WAVE_LOOKAHEAD_MS` and `WAVE_SPACING_FACTOR` class constants

- [ ] Task 6: Clean up tests (AC-6)
  - [ ] `rtk grep -r "waves\|update_session_state\|generate_next_wave\|next_deadline\|total_waves_spawned" tests/` — list affected test files
  - [ ] For each affected test: delete the test if it exclusively tests wave queue behaviour; otherwise remove only the wave-related assertions
  - [ ] Run `rtk pytest tests/` — all must pass

---

## Notes

- `accept_variant()` in `game_engine.py` currently resets `session.waves = []` and `session.next_deadline_ms`.
  Both of those resets are for the wave queue that JS will now own. Remove them from `accept_variant()`.
  The rest of `accept_variant()` (notes rebuild, speed reset, etc.) is unchanged.
- `CartWave` schema in `services/schemas.py` may still be imported by variant tests. Only delete it if
  nothing else imports it. If in doubt, leave it and add a TODO comment.
- Do NOT change the variant endpoints or the pause/resume endpoints in this story.
