# Story 6.5: Backend `POST /variant/promote` Endpoint & Scale Swap

**Status:** review

**Epic:** 6 — Variant Transition Cinematic & Handoff
**Story ID:** 6-5
**Story Key:** 6-5-backend-variant-promote-endpoint
**Depends on:** 6-4 (post-bend breather + new scale track approach)

---

## Context

### What 6-4 established

After 6-4, the complete cinematic sequence runs: accept → riding (bend traversal + camera) → breather (waves clear, new tracks scroll in) → promoting → active (state swap). However, the `promoting → active` handler still uses the response from `accept_variant` (which today immediately swaps the scale on the backend). The two-phase decoupling specified in the Epic 6 architecture hasn't been implemented yet.

### What 6-5 does

6-5 implements the two-phase backend protocol:

1. **`accept_variant` no longer mutates the primary scale.** It records acceptance, sets variant state to `ACCEPTED`, and returns a lightweight confirmation. The backend continues serving the outgoing scale for all poll responses.
2. **New `POST /variant/promote` endpoint commits the scale swap.** The frontend calls this during the `promoting` phase (after tracks have landed). The response contains the new scale's notes, base_fret, num_lanes, etc.

This decouples the cinematic timeline from backend state: between accept and promote, the backend serves the outgoing scale, so polling doesn't prematurely return new-scale data. Waves never spawn into transitioning track geometry.

### Architectural decision (from epic spec)

> **Two-phase backend protocol:** Variant acceptance (note hit) and scale promotion (tracks landed) are separate events. New `POST /variant/promote` endpoint commits the scale swap; until promoted, backend continues to serve the outgoing scale. This decouples the cinematic timeline from backend state and prevents premature wave spawning on the new scale.

---

## User Story

As the game system,
I want variant acceptance and scale promotion to be separate backend events with a dedicated `/variant/promote` endpoint,
so that the backend doesn't commit the new scale until the frontend cinematic has completed and new tracks are in position.

---

## Acceptance Criteria

**AC-1 — `accept_variant` no longer mutates primary scale:**
In `services/game_engine.py`, `accept_variant()` method:
- Still validates session, active_variant, active_window, deadline, trigger_midi (same as today)
- Sets `variant.state = "ACCEPTED"` (new state, replaces `SWITCH_TRIGGERED`)
- Sets `active_window.state = "ACCEPTED"`
- Records in `variant_history` with decision `"ACCEPTED"`
- Does NOT modify: `root_midi`, `notes`, `ascending_note_count`, `base_fret`, `num_lanes`, `current_track`, `current_note_index`, `total_notes_played`, `speed_multiplier`, `scale_passes_completed`, `last_pass_direction`
- Does NOT set `active_variant = None` (variant stays active until promote/dismiss)
- Does NOT set `active_window = None`
- Returns lightweight response:
  ```json
  {
    "success": true,
    "variant_id": "v-abc123-2",
    "state": "accepted"
  }
  ```

**AC-2 — New `POST /game/{session_id}/variant/promote` endpoint:**
Route: `POST /game/{session_id}/variant/promote`
Request body: `{}` (empty — variant id is inferred from active session state)
Validates:
- Session exists and status is `running`
- `active_variant` exists and `active_variant.state === "ACCEPTED"` (reject if still in ACTIVE/SPAWNING — promote must come after accept)
On success, performs the scale swap (all the logic currently in `accept_variant`):
- Computes new root_midi, notes, ascending_note_count, base_fret, num_lanes
- Resets `current_track`, `current_note_index`, `total_notes_played`, `speed_multiplier`, `scale_passes_completed`, `last_pass_direction`
- Sets `variant.state = "PROMOTED"`, `active_window.state = "CLOSED"`
- Clears `active_variant = None`, `active_window = None`
- Records in `variant_history` with decision `"PROMOTED"`
Returns full scale data:
  ```json
  {
    "success": true,
    "root_midi": 62,
    "base_fret": 5,
    "num_lanes": 6,
    "notes": [...],
    "ascending_note_count": 8,
    "current_note_index": 1
  }
  ```

**AC-3 — `accept_variant` error paths unchanged:**
- `session_not_found`, `no_active_variant`, `window_expired`, `wrong_midi` → same errors as today
- New: if variant is already in `ACCEPTED` state → return `{"success": false, "error": "variant_already_accepted"}`

