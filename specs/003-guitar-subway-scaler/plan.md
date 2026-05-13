# Implementation Plan: Guitar Subway Scaler

**Branch**: `003-guitar-subway-scaler` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-guitar-subway-scaler/spec.md` (v4 — note-queue Subway-Surfer + row-grouping by string)

## Summary

Classic Subway-Surfer scene viewed at a fixed 45° top-down camera. Lanes = frets used by the visible queue (log-spaced X). Rows along the Z axis represent runs of consecutive same-string notes from the upcoming sequence; each row holds one cart per note in that string-run. The character sits at the front row on the lane of the next-due note, slides laterally within a row on same-string accept, and row-jumps onto the next row on string change. Camera is fixed; character has no Y arc during normal play.

Backend unchanged from v1 (instrument registry + extended `PlayerSettings`). v2's scale-cell filtering / `scaleMap.js` is no longer wired into the scene — the queue is built from the run's expected note sequence resolved to `(string, fret)` positions, then grouped by string runs.

## Technical Context

**Language/Version**: Python 3.10+ (backend), ES2020+ JS (frontend).
**Primary Dependencies**: FastAPI + Pydantic (backend); Three.js + Web Audio API (frontend). No new dependencies.
**Storage**: `data/settings.json` (unchanged from v1).
**Testing**: pytest + FastAPI `TestClient`; Vitest for `fretboard.js`, `grid.js`. Scene module is integration-tested via manual quickstart.
**Target Platform**: Slopsmith host's embedded browser.
**Performance Goals**: Tween begins ≤ 50 ms after accept (SC-002). 60 fps with ≤ 4 visible rows × handful of frets.
**Constraints**: Camera fixed (no Y motion). Carts within a row never share a lane. Routes stay under `/api/plugins/subway-scaler/`.
**Scale/Scope**: 2 instruments, fret range 0–24, visible queue = 4 rows ahead.

## Constitution Check

- **I. Modular Design** — PASS. `services/instruments.py` (backend data), `static/game/fretboard.js` (pure resolver), `static/game/grid.js` (pure geometry: laneX, queueZ, cameraFor45Deg), `static/game/scene.js` (only WebGL touchpoint), `static/game/main.js` (wiring + row grouping).
- **II. Test-Driven Development** — PASS for pure modules. End-to-end audio + 3D is manual quickstart (inherited deviation).
- **III. Independent User Stories** — PASS. US1 (lateral within row), US4 (relevant-only lanes), US2 (row jump), US3 (instrument swap).
- **IV. Consistent API Design** — PASS. No new endpoints in v4.
- **V. Performance and Simplicity** — PASS. Row grouping is one linear pass over `sequencePositions`. Scene rebuilds visible rows on each accept; bounded by `VISIBLE_ROWS × max-cells-per-row`.

## Project Structure

### Documentation (this feature)

```text
specs/003-guitar-subway-scaler/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
routes.py                # registers instruments_router (shipped)
services/
├── instruments.py       # shipped
├── instruments_router.py# shipped
├── schemas.py           # Instrument + extended PlayerSettings (shipped)
├── settings.py          # validates instrumentId (shipped)
└── ...                  # scales*, settings_router unchanged

static/game/
├── fretboard.js         # shipped: pure MIDI → (string, fret) resolver
├── grid.js              # shipped + extended: laneX, rowZ (legacy), queueZ, QUEUE_DZ, cameraFor45Deg
├── scaleMap.js          # shipped (no longer wired into scene; kept for possible HUD/debug use)
├── scene.js             # v4: Subway-Surfer queue, row-grouped, fixed camera, no Y arc
├── main.js              # v4: buildSequencePositions → buildRowIndices → refreshSceneQueueFromRun
└── ...                  # audio.js, runState.js, notes.js, yin.js unchanged

tests/
├── contract/test_instruments.py     # shipped
├── contract/test_settings_*.py      # shipped
├── integration/test_settings_flow.py
└── unit/js/
    ├── fretboard.test.js            # shipped
    ├── grid.test.js                 # shipped (incl. cameraFor45Deg)
    └── scaleMap.test.js             # shipped (module unused by scene but pure tests still pass)
```

**Structure Decision**: Single-plugin layout. `scaleMap.js` and its tests are retained for the case where a HUD or future "show all fingerings" mode wants them; the scene wiring no longer depends on the module. The visible-queue logic lives entirely in `main.js`, leaving `scene.js` purely a renderer for whatever rows it is handed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Manual quickstart covers audio + 3D end-to-end. | Real microphone + WebGL animations can't be exercised in CI without a harness larger than the feature itself. | Pure-JS units cover resolver and grid geometry deterministically; integration relies on manual verification. |
| `scene.js` has been rewritten three times (v1 → v2 → v4) during this feature's iteration. | Each rewrite reflects a substantive change to the visual model (per-lane scenery pool → scale-only cells → note-queue Subway-Surfer). Layering would have left dead branches. | Toggle-able legacy models would double the maintenance surface; no historical model is a supported configuration. |

## Post-Phase-1 Constitution Re-check

Design still satisfies all five principles. No new dependencies; no new endpoints; resolver and grid math remain pure. Row-grouping is a single linear pass.
