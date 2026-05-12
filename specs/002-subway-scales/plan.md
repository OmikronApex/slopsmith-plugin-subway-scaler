# Implementation Plan: Subway Scales

**Branch**: `002-subway-scales` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-subway-scales/spec.md`

## Summary

Deliver a Slopsmith plugin that teaches musical scales through a 3D in-browser game. The player picks a scale, the browser captures microphone audio, a YIN-based pitch detector identifies each note in real time, and a 3D scene animates a character jumping between subway carts on each correct note. Missing the time window drops the carts off a cliff and ends the run. The FastAPI backend stays small: it serves scale definitions, persists last-used settings, and follows the existing plugin route conventions; all audio analysis and rendering run client-side to meet the <100 ms median note-to-jump latency target.

## Technical Context

**Language/Version**: Python 3.10+ (backend), modern JS (ES2020+) in the browser (frontend).
**Primary Dependencies**: Backend — FastAPI, Pydantic (already provided by host). Frontend — Three.js for 3D rendering, Web Audio API (`AudioContext`, `getUserMedia`, `AudioWorkletNode`) for capture and DSP, Tailwind CSS for UI. YIN is implemented in-tree in vanilla JS (no external pitch library) to keep the bundle small and the algorithm tunable.
**Storage**: JSON file under the plugin's working directory for persisted player settings (last scale, difficulty, input device label, strict-octave flag). Scale definitions are static data shipped with the plugin (JSON or Python module).
**Testing**: Backend — pytest with FastAPI's `TestClient` for contract and integration tests. Frontend — Vitest (or equivalent lightweight runner) for pure-JS unit tests of the YIN core and scale/state logic, plus a manual quickstart for end-to-end browser verification (audio + 3D cannot be reasonably automated in CI here).
**Target Platform**: Slopsmith host application; plugin screen rendered in an embedded Chromium-class browser with Web Audio + WebGL 2 available. Backend runs in the host's Python process.
**Project Type**: Slopsmith plugin (single repo). Backend = FastAPI routes module; frontend = static HTML/JS/CSS assets loaded by the host.
**Performance Goals**: Median note-to-jump latency < 100 ms, 95th percentile < 150 ms (SC-001). 60 fps in the 3D scene during a run (SC-005). YIN analysis frame ≤ 10 ms on the target hardware so it fits comfortably inside one audio worklet quantum.
**Constraints**: Pitch detection runs off the main thread (AudioWorklet) so 3D rendering is not stalled by DSP. Plugin must stay lightweight per constitution V (no heavy ML libraries; YIN only). All routes live under `/api/plugins/subway_scaler/` per constitution IV.
**Scale/Scope**: Single-player, single-session, local-only. ~7 scale families × 12 root notes = ~84 scale variants. One active run at a time. Persisted settings file is a few hundred bytes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Modular Design** — PASS. Core game/scale/pitch logic lives in dedicated JS modules (`scales.js`, `yin.js`, `runState.js`, `scene.js`) separate from `screen.js` wiring; backend route handlers stay thin and delegate to a `services/` module for scale data and settings persistence.
- **II. Test-Driven Development** — PASS. Each backend endpoint gets a failing contract test under `tests/contract/` before implementation. Pure-JS units (YIN frequency-to-note mapping, scale expansion, run state machine) get failing unit tests first. End-to-end audio + 3D cannot be feasibly automated; the quickstart serves as the manual acceptance test and is referenced by the relevant tasks — this is the single justified deviation, tracked in Complexity Tracking.
- **III. Independent User Stories** — PASS. The three user stories from the spec map cleanly to independently shippable slices: P1 (play a fixed default scale) is a viable MVP without P2's scale picker or P3's calibration UI.
- **IV. Consistent API Design** — PASS. All new endpoints sit under `/api/plugins/subway_scaler/` and use JSON; error responses follow the standard `{ "error": { "code": ..., "message": ... } }` shape defined in the API contract.
- **V. Performance and Simplicity** — PASS. No backend ML, no audio backend processing, no heavy frontend frameworks. Three.js is the one significant new dependency and is justified by FR-002's 3D scene requirement. YIN is implemented in-tree (no pitch-detection library dependency).

Post-Phase-1 re-check: see end of plan.

## Project Structure

### Documentation (this feature)

```text
specs/002-subway-scales/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # HTTP contract for /api/plugins/subway_scaler/*
└── tasks.md             # Phase 2 output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
plugin.json              # Slopsmith plugin manifest (existing)
routes.py                # FastAPI entry; registers routes from services/
screen.html              # Plugin screen markup (menu + game canvas)
screen.js                # Top-level wiring; loads game/* modules

services/
├── __init__.py
├── scales.py            # Scale definitions + note-sequence expansion
└── settings.py          # Load/save player settings JSON

static/
├── game/
│   ├── main.js          # Game bootstrap, menu ↔ run state
│   ├── runState.js      # Run state machine (idle, running, success, fail, paused)
│   ├── scene.js         # Three.js scene: tracks, carts, character, cliff
│   ├── audio.js         # getUserMedia + AudioWorklet wiring
│   ├── yin-worklet.js   # AudioWorklet running YIN frame-by-frame
│   ├── yin.js           # Pure YIN implementation (also used by unit tests)
│   ├── notes.js         # Pitch ↔ note name + cents mapping
│   └── scales.js        # Mirrors backend scale data for offline UI
└── styles.css           # Tailwind output (or CDN classes inline)

data/
└── settings.json        # Persisted last-used settings (created at runtime)

tests/
├── contract/
│   ├── test_status.py
│   ├── test_scales.py
│   └── test_settings.py
├── integration/
│   └── test_run_flow.py # Backend-only integration (settings + scales together)
└── unit/
    └── js/
        ├── yin.test.js
        ├── notes.test.js
        ├── scales.test.js
        └── runState.test.js
```

**Structure Decision**: Single-plugin layout that extends the existing files (`routes.py`, `screen.html`, `screen.js`, `plugin.json`) rather than introducing a new project boundary. Backend code is grouped under `services/` to satisfy constitution principle I (route handlers stay thin). All game/DSP code lives under `static/game/` so the same JS module graph is loaded by the browser and unit-tested by Vitest. No second project (no separate frontend repo, no separate API service) is needed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| End-to-end run cannot be covered by automated tests; the quickstart is the acceptance gate for the audio + 3D path. | Browser microphone capture and WebGL rendering cannot be exercised reliably in a CI environment without bespoke fixtures that would dwarf the feature itself. | A full headless-browser + synthetic-audio harness would add more code than the plugin under test, conflicting with constitution V (Performance and Simplicity). The pure-JS YIN, note-mapping, scale-expansion, and run-state logic are still unit-tested; only the integration of those modules with `getUserMedia` and Three.js relies on the manual quickstart. |

## Post-Phase-1 Constitution Re-check

After producing research.md, data-model.md, contracts/api.md, and quickstart.md, the design still satisfies all five principles. No new dependencies were introduced beyond those listed in Technical Context. The route inventory in `contracts/api.md` all sits under `/api/plugins/subway_scaler/` with consistent JSON error shape (principle IV). No additional complexity entries are required.
