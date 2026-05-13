# Implementation Plan: Guitar Subway Scaler

**Branch**: `003-guitar-subway-scaler` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-guitar-subway-scaler/spec.md` (v5 — one cart per row + Rocksmith string colours)

## Summary

Classic Subway-Surfer scene from a fixed 45° top-down camera. Lanes are the distinct frets used by the visible queue (ordered low→high left-to-right). Each upcoming note occupies its own Z row — never more than one cart per row. Cart body is coloured per Rocksmith standard (Red/Yellow/Blue/Orange/Green/Purple for strings 0..5; bass uses the first 4). Cart roof is dark gray. Character slides laterally on accept; queue shifts forward by one row. Camera fixed.

Backend unchanged from v1. The v4 row-grouping logic (`buildRowIndices` in `main.js`) is removed — the queue is now a flat one-to-one mapping of upcoming notes to rows. `scene.js` is simplified accordingly.

## Technical Context

**Language/Version**: Python 3.10+ (backend), ES2020+ JS (frontend).
**Primary Dependencies**: FastAPI + Pydantic (backend); Three.js + Web Audio API (frontend). No new dependencies.
**Storage**: `data/settings.json` (unchanged).
**Testing**: pytest + FastAPI `TestClient`; Vitest for `fretboard.js`, `grid.js`, and the new string-palette helper. Scene is integration-tested via manual quickstart.
**Target Platform**: Slopsmith host's embedded browser.
**Performance Goals**: Tween starts ≤ 50 ms after accept (SC-001). 60 fps with `VISIBLE_ROWS` ≤ 6 carts.
**Constraints**: Camera fixed (no Y motion, FR-002). Exactly one cart per row (FR-003, FR-004). Routes stay under `/api/plugins/subway-scaler/`.
**Scale/Scope**: 2 instruments, fret range 0–24, visible queue = 6 rows.

## Constitution Check

- **I. Modular Design** — PASS. `services/instruments.py` (backend data), `static/game/fretboard.js` (pure resolver), `static/game/grid.js` (pure geometry), **NEW** `static/game/stringPalette.js` (pure: string index → hex colour), `static/game/scene.js` (only WebGL touchpoint), `static/game/main.js` (wiring).
- **II. Test-Driven Development** — PASS for pure modules. New `stringPalette.js` gets a failing Vitest unit first. End-to-end audio + 3D is manual quickstart (inherited deviation).
- **III. Independent User Stories** — PASS. US1 (one cart per row), US2 (string-coded body colour), US3 (fret lane layout) overlap into the v5 MVP; US4 (dark gray roof) and US5 (instrument config) layer on independently.
- **IV. Consistent API Design** — PASS. No new endpoints in v5.
- **V. Performance and Simplicity** — PASS. Queue build is a single linear pass; palette lookup is array indexing.

## Project Structure

### Documentation (this feature)

```text
specs/003-guitar-subway-scaler/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md     # unchanged from v1 (no new endpoints)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
routes.py                # shipped
services/                # shipped (instruments, schemas, settings unchanged from v1)

static/game/
├── fretboard.js         # shipped: pure resolver
├── grid.js              # shipped: laneX, queueZ, cameraFor45Deg, ...
├── stringPalette.js     # NEW: STRING_COLOURS array + colourForString(stringIdx, instrument)
├── scaleMap.js          # shipped, unused by scene (kept as pure module)
├── scene.js             # v5: one cart per row, body colour from palette, dark gray roof
├── main.js              # v5: drop buildRowIndices; flat 1-to-1 note→row mapping
└── ...                  # audio.js, runState.js, notes.js, yin.js unchanged

tests/
├── contract/                        # shipped, unchanged
├── integration/                     # shipped, unchanged
└── unit/js/
    ├── fretboard.test.js            # shipped
    ├── grid.test.js                 # shipped
    ├── scaleMap.test.js             # shipped (pure module still tested)
    └── stringPalette.test.js        # NEW
```

**Structure Decision**: Single-plugin layout. `stringPalette.js` lives next to the other pure JS modules so `scene.js` stays the only WebGL touchpoint. `main.js` drops `buildRowIndices` and `positionRowIdx`; the visible window becomes a simple `sequencePositions.slice(cursor, cursor + VISIBLE_ROWS)` and `scene.setQueue(positions)` takes a flat array again (one row per entry).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Manual quickstart covers audio + 3D. | Microphone + WebGL animations can't run in CI without a harness larger than the feature. | Pure-JS units cover resolver, grid, palette deterministically. |
| `scene.js` rewritten yet again (v4 → v5). | v4's row-grouping is incompatible with v5's "one cart per row" rule; the cart-spawn loop differs. Layering would leave dead branches. | A toggle for v4/v5 would double the surface. |

## Post-Phase-1 Constitution Re-check

Design still satisfies all five principles. No new dependencies; no new endpoints. The new pure module is the only added surface. Linear time complexity.
