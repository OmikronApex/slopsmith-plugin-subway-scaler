---

description: "Task list for Guitar Subway Scaler v5 (one cart per row + Rocksmith string colours)"
---

# Tasks: Guitar Subway Scaler (v5)

**Input**: Design documents from `/specs/003-guitar-subway-scaler/`
**Tests**: TDD per Constitution II.

**v5 scope**: rework the visible queue from v4's row-grouping (multiple carts per row) to **one cart per row**, and colour carts using the Slopsmith / Rocksmith standard string palette (Red, Yellow, Blue, Orange, Green, Purple). Roof stays a single dark gray for every cart. Lanes for the visible queue's distinct frets, ascending low→high left-to-right.

Backend (v1) + `fretboard.js` + `grid.js` core already shipped and unchanged in v5. `scaleMap.js` retained as a pure module; not wired into the scene.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelisable (different files, no dependencies on incomplete tasks).
- **[Story]**: US1..US5 per `spec.md`.
- File paths repo-relative.

---

## Phase 1: Setup

- [X] T001 Run `.venv/Scripts/python.exe -m pytest -q` and confirm 20 backend tests still pass before changes.
- [X] T002 Run `npx vitest run` and confirm the baseline JS suite is green (modulo the pre-existing `audio.test.js` failure).

---

## Phase 2: Foundational

**Purpose**: No backend change in v5. Drop the v4 row-grouping helpers so the new flat queue can replace them without dead code.

- [X] T003 Remove `buildRowIndices` and `positionRowIdx` from `static/game/main.js` (and any references) so the file is clean before US1 wiring lands.

**Checkpoint**: Baseline green, dead v4 helpers gone.

---

## Phase 3: User Story 1 - One Cart Per Note (Priority: P1) 🎯 part of MVP

**Goal**: Each upcoming note in the run sequence renders as exactly one cart in its own Z row. No row holds two carts.

**Independent Test**: Vitest unit verifies the queue-building helper returns a 1-to-1 mapping. Manual quickstart §2 verifies 6 rows × 1 cart each on screen.

### Tests for User Story 1

- [X] T004 [P] [US1] Extend `tests/unit/js/grid.test.js` (or a new `tests/unit/js/queue.test.js` if you prefer) with cases asserting that for a flat `positions` array `[p0, p1, p2, ...]`, the visible-queue slice mapped to rows yields exactly one entry per row at `queueZ(i)` for `i = 0..VISIBLE_ROWS-1`.

### Implementation for User Story 1

- [X] T005 [US1] Update `static/game/main.js::refreshSceneQueueFromRun` to build a flat array `sequencePositions.slice(run.cursor, run.cursor + VISIBLE_ROWS)` and pass it to `scene.setQueue(positions)`. Drop any 2D-row construction.
- [X] T006 [US1] Rewrite `static/game/scene.js::setQueue` to take a flat `positions` array (each entry `{stringIdx, fret}` or `null`). Internal state becomes `carts: ({fret, stringIdx, mesh} | null)[]`; cart `i` placed at `(laneX(fret, anchorFret), 0, queueZ(i))`.
- [X] T007 [US1] Rewrite `static/game/scene.js::advanceQueue` to shift the flat array forward by one slot (drop `carts[0]`, remove its mesh, re-place remaining at `queueZ(i)`); character X tweens to the new front cart's lane (X-only, peakY=0).
- [X] T008 [US1] In `static/game/scene.js`, rebuild track planks from `Set(c.fret for c in carts if c)` and anchor X at the lowest visible fret (FR-006, FR-007).

**Checkpoint**: P1 MVP — flat queue, one cart per row, lateral X tween on accept.

---

## Phase 4: User Story 2 - String-Coded Cart Body (Priority: P1) 🎯 part of MVP

**Goal**: Cart body colour reflects `stringIdx` via the Rocksmith standard palette.

### Tests for User Story 2

- [X] T009 [P] [US2] Create `tests/unit/js/stringPalette.test.js` covering: `STRING_COLOURS` has 6 entries in the order Red, Yellow, Blue, Orange, Green, Purple; `colourForString(0, guitar)` returns the Red hex; `colourForString(5, guitar)` returns Purple; `colourForString(3, bass)` returns Orange (within range); `colourForString(5, bass)` clamps to the last valid bass index (Orange) so an unexpected resolver output doesn't crash.

### Implementation for User Story 2

- [X] T010 [P] [US2] Create `static/game/stringPalette.js` exporting `STRING_COLOURS = [0xE53935, 0xFDD835, 0x1E88E5, 0xFB8C00, 0x43A047, 0x8E24AA]` (Red, Yellow, Blue, Orange, Green, Purple) and `colourForString(stringIdx, instrument)` that clamps to `[0, instrument.stringCount - 1]`.
- [X] T011 [US2] In `static/game/scene.js`, lazily instantiate one `MeshStandardMaterial` per palette colour (cache keyed by hex). When a cart spawns, fetch its body material via `colourForString(cart.stringIdx, instrument)`. Pass the active instrument into the scene (e.g. on `setInstrument`); the palette lookup needs the instrument's `stringCount` for clamping.
- [X] T012 [US2] Replace the v4 `cartMat` / `activeCartMat` body materials with the palette-driven materials. The front-row cart can still be visually emphasised by leaving the palette colour as-is plus a small emissive tint on its OWN material instance (cloned with `emissive` set) — do NOT recolour the body away from the string's palette colour.