**AC-4 — `promote_variant` error paths:**
- `session_not_found` → 404 error
- `game_not_running` → reject
- `no_active_variant` → `{"success": false, "error": "no_active_variant"}`
- Variant state is not `ACCEPTED` → `{"success": false, "error": "variant_not_accepted"}`
- Promote is idempotent-safe: if variant already PROMOTED (cleared), return success with current scale state

**AC-5 — `game_client.js` gains `promoteVariant()` method:**
```js
async promoteVariant() {
  const r = await fetchJson(`${API}/game/${this.sessionId}/variant/promote`, { method: 'POST' });
  return r;
}
```

**AC-6 — `promoting → active` handler calls `/variant/promote`:**
In `main.js`, the default promoting→active handler (6-4's AC-6) replaces its inline state swap with:
1. Call `gameClient.promoteVariant()` → on success, use response data
2. Update `waveScheduler.resumeQueueing(resp.notes, resp.current_note_index)`
3. Update `run.sequence = resp.notes`, `run.cursor = resp.current_note_index`
4. Update `ascendingNoteCount`, `rootNote`, `apexNote`
5. `scene.setWaves([], performance.now())`
6. `safeZoneRenderer.reset()`
7. `setTransitionPhase('active', ctx)`
8. Variant state cleanup

On promote failure: log error, set phase to `idle` (recovery path — dismiss variant, resume outgoing scale queuing).

**AC-7 — Poll responses serve correct scale during transition:**
Between accept and promote, `GET /game/{id}` returns the outgoing scale's state unchanged. After promote, returns the new scale's state. The `active_variant` field in poll response shows the variant (with state `ACCEPTED`) during the transition — frontend can use this to verify promote eligibility.

**AC-8 — Existing tests updated, new tests added:**
- Python: Update `test_variant.py` and `test_variant_flow.py` — `accept_variant` response shape changed (no longer returns notes/base_fret/etc.)
- Python: New `test_variant_promote.py` — promote success, promote-before-accept rejection, promote-after-dismiss rejection, promote idempotency
- JS: Update `game-client-variant.test.js` — add `promoteVariant` method test
- pytest: existing tests updated, new tests added. Target: no regressions.
- Playwright: 74/74 pass (frontend changes in 6-2 through 6-4 already handle the new promote flow)

---

## Tasks / Subtasks

- [x] **Task 1 — Refactor `accept_variant` (AC-1, AC-3)**
  - In `services/game_engine.py`, modify `accept_variant()`:
    - Remove scale-swap logic (root_midi, notes, base_fret, num_lanes, current_track, speed_multiplier resets)
    - Keep validation: session check, active_variant/active_window check, deadline check, midi match
    - Set `variant.state = "ACCEPTED"`, `active_window.state = "ACCEPTED"`
    - Return: `{"success": true, "variant_id": variant.variant_id, "state": "accepted"}`
    - Keep `active_variant` and `active_window` on the session (not cleared)
  - Add guard: if `variant.state == "ACCEPTED"` → return `{"success": false, "error": "variant_already_accepted"}`

- [x] **Task 2 — Extract scale-swap logic into shared helper (AC-2 preparation)**
  - Extract the scale-swap logic from old `accept_variant` into a private method `_commit_variant_swap(session, variant, instrument)`:
    - Computes new root_midi, notes, ascending_note_count, base_fret, num_lanes
    - Updates `current_track`, `current_note_index`, `total_notes_played`, `speed_multiplier`, etc.
    - Sets `variant.state = "PROMOTED"`
    - Records in `variant_history`
    - Clears `active_variant` and `active_window`
    - Returns the full scale data dict
  - This is called by the new `promote_variant` method.

- [x] **Task 3 — Add `promote_variant` method to `GameEngine` (AC-2, AC-4)**
  - Add `promote_variant(session_id: str) -> dict`:
    - Validate session, status, active_variant
    - Check `active_variant.state == "ACCEPTED"` → reject if not
    - Call `_commit_variant_swap(session, variant, instrument)`
    - Return full response with `success`, `root_midi`, `base_fret`, `num_lanes`, `notes`, `ascending_note_count`, `current_note_index`
  - Idempotency: if variant already PROMOTED (active_variant is None), return current session state as success

- [x] **Task 4 — Add route for `POST /variant/promote` (AC-2)**
  - In `routes.py` (or wherever variant routes are defined), add:
    ```python
    @router.post("/game/{session_id}/variant/promote")
    async def promote_variant(session_id: str):
        result = engine.promote_variant(session_id)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result)
        return result
    ```

- [x] **Task 5 — Add `promoteVariant()` to `game_client.js` (AC-5)**
  - In `static/game/game-client.js` (or wherever `acceptVariant`/`proposeVariant` is defined), add:
    ```js
    async promoteVariant() {
      return fetchJson(`${API}/game/${this.sessionId}/variant/promote`, { method: 'POST' });
    }
    ```

- [x] **Task 6 — Wire promoting→active handler to call promoteVariant (AC-6)**
  - In `main.js`, update the promoting→active transition handler:
    - Replace inline state swap with `gameClient.promoteVariant()` call
    - On success: apply response data to scheduler, run, scene
    - On failure: log, reset to idle phase, resume outgoing scale queuing
    - `setTransitionPhase('active', ctx)` after successful promote

- [x] **Task 7 — Update Python tests (AC-8)**
  - Update `tests/contract/test_variant.py`:
    - `accept_variant` response now returns `{success, variant_id, state}` instead of full scale data
    - Add test: accept then promote → get full scale data
  - Update `tests/integration/test_variant_flow.py`:
    - Full flow: propose → accept → promote → verify new scale active
  - New `tests/contract/test_variant_promote.py`:
    - Promote without accept → rejected
    - Promote after dismiss → rejected  
    - Promote after accept → success with full data
    - Double promote → idempotent (second call returns current session state)
  - **Contract test for poll during ACCEPTED→PROMOTED gap (AC-7):**
    - Accept variant → poll `GET /game/{id}` → assert `root_midi` and `base_fret` unchanged (outgoing scale still served)
    - Promote variant → poll `GET /game/{id}` → assert `root_midi` and `base_fret` match new scale
    - Verify `active_variant.state === 'ACCEPTED'` in poll response during gap
  - **Accept-failure scheduler recovery unit test:**
    - Extend `tests/unit/js/WaveScheduler.test.js`: `pauseQueueing()` → simulate error → `resumeQueueing(currentNotes, cursor)` → assert `_waves` contains pre-pause waves AND `_nextWaveNoteIndex` matches the passed cursor. This covers AC-6 error recovery at the scheduler level.

- [x] **Task 8 — Full test suite parity (AC-8)**
  - `.venv/Scripts/python.exe -m pytest` → all pass (updated + new tests)
  - `npx playwright test` (chromium) → 74/74 pass

---

## Dev Notes

### Files to modify

- `services/game_engine.py` — `accept_variant()` refactor, `_commit_variant_swap()` extraction, `promote_variant()` new method
- `routes.py` — new `POST /game/{session_id}/variant/promote` route (or wherever variant routes live)
- `static/game/main.js` — promoting→active handler calls `promoteVariant()`
- `static/game/game-client.js` — `promoteVariant()` method (or wherever variant client methods are defined)
- `tests/contract/test_variant.py` — update accept_variant assertions
- `tests/integration/test_variant_flow.py` — add promote step
- `tests/contract/test_variant_promote.py` — NEW

### Files to read (do not modify)

- `services/game_engine.py` — full `accept_variant()` (lines 443-527), `_build_full_scale_notes()`, `_find_root_for_highest()`, `GameSession` model
- `services/schemas.py` — `VariantTrackSet` model (add `ACCEPTED` and `PROMOTED` to state enum/literal; the old `SWITCH_TRIGGERED` and `SWITCHED` states are replaced)
- `services/game_routes.py` or `routes.py` — existing variant route patterns
- `_bmad-output/implementation-artifacts/6-4-post-bend-breather-and-new-scale-track-approach.md` — promoting→active handler context

### ACCEPTED vs SWITCH_TRIGGERED

Today `accept_variant` sets `variant.state = "SWITCH_TRIGGERED"` then immediately does the scale swap and sets `"SWITCHED"`. 6-5 replaces this with:
- `accept_variant` → `variant.state = "ACCEPTED"` (stays on session)
- `promote_variant` → `_commit_variant_swap` → `variant.state = "PROMOTED"` (cleared from session)

The state transitions become: `SPAWNING → ACTIVE → ACCEPTED → PROMOTED` (or `DISMISSED` / `TIMEOUT` on abort paths). Update `VariantTrackSet.state` in `services/schemas.py` accordingly — remove `SWITCH_TRIGGERED` and `SWITCHED`, add `ACCEPTED` and `PROMOTED`.

### ctx.resp shape change after 6-5

After 6-5, `ctx.resp` from `accept_variant` contains only `{success: true, variant_id: "...", state: "accepted"}`. Any consumer of `ctx.resp` beyond the `accepted` phase must switch to the promote response (which contains the full scale data: `notes`, `base_fret`, `num_lanes`, etc.). The 6-5 promoting→active handler does this by calling `gameClient.promoteVariant()` and using its response instead of `ctx.resp`. Verify no downstream code references `ctx.resp.notes` or `ctx.resp.base_fret` after the `accepted` phase.

### Scale-idempotency of promote

If the frontend calls promote twice (race condition, retry logic), the second call finds `active_variant = None` (already cleared). Return current session data as success — the scale is already swapped, so the response still contains valid data for the frontend to apply.

### Extracting `_commit_variant_swap` 

The logic currently in `accept_variant` lines ~465-518 (LEFT/RIGHT branching, notes recomputation, base_fret/num_lanes, session state updates) moves to `_commit_variant_swap`. `accept_variant` keeps only validation + state marking. This DRYs the scale-swap logic and keeps it in one place called only by `promote_variant`.

### References

- Epic 6 spec — [Source: _bmad-output/planning-artifacts/epics.md#Epic 6]
- Story 6-4 — [Source: _bmad-output/implementation-artifacts/6-4-post-bend-breather-and-new-scale-track-approach.md]
- Current accept_variant — [Source: services/game_engine.py#L443-L527]
- VariantTrackSet schema — [Source: services/schemas.py]
- Variant routes — [Source: routes.py]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- schemas.py: `VariantStateLit` — replaced `SWITCH_TRIGGERED`/`SWITCHED` with `ACCEPTED`/`PROMOTED`; `WindowStateLit` — replaced `SWITCHED` with `ACCEPTED`
- game_engine.py: `accept_variant` refactored — validation only, sets `variant.state="ACCEPTED"`, returns `{success, variant_id, state}`; variant/window NOT cleared
- game_engine.py: `_commit_variant_swap` extracted — contains full scale-swap logic (LEFT/RIGHT branching, notes, fret geometry, session resets)
- game_engine.py: `promote_variant` added — validates ACCEPTED state, calls `_commit_variant_swap`, idempotent if no active_variant
- game_router.py: `POST /{session_id}/variant/promote` route added
- game-client.js: `promoteVariant()` method added
- main.js: promoting→active handler now calls `gameClient.promoteVariant()` async; failure path resumes outgoing scheduler and sets phase to `idle`
- test_variant.py: `test_accept_switches_root_and_regenerates_notes` replaced with `test_accept_returns_lightweight_confirmation`, `test_accept_then_promote_switches_root_and_regenerates_notes`, `test_accept_already_accepted_rejected`
- test_variant_flow.py: `test_full_variant_accept_flow_via_http` updated to call promote; `test_poll_after_accept_clears_variant` renamed and updated to verify ACCEPTED gap + promote
- test_variant_promote.py: NEW — 8 tests covering promote success, error paths, idempotency, history, AC-7 poll gap
- test_game_engine.py: LEFT/RIGHT accept unit tests updated to call promote_variant after accept
- WaveScheduler.test.js: added promote-failure recovery test for resumeQueueing with cursor
- 81 Python tests pass; 219 JS tests pass

### File List

- `services/schemas.py`
- `services/game_engine.py`
- `services/game_router.py`
- `static/game/main.js`
- `static/game/game-client.js`
- `tests/contract/test_variant.py`
- `tests/integration/test_variant_flow.py`
- `tests/contract/test_variant_promote.py` (NEW)
- `tests/unit/test_game_engine.py`
- `tests/unit/js/WaveScheduler.test.js`
- `_bmad-output/implementation-artifacts/6-5-backend-variant-promote-endpoint.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-25: Implemented story 6-5 — two-phase backend protocol: accept (lightweight confirmation) + promote (scale swap). New /variant/promote endpoint, promoteVariant() client method, async promoting→active handler.