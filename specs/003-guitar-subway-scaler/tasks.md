---

description: "Task list for Guitar Subway Scaler v4 (note-queue Subway-Surfer + row-grouping)"
---

# Tasks: Guitar Subway Scaler (v4)

**Input**: Design documents from `/specs/003-guitar-subway-scaler/`
**Tests**: TDD per Constitution II.

**v4 scope**: rework `scene.js` from a per-cell cart spawn (v2/v3) to a **row-grouped note-queue** Subway-Surfer layout. Camera locked (no Y motion). Char slides flat (no Y arc). Lanes rendered only for frets in the visible queue.

Backend (v1) + `fretboard.js` + `grid.js` core + `scaleMap.js` already shipped; v4 doesn't change them. `scaleMap.js` kept but unused by scene wiring.

## Phase 1: Setup

- [X] T001 Baseline pytest + vitest green before changes.

## Phase 2: Foundational (no backend change)

- [X] T002 Smoke-check `GET /scales/{id}/notes` still returns the MIDI list the queue builder relies on.

## Phase 3: Grid extensions (US1, US4)

- [X] T003 [P] [US1] Add `QUEUE_DZ` constant + `queueZ(queueIndex)` helper to `static/game/grid.js`; returns `0` for index 0 (no `-0`), `-i * QUEUE_DZ` otherwise.
- [X] T004 [P] [US1] Confirm `cameraFor45Deg(distance, lookAtZ)` still passes its 45°-pitch invariant test in `tests/unit/js/grid.test.js`.

## Phase 4: Scene rewrite (US1 + US2 + US4)

- [X] T005 [US1, US2, US4] Rewrite `static/game/scene.js` to the v4 row-grouped queue model:
  - State `rows: row[] where row = ({fret, stringIdx, mesh} | null)[]` plus `cursorInRow`.
  - `setQueue(rowsInput)` replaces the queue atomically.
  - `advanceQueue()` consumes the cart at `rows[0][cursorInRow]`; if the row has more carts, advance `cursorInRow` (lateral X tween); otherwise shift rows and tween X+Z (row jump).
  - `appendQueue(position, sameStringAsLast)` extends the last row or starts a new one.
  - Track planks rebuilt from `Set(fret across all visible rows)`; X anchor = lowest visible fret (FR-005).
  - Character tween has `peakY = 0` always (FR-011, SC-005).
  - Keep legacy shims (`setUpcomingNotes`, `jumpToNext`, `lateralLaneChange`, `rowJump`, `setCarts`) as no-ops so older run-state wiring resolves.

## Phase 5: Main wiring (US1, US2, US3)

- [X] T006 [US1, US2] Add to `static/game/main.js`:
  - `buildSequencePositions(notes, inst)`: resolve each note's MIDI to `(string, fret)` via `fretboard.resolve`, threading the previous position.
  - `buildRowIndices(positions)`: group consecutive same-string positions into rows; null positions inherit the previous row index.
  - `refreshSceneQueueFromRun()`: from `run.cursor`, slice positions whose `rowOffset < VISIBLE_ROWS` (default 4) and call `scene.setQueue(rows)`.
- [X] T007 [US1, US2] On `result === 'accepted'`: `scene.advanceQueue()` + `refreshSceneQueueFromRun()` so the scene reflects the new cursor.
- [X] T008 [US3] On instrument swap: `applyInstrument()` calls `scene.setInstrument(inst)` which clears the scene; next run start re-seeds `sequencePositions` via `buildSequencePositions` using the new instrument.

## Phase 6: Polish

- [X] T009 [P] Update `?debug=1` HUD label to show `q=<rowCount> tracks=<plankCount> f=<anchorFret>` from `scene._state()`.
- [X] T010 Run `.venv/Scripts/python.exe -m pytest -q` and `npx vitest run`; backend 20, JS ≥ 54 (pre-existing `audio.test.js` failure documented).
- [ ] T011 Execute every step of `specs/003-guitar-subway-scaler/quickstart.md` against a live host. (Manual.)

## Dependencies

- T003 → T005 (scene depends on `queueZ`).
- T005 → T006 → T007 (main wiring needs the new scene API).
- T008 stands alone after T006.

## MVP

T001 → T002 → T003 → T005 → T006 → T007. Same-string lateral + string-change row-jump both come online in one slice.

## Notes

- Camera is fixed (`cameraFor45Deg(9)` at scene init). Don't mutate `camera.position` anywhere else.
- Character `position.y` only changes during `falling` state, not during gameplay tweens.
- Track planks rebuilt every accept; cheap because their count = distinct frets across ≤ 4 rows (typically ≤ 6 planks).