**Checkpoint**: P1 MVP complete — flat queue + palette-coloured bodies.

---

## Phase 5: User Story 3 - Fret Lane Layout (Priority: P1)

**Goal**: Planks ordered ascending by fret left-to-right, only frets actually used by the visible queue rendered.

### Tests for User Story 3

- [X] T013 [P] [US3] Add a case to `tests/unit/js/grid.test.js` asserting that for an input fret list `[5, 1, 3]`, sorting ascending yields planks at `x` values strictly increasing left-to-right with the lowest fret at `laneX(1, 1) = 0`.

### Implementation for User Story 3

- [X] T014 [US3] In `static/game/scene.js::rebuildTracks`, sort the distinct-fret set ascending before creating planks; anchor X at the lowest fret. (Likely already implemented in v4 — verify and keep.)

**Checkpoint**: Plank ordering verified.

---

## Phase 6: User Story 4 - Dark Gray Roof (Priority: P2)

**Goal**: A single dark gray roof shared by every cart.

### Implementation for User Story 4

- [X] T015 [US4] In `static/game/scene.js`, define one `roofMat = new THREE.MeshStandardMaterial({ color: 0x444444 })` at scene init and use it for every cart's roof. Do not vary per string. (Verify already present from v4 and that no per-string roof override sneaks in.)

**Checkpoint**: Visual uniformity of cart roofs.

---

## Phase 7: User Story 5 - Instrument Configuration (Priority: P3)

**Goal**: Switching instrument between runs uses the correct tuning and palette truncation.

### Tests for User Story 5

- [X] T016 [P] [US5] In `tests/unit/js/stringPalette.test.js`, add cases verifying that for `bass-4-standard` only indices 0..3 are reachable: any `stringIdx > 3` clamps to 3 (Orange). For `guitar-standard`, indices 0..5 are all valid.

### Implementation for User Story 5

- [X] T017 [US5] In `static/game/main.js::applyInstrument`, when the scene's instrument changes, call `scene.setInstrument(inst)` AND, on the next run start, rebuild `sequencePositions` from the new instrument's resolver output. (Already wired in v4; verify and keep.)

**Checkpoint**: Bass mode shows only the first 4 palette colours.

---

## Phase 8: Polish & Cross-Cutting

- [X] T018 [P] Update `?debug=1` HUD overlay in `static/game/main.js` to print the current queue length and lowest visible fret from `scene._state()`.
- [X] T019 Run `.venv/Scripts/python.exe -m pytest -q` and `npx vitest run`; backend 20 pass; JS adds the stringPalette suite without regressing the others.
- [ ] T020 Execute every step of `specs/003-guitar-subway-scaler/quickstart.md` against a live host and tick each pass-criterion. (Manual.)

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup) → no deps.
- Phase 2 (Foundational) → after Phase 1.
- Phase 3 (US1 one-cart-per-row) → after Phase 2.
- Phase 4 (US2 body palette) → can run in parallel with Phase 3 (T010 is `[P]`); T011/T012 depend on Phase 3's scene rewrite.
- Phase 5 (US3 lane order) → folds into Phase 3's scene rewrite.
- Phase 6 (US4 roof) → trivial verification.
- Phase 7 (US5 instrument) → after Phase 4 (palette must exist before clamping logic).
- Phase 8 (Polish) → at the end.

### Parallel Opportunities

- T004 + T009 + T013 + T016 are all `[P]` test additions in different files.
- T010 (`stringPalette.js`) can be written before the scene rewrite — its tests are independent.
- T005/T006/T007/T008 all touch the same two files (`main.js`, `scene.js`) — keep sequential within Phase 3.

### Within Each User Story

- Tests fail before implementation (Constitution II).
- Pure modules (`stringPalette.js`) before scene wiring.
- Scene changes before `main.js` wiring that depends on the new scene API.

---

## Parallel Example: MVP setup

```bash
# Failing tests first (different files):
Task: "Create tests/unit/js/stringPalette.test.js (T009)"
Task: "Extend tests/unit/js/grid.test.js for ascending plank order (T013)"

# Pure modules (no scene dependency):
Task: "Create static/game/stringPalette.js (T010)"
```

---

## Implementation Strategy

### MVP (US1 + US2 + US3)

1. Phase 1 baseline.
2. Phase 2 cleanup.
3. Phase 3 flat-queue scene rewrite + main wiring.
4. Phase 4 palette module + scene materials.
5. Phase 5 ascending plank order verification.
6. **STOP and VALIDATE** quickstart §2–§5.

### Incremental

- Phase 6 (roof verification) and Phase 7 (bass clamping) ship as small follow-ups.
- Phase 8 polish + manual quickstart last.

---

## Notes

- The v4 `buildRowIndices` / `positionRowIdx` machinery in `main.js` is **dead code in v5**. Remove it (T003) rather than leaving toggle-able branches.
- Front-row visual emphasis (US2 implementation): use an emissive clone of the cart's palette colour, NOT a fixed orange override. The body must still read as the string's palette colour at a glance.
- The dark gray roof is `0x444444`. Do not introduce per-string roof tints.
- Camera Y stays constant (no Y motion on the camera object anywhere in the codebase).
