# Story 1.4: Implement /game/session-config Endpoint

**Status:** review
**Epic:** 1 — Foundation & Session Setup
**Story ID:** 1.4
**Story Key:** 1-4-implement-game-session-config-endpoint

---

## User Story

As a developer,
I want a `GET /game/session-config` endpoint that returns scale notes with fret/string positions,
So that the JS frontend can initialise the track layout without computing fret positions client-side.

---

## Acceptance Criteria

**AC-1 — Endpoint Route & Response Shape:**
- `GET /game/session-config?scale_id=major&root_midi=65&instrument_id=guitar-standard` returns HTTP 200
- JSON response body: `{ scale_id, root_midi, instrument_id, notes: [{ midi, name, string, fret }], track_count }`
- All field names use `snake_case` (no camelCase at API boundary)
- `notes` array contains all notes in the scale box pattern for the given scale/root/instrument

**AC-2 — Fret Calculation:**
- Fret values computed by existing `tabulator.py` fret formula (not reimplemented)
- Fret calculation verified against existing `tabulator.py` tests (no divergence)
- Each note object includes: `midi` (integer 21-108), `name` (e.g. "C4"), `string` (1-based index), `fret` (0-24)

**AC-3 — Track Count:**
- `track_count` equals the number of distinct frets in the box pattern
- Clamped to range 3–12 (minimum 3 lanes, maximum 12 lanes)
- Example: C major on guitar-standard = 5 frets = track_count: 5

**AC-4 — Error Handling:**
- Unknown `scale_id` → HTTP 404, `{ "error": { "code": "SCALE_NOT_FOUND", "message": "..." } }`
- `root_midi` outside range [21, 108] → HTTP 422, `{ "error": { "code": "INVALID_ROOT", "message": "..." } }`
- Error response shape matches project standard (see architecture error pattern)

**AC-5 — Contract Tests:**
- `tests/contract/test_game_session_config.py` created with contract tests
- Tests validate: valid request → 200 + correct shape, invalid scale → 404, invalid root_midi → 422, all field names snake_case
- All contract tests pass

---

## Developer Context

### What This Story Does

Adds a new FastAPI endpoint to `services/game_routes.py` that:
1. Accepts query parameters: `scale_id`, `root_midi`, `instrument_id`
2. Validates inputs against the Scale and Instrument registries
3. Calls `tabulator.py` to compute fret positions for each note
4. Returns a complete session config that the JS frontend uses to initialize the track

This is a **pure data endpoint** — no mutation, no session state. The frontend can call it multiple times per session (e.g., when user changes scale before starting, or during variant acceptance).

### Why This Endpoint Exists

The frontend (JS) needs to know fret/string positions for every note in a scale to render the 3D track geometry. Rather than:
- Hardcoding positions in JS (unmaintainable, doesn't sync with backend scales)
- Computing fret positions in JS (duplicate logic, harder to debug)

We compute positions server-side using the authoritative `tabulator.py` logic, then return them as JSON.

### Architecture Compliance

From architecture.md:
- All API boundaries use `snake_case` field names
- Error response shape: `{ "error": { "code": "...", "message": "..." } }`
- Endpoint is stateless (no session context needed)
- Fret computation delegated to existing `tabulator.py` (verified against tests)

### No Wiring Yet

This story creates the endpoint. **Story 1.6 (Setup UI)** will wire the frontend to call it. **Story 3.1 (SceneManager)** will use the response to initialize track geometry. This story is just the backend API.

### Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `services/game_routes.py` | MODIFY | Add GET /game/session-config endpoint |
| `tests/contract/test_game_session_config.py` | CREATE | Contract tests for endpoint |

---

## Acceptance Criteria Template

See the epics.md file (Story 1.4) for the full AC specification above.

---

## Definition of Done

- [x] GET /game/session-config endpoint implemented in services/game_routes.py
- [x] Endpoint accepts query params: scale_id, root_midi, instrument_id
- [x] Validates scale_id against SCALES registry → 404 if not found
- [x] Validates root_midi in range [21, 108] → 422 if out of range
- [x] Calls tabulator.py to compute fret/string positions (not reimplemented)
- [x] Response shape: { scale_id, root_midi, instrument_id, notes: [...], track_count }
- [x] All field names snake_case
- [x] track_count computed as distinct frets in box pattern, clamped 3-12
- [x] tests/contract/test_game_session_config.py tests created and all pass
- [x] Error responses match project standard
- [x] `rtk pytest` runs with 0 new failures

---

## Dev Agent Record

### Implementation Plan

1. Add GET endpoint to services/game_routes.py
2. Validate inputs (scale_id exists, root_midi in range)
3. Call tabulator.py to compute fret positions
4. Compute track_count from distinct frets
5. Return JSON response
6. Create contract tests
7. Run tests to verify

### Completion Notes

**Red Phase:** 7 contract tests existed with skip decorators. Removed decorators to enable red-phase test run.

**Green Phase:** Implemented GET /game/session-config endpoint in services/game_router.py (actually game_router.py, not game_routes.py) with:
- Query params validation: scale_id (must exist in SCALES), root_midi (must be 21-108), instrument_id (must exist in INSTRUMENTS)
- Tabulator integration: calls encode_scale(scale, root_note, instrument.tuning) to get fret/string pattern
- Response shape: snake_case fields (scale_id, root_midi, instrument_id, notes[], track_count)
- Notes array: Each note has midi, name, string, fret from scale intervals + pattern
- Track count: Distinct frets clamped to [3, 12]
- Error handling: 404 for unknown scale, 422 for invalid root_midi, project standard error shape

**Refactor Phase:** Code is minimal and maintainable - no further refactoring needed. Imports are clean, logic is straightforward, follows existing patterns.

**Testing:** All 7 contract tests pass. Full regression suite: 62 tests pass (7 new + 55 existing). No regressions.

---

## File List

- `services/game_router.py` (MODIFIED) — Added GET /game/session-config endpoint with Tabulator integration
- `tests/contract/test_game_session_config.py` (MODIFIED) — Removed skip decorators from 7 ATDD tests

---

## Change Log

- 2026-05-21: Story created. Endpoint specification scaffolded per architecture.md.
- 2026-05-21: Story 1.4 implemented. GET /game/session-config endpoint added with full contract test coverage. All 7 tests passing, 62 total tests pass (no regressions).
