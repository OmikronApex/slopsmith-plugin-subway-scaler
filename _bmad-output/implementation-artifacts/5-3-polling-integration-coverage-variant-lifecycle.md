# Story 5-3: Polling Integration Coverage — Variant Lifecycle

**Status:** backlog

**Epic:** 5 — Variant Track System
**Story ID:** 5-3
**Story Key:** 5-3-polling-integration-coverage-variant-lifecycle
**Depends on:** 5-1
**Prerequisite for:** 5-4

---

## Context

Story 5-1 wires `window.__gameState.variant` observable fields and implements `_test.setVariant` —
a test hook that bypasses the real polling path entirely. The 7 ATDD tests in
`epic5-variant.spec.ts` use this hook, meaning they prove the UI responds correctly when state
is handed to it directly, but never exercise the production path:

```
backend state change → GET /game/{id} poll → JS callback → __gameState.variant update
```

The production failure modes — polling never fires, response parses wrong, state transition
triggers incorrectly — are invisible to the E2E suite. This story adds Python integration tests
that drive the real backend state machine and assert on poll responses at each transition point.

These tests are written against the **current** backend direction logic (before Story 5-4 changes
it), establishing a safety net. Story 5-4 will update the RIGHT-direction assertions when the
`highest_note_midi + 2` logic lands.

---

## User Story

As a developer,
I want Python integration tests that drive the variant lifecycle through the real API and assert
on `GET /game/{id}` poll responses at each state transition,
so that polling path bugs are caught before they reach production.

---

## Acceptance Criteria

**AC-1 — Poll returns `active_variant: null` before any proposal:**
A freshly started session polled via `GET /game/{id}` returns `active_variant: null` and
`active_window: null`. Confirms quiescent-state response shape.

**AC-2 — Poll returns active variant immediately after `/variant/propose`:**
After calling `POST /game/{id}/variant/propose` (with octave-loop precondition met), the next
`GET /game/{id}` response includes `active_variant` with a non-null `variant_id`, `root_midi`,
`base_fret`, `num_lanes`, `base_lane`, and `side`. `active_window.state == "OPEN"` and
`active_window.deadline_ms > now`.

**AC-3 — Poll reflects accepted state after `/variant/accept`:**
After `POST /game/{id}/variant/accept`, the next `GET /game/{id}` response returns
`active_variant: null` (variant consumed) and the session's `root_midi` matches the accepted
variant's `root_midi`. New `notes` geometry is present in the response.

**AC-4 — Poll reflects expired state after `/variant/timeout`:**
After `POST /game/{id}/variant/timeout`, the next `GET /game/{id}` response returns
`active_variant: null` and `active_window: null`. Session continues (status still `running`).

**AC-5 — Octave-loop gate: variant not proposable before threshold:**
`POST /game/{id}/variant/propose` returns `{"success": false, "error": "milestone_not_reached"}`
when `octave_loops_completed < 2`. Confirms the precondition gate.

**AC-6 — Octave-loop gate: variant proposable after threshold:**
After simulating enough `POST /game/{id}/play-note` calls to advance `octave_loops_completed`
to 2, `POST /game/{id}/variant/propose` returns `{"success": true}`. The subsequent poll
confirms `active_variant` is present.

**AC-7 — Rapid-poll idempotency:**
Two consecutive `GET /game/{id}` calls between state transitions return identical `active_variant`
and `active_window` values. No contradictory state on double-poll.

**AC-8 — All tests are fully deterministic:**
No `asyncio.sleep`, no wall-clock waits, no timers. Each test drives state forward via direct
API calls and asserts on immediate response payloads. If the backend requires a wait, that is
a bug the test exposes — not a reason to add a sleep.

---

## Tasks / Subtasks

- [ ] Task 1 — Baseline shape test (AC-1)
  - Add test to `tests/integration/test_variant_flow.py`
  - Create session, call `GET /game/{id}`, assert `active_variant is None`, `active_window is None`

- [ ] Task 2 — Post-propose poll test (AC-2)
  - Drive session to `octave_loops_completed >= 2` via play-note calls
  - Call `POST /game/{id}/variant/propose`
  - Call `GET /game/{id}`, assert `active_variant` fields present and correct shape
  - Assert `active_window.state == "OPEN"` and `deadline_ms > current_time_ms`

- [ ] Task 3 — Post-accept poll test (AC-3)
  - Continue from Task 2 state
  - Call `POST /game/{id}/variant/accept` with the variant's `trigger_midi`
  - Call `GET /game/{id}`, assert `active_variant is None`
  - Assert session `root_midi` updated to variant's `root_midi`

- [ ] Task 4 — Post-timeout poll test (AC-4)
  - Continue from Task 2 state (fresh session)
  - Call `POST /game/{id}/variant/timeout`
  - Call `GET /game/{id}`, assert `active_variant is None`, `active_window is None`
  - Assert session `status == "running"` (not failed)

- [ ] Task 5 — Precondition gate tests (AC-5, AC-6)
  - Test propose-before-threshold: fresh session, call propose, assert `milestone_not_reached`
  - Test propose-after-threshold: drive to 2 loops, call propose, assert `success: true`

- [ ] Task 6 — Rapid-poll idempotency test (AC-7)
  - After proposing a variant, call `GET /game/{id}` twice in succession
  - Assert both responses have identical `active_variant.variant_id` and `active_window.state`

---

## Dev Notes

### File to Modify

`tests/integration/test_variant_flow.py` — extend existing file. Read it before writing to
understand the existing fixture pattern and game session setup. Do not create a new test file.

### Driving octave_loops_completed

The simplest approach: inspect `game_engine.py` to find what increments `octave_loops_completed`
(likely `play_note` when the note sequence wraps). Call `POST /game/{id}/play-note` with the
correct MIDI values in sequence until the counter reaches 2. Use the session's `notes` list from
`POST /game/start` to know the sequence.

### No __TEST_MODE dependency

These tests must exercise the real backend state machine via HTTP. Do not use `_test.setVariant`
or any JS-layer test hooks — those are for E2E tests only.

### Tests break in Story 5-4

AC-2 and AC-6 assert on `active_variant.root_midi`. After Story 5-4 changes the RIGHT direction
logic to `highest_note_midi + 2`, RIGHT-direction assertions in these tests will need updating.
This is expected and intentional — the break is the signal that 5-4 landed correctly.

### References

- `tests/integration/test_variant_flow.py` — existing file to extend
- `services/game_engine.py` — `propose_variant`, `accept_variant`, `timeout_variant` implementations
- `services/game_router.py` — route signatures for `GET /game/{id}`, `POST /game/{id}/variant/*`

---

## Dev Agent Record

_(filled in by dev agent after implementation)_

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

### Change Log
