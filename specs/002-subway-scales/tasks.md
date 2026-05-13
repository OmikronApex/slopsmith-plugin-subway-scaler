---
description: "Task list for Subway Scales feature implementation"
---

# Tasks: Subway Scales

**Input**: Design documents from `/specs/002-subway-scales/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included per constitution principle II (TDD). Backend gets pytest contract/integration tests; pure-JS modules get Vitest unit tests. Browser end-to-end (audio + 3D) is covered by the manual quickstart, per Complexity Tracking in plan.md.

**Organization**: Tasks are grouped by user story (P1 → P2 → P3) so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: `US1`, `US2`, `US3` — maps to the spec's user stories
- All paths are relative to repo root

## Path Conventions

Per plan.md: single-plugin layout extending the existing `routes.py`, `screen.html`, `screen.js`. Backend modules under `services/`, frontend modules under `static/game/`, tests under `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding for backend modules, frontend asset tree, and test runners.

- [X] T001 Create directory tree: `services/`, `static/game/`, `static/`, `data/`, `tests/contract/`, `tests/integration/`, `tests/unit/js/` at repo root
- [X] T002 [P] Add `services/__init__.py` as an empty package marker
- [X] T003 [P] Create `requirements-dev.txt` at repo root pinning `pytest` and `httpx` (for FastAPI `TestClient`); document install in a single line at the top of the file
- [X] T004 [P] Create `package.json` at repo root declaring `vitest` as a dev dependency and an `npm test` script that runs `vitest run`
- [X] T005 [P] Create `vitest.config.js` at repo root configured to discover tests under `tests/unit/js/**/*.test.js` in a `node` environment
- [X] T006 [P] Add `.gitignore` entries for `node_modules/`, `__pycache__/`, `.pytest_cache/`, and `data/settings.json` at repo root
- [X] T007 [P] Vendor Three.js as an ES module at `static/game/vendor/three.module.js` (download r160+ build); add a one-line provenance comment at the top noting source URL and version

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend Pydantic schemas, the FastAPI route module wiring, and the JS module skeleton consumed by every user story.

**CRITICAL**: No user story work can begin until Phase 2 is complete.

- [X] T008 Define Pydantic models for the API shapes in `services/schemas.py`: `Scale`, `Note`, `ScaleListResponse`, `ScaleNotesResponse`, `AudioInputSettings`, `PlayerSettings`, `ErrorBody`, `ErrorResponse` (matches `specs/002-subway-scales/contracts/api.md`)
- [X] T009 Implement a single error-response helper `error_response(code: str, message: str, status: int, fields: dict | None = None)` in `services/errors.py` returning a FastAPI `JSONResponse` with the contract's `{ "error": { ... } }` shape
- [X] T010 [P] Add a static-files mount and route registration scaffold in `routes.py`: keep the existing `/api/plugins/subway_scaler/status` handler, mount `static/` at `/plugins/subway_scaler/static`, and add empty router-include slots for the scales and settings routers added in later phases
- [X] T011 [P] Create `tests/__init__.py`, `tests/contract/__init__.py`, `tests/integration/__init__.py` as empty package markers
- [X] T012 [P] Create `tests/conftest.py` exporting a `client` fixture that builds a FastAPI `TestClient` from the plugin's app (importing `routes.py`); also expose a `tmp_settings_path` fixture that points `services.settings` at a per-test temp file via monkeypatch
- [X] T013 [P] Create `static/game/main.js` exporting a single `bootstrap(root)` function that the existing `screen.js` will call; leave the body as a `// TODO US1` placeholder for now
- [X] T014 Update `screen.html` and `screen.js` to import `static/game/main.js` as an ES module and invoke `bootstrap(document.getElementById('subway-scaler-root'))` after DOM ready; add the `<div id="subway-scaler-root">` mount point in `screen.html`

**Checkpoint**: Schemas, error shape, router scaffold, JS bootstrap, and test fixtures are in place. User-story phases can now start in parallel.

---

## Phase 3: User Story 1 — Practice a Scale by Playing Notes in Time (Priority: P1) 🎯 MVP

**Goal**: A learner can pick the hardcoded default (C major, medium, 1 octave), start a run, and have the 3D scene react to real microphone pitch — correct in-time notes jump the character to the next cart, missed notes drop the carts off the cliff.

**Independent Test**: Run the plugin, press Start, play C4–D4–E4–F4–G4–A4–B4–C5 into the microphone, and observe success. Then start again, stay silent on E4, and observe failure with the cliff animation.

### Tests for User Story 1 ⚠️

> Write these tests first and confirm they FAIL before writing the implementation tasks below.

- [X] T015 [P] [US1] Contract test for `GET /api/plugins/subway_scaler/scales` in `tests/contract/test_scales.py` — asserts 200, response matches `ScaleListResponse`, includes `major`, `natural-minor`, and the seven diatonic modes
- [X] T016 [P] [US1] Contract test for `GET /api/plugins/subway_scaler/scales/{scale_id}/notes` in `tests/contract/test_scale_notes.py` — covers 200 happy path (C major, root 60, 1 octave → C4..C5), 404 `scale-not-found`, 422 `invalid-root`, 422 `invalid-octaves`, and the `descending=true` extension
- [X] T017 [P] [US1] Vitest unit test for `static/game/notes.js` in `tests/unit/js/notes.test.js` — asserts `frequencyToMidi(440) === 69`, `midiToName(60) === "C4"`, `midiToFrequency(69) ≈ 440`, and that cents offset is signed and in `(-50, 50]`
- [X] T018 [P] [US1] Vitest unit test for `static/game/scales.js` in `tests/unit/js/scales.test.js` — asserts `expand({intervals:[0,2,4,5,7,9,11,12]}, rootMidi=60, octaves=1) → [60,62,64,65,67,69,71,72]`, two-octave expansion, and descending-pass shape
- [X] T019 [P] [US1] Vitest unit test for `static/game/yin.js` in `tests/unit/js/yin.test.js` — feed synthesized sine buffers at 220, 440, 880 Hz at 48 kHz with a 2048 window; assert detected frequency within ±1 Hz and confidence ≥ 0.8; assert silence input returns `null` frequency
- [X] T020 [P] [US1] Vitest unit test for `static/game/runState.js` in `tests/unit/js/runState.test.js` — drive the state machine through `idle → running → running (cursor++) → succeeded`, and through `running → failed` on deadline expiry; cover `pause/resume` and `abandon`

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement the scale catalog in `services/scales.py`: a `SCALES: dict[str, Scale]` module constant holding major, natural-minor, harmonic-minor, melodic-minor-ascending, the seven diatonic modes, major-pentatonic, minor-pentatonic, and blues, plus `list_scales() -> list[Scale]` and `expand(scale_id, root_midi, octaves, descending) -> list[Note]` with the validations from `contracts/api.md`
- [X] T022 [US1] Add a `services/scales_router.py` exposing the FastAPI router with `GET /scales` and `GET /scales/{scale_id}/notes`, delegating to `services/scales.py` and emitting errors via `services/errors.py`; include the router from `routes.py`
- [X] T023 [P] [US1] Implement `static/game/notes.js` exporting `frequencyToMidi`, `midiToName`, `midiToFrequency`, and `quantize(frequencyHz) -> {midi, name, centsOffset}` per data-model.md §Note
- [X] T024 [P] [US1] Implement `static/game/scales.js` exporting `expand(scale, rootMidi, octaves, descending)` matching the backend expansion rule from data-model.md §ExpectedNote; also export the default catalog fetched lazily via `GET /scales`
- [X] T025 [P] [US1] Implement YIN in `static/game/yin.js` exporting `class YinDetector { constructor({sampleRate, windowSize=2048, threshold=0.1}); process(float32Buffer) -> {frequencyHz|null, confidence} }` per research.md §R1
- [X] T026 [P] [US1] Implement the AudioWorklet processor in `static/game/yin-worklet.js` that instantiates `YinDetector`, runs it every 1024-sample hop, and posts `{frequencyHz, confidence, timestampMs}` messages per research.md §R5
- [X] T027 [P] [US1] Implement the audio pipeline in `static/game/audio.js`: `start(deviceId?) -> Promise<AudioContext>` doing `getUserMedia` with `echoCancellation/noiseSuppression/autoGainControl: false`, loading the worklet, wiring the source → worklet, and exposing an `onDetection(cb)` listener; also `pause()`, `resume()`, `stop()` per research.md §R5 and §R8
- [X] T028 [US1] Implement the run state machine in `static/game/runState.js`: states from data-model.md §Run, a `tick(nowMs)` method that fails the run on deadline expiry, an `onDetection(pitchDetection)` method that applies the 3-frame stability gate (research.md §R3) and advances the cursor on a correct in-tolerance match, and the default-mode pitch-class match (FR-016)
- [X] T029 [P] [US1] Implement the Three.js scene in `static/game/scene.js`: cart, track, character, cliff, queue of upcoming carts; export `createScene(canvas)`, `setUpcomingNotes(notes[])`, `jumpToNext()`, `dropOffCliff()`, `showSuccess()`, and a `render(dt)` loop driven from `requestAnimationFrame`
- [X] T030 [US1] Wire it together in `static/game/main.js`: on `bootstrap(root)`, render a minimal screen with a Start button hardcoded to C major / medium / 1 octave / ascending; on Start, fetch `/scales/major/notes?root_midi=60&octaves=1`, build a `Run`, start `audio.js`, feed detections into `runState.js`, and drive `scene.js` from state transitions; show the current expected note, time remaining bar, and success/fail overlays (FR-009)
- [X] T031 [US1] Handle audio-unavailable cases in `static/game/main.js` per FR-012: catch `getUserMedia` rejections (`NotAllowedError`, `NotFoundError`, device disconnect mid-run) and render a clear error panel instead of starting the run

**Checkpoint**: User Story 1 is independently demoable — fixed default scale, real audio, real 3D, success and failure paths. This is the MVP.

---

## Phase 4: User Story 2 — Choose and Configure a Scale to Practice (Priority: P2)

**Goal**: The player picks any scale family + root note + octave count + difficulty + ascending/descending before starting a run; the expected note sequence and time-per-note reflect the selection. Last-used selections persist across sessions (FR-014).

**Independent Test**: Open the scale picker, select A natural minor / Medium, start a run, confirm the expected sequence is A, B, C, D, E, F, G, A. Switch to Hard and confirm the per-note window is visibly shorter. Reload the host and confirm the selection is pre-populated.

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] Contract test for `GET /api/plugins/subway_scaler/settings` in `tests/contract/test_settings_get.py` — asserts 200 with default body when no file exists, 200 with stored body after a prior `PUT`, and that a corrupt file is overwritten with defaults
- [X] T033 [P] [US2] Contract test for `PUT /api/plugins/subway_scaler/settings` in `tests/contract/test_settings_put.py` — covers 200 happy path, 422 `invalid-settings` with field-level violations for bad `lastDifficulty`, out-of-range `audio.toleranceCents`, unknown `lastScaleId`, and unknown extra fields
- [X] T034 [P] [US2] Integration test in `tests/integration/test_settings_flow.py` — `PUT` settings referencing a real `scale_id` from `GET /scales`, then `GET` settings and confirm round-trip equality
- [X] T035 [P] [US2] Vitest unit test extending `tests/unit/js/runState.test.js` (or new `tests/unit/js/difficulty.test.js`) — assert that `difficultyToTimePerNoteMs({easy, medium, hard})` returns `{4000, 2500, 1500}` per data-model.md §Run

### Implementation for User Story 2

- [X] T036 [P] [US2] Implement settings persistence in `services/settings.py`: `DEFAULTS: PlayerSettings`, `load() -> PlayerSettings` (missing → defaults; corrupt → log + overwrite + defaults), `save(settings: PlayerSettings) -> PlayerSettings`, reading/writing `data/settings.json` relative to the plugin directory; validate `lastScaleId` against `services/scales.SCALES`
- [X] T037 [US2] Add a `services/settings_router.py` exposing `GET /settings` and `PUT /settings`, delegating to `services/settings.py` and emitting `invalid-settings` 422s via `services/errors.py`; include the router from `routes.py`
- [X] T038 [P] [US2] Add a `difficultyToTimePerNoteMs(difficulty)` helper in `static/game/runState.js` (or a new `static/game/difficulty.js` imported by `runState.js` and `main.js`) returning `{easy:4000, medium:2500, hard:1500}`
- [X] T039 [US2] Build the scale picker UI in `static/game/main.js`: dropdown of scale families (populated from `GET /scales`), root-note picker (C..B + octave 2..6), octaves toggle (1/2), ascending+descending checkbox, and difficulty selector (easy/medium/hard); selections feed into the run config built on Start
- [X] T040 [US2] On `bootstrap(root)`, fetch `GET /settings` and pre-fill the picker controls; on Start, `PUT /settings` with the chosen values before starting the run so subsequent sessions resume the same selection (FR-014)
- [X] T041 [US2] Pass `timePerNoteMs` from the picker through `Run` construction in `static/game/runState.js` and visualise the per-note window in the time-remaining bar from T030 so Easy vs Hard is visibly different

**Checkpoint**: Players can now practice any supported scale at any difficulty, and the choice survives a restart. US1's hardcoded path still works because the picker defaults to it.

---

## Phase 5: User Story 3 — Configure Audio Input and Calibrate Detection (Priority: P3)

**Goal**: The player picks the audio input device, sees a live tuner-style readout, and adjusts tolerance (cents), confidence threshold, and strict-octave mode before a run. Switching devices is live.

**Independent Test**: Open Audio Settings, switch to an alternate input device, observe the tuner readout switch immediately, play sustained A4 from a tone generator, and confirm the display shows `A4` with `|cents| ≤ tolerance`. Toggle strict-octave on and confirm an `E5` no longer counts when `E4` is expected.

### Tests for User Story 3 ⚠️

- [X] T042 [P] [US3] Extend `tests/contract/test_settings_put.py` (or add `tests/contract/test_settings_audio.py`) — assert 422 for `audio.confidenceThreshold` out of `[0,1]`, `audio.stabilityFrames` out of `[1,10]`, and `audio.toleranceCents` out of `[1,100]`; assert 200 round-trip preserves the full `audio` block
- [X] T043 [P] [US3] Vitest unit test in `tests/unit/js/runState.test.js` — assert that with `strictOctave=true`, a detection of the right pitch class but wrong octave does NOT advance the cursor, and with `strictOctave=false` it does (FR-016 + data-model.md §ExpectedNote)
- [X] T044 [P] [US3] Vitest unit test in `tests/unit/js/audio.test.js` — assert that `audio.js` exposes an `enumerateInputs()` helper that returns `[{deviceId, label}]` derived from `navigator.mediaDevices.enumerateDevices()` (mocked) filtered to `kind === 'audioinput'`

### Implementation for User Story 3

- [X] T045 [US3] Add `enumerateInputs()` and `switchInput(deviceId)` to `static/game/audio.js` — `switchInput` tears down the current source and reconnects a new one without recreating the worklet, so the tuner readout stays live (research.md §R5)
- [X] T046 [US3] Build the Audio Settings panel in `static/game/main.js`: input device dropdown (from `enumerateInputs()`, labelled with `deviceLabel` from settings as fallback), live tuner readout (note name + cents bar) driven by `audio.onDetection`, tolerance slider (1–100 cents), confidence-threshold slider (0–1), stability-frames stepper (1–10), and a strict-octave toggle
- [X] T047 [US3] Persist audio-settings changes via `PUT /settings` (debounced) and re-read the new tolerance/threshold/stability/strict-octave values in `runState.js` so subsequent detections honour them (FR-005, FR-016)
- [X] T048 [US3] Refuse-to-start guard in `static/game/main.js`: if the player's expected sequence contains notes outside roughly C2..C7, render a warning and block Start (spec edge case "extreme low or high notes")

**Checkpoint**: All three user stories are independently functional. The plugin is feature-complete against the spec.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, pause-on-blur, performance pass, and the manual acceptance gate.

- [X] T049 [P] Auto-pause on window blur in `static/game/main.js` — bind `window.addEventListener('blur', () => runState.pause())` and `'focus'` for resume per research.md §R8 (FR-015 edge case)
- [X] T050 [P] Add an FPS counter overlay (toggleable via `?fps=1`) to `static/game/scene.js` to validate SC-005 during the quickstart
- [X] T051 [P] Tighten YIN performance in `static/game/yin.js` — ensure no per-frame allocations inside `process()` (preallocate the difference and cumulative-mean buffers in the constructor) so each frame stays under 10 ms (plan.md Performance Goals)
- [X] T052 Run the full backend test suite (`pytest tests/contract tests/integration`) and the JS unit suite (`npm test`) and resolve any remaining failures
- [X] T053 Walk through every step of `specs/002-subway-scales/quickstart.md` end-to-end in the host; record pass/fail per section in a short note appended to the bottom of `quickstart.md` (this is the acceptance gate per plan.md Complexity Tracking)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Phase 1 — BLOCKS all user stories
- **User Stories (Phases 3–5)**: each depends only on Phase 2; can proceed in parallel by separate developers
- **Polish (Phase 6)**: depends on whichever user stories are in scope for the release

### User Story Dependencies

- **US1 (P1)**: depends only on Phase 2. Independently testable as the MVP.
- **US2 (P2)**: depends only on Phase 2. Reuses US1's `Run` + scene but defaults make it backwards-compatible.
- **US3 (P3)**: depends only on Phase 2. Touches the same `audio.js` and `runState.js` as US1 — coordinate edits if US1 and US3 are worked in parallel.

### Within Each User Story

- Tests are written first and must FAIL before the matching implementation tasks (constitution II)
- Pure-JS modules (`notes.js`, `scales.js`, `yin.js`) before consumers (`runState.js`, `audio.js`, `main.js`)
- Backend `services/*.py` modules before their FastAPI routers
- Routers before frontend `main.js` work that calls them

### Parallel Opportunities

- All of T002–T007 in Phase 1 are `[P]` — different files, no ordering
- Phase 2: T010–T013 are `[P]`; T008/T009 must land first because they define the shared types
- Phase 3 tests T015–T020 are all `[P]`
- Phase 3 implementation: T021, T023, T024, T025, T026 are `[P]` (different files); T022 depends on T021; T027 depends on T026; T028 depends on T023+T025; T029 has no JS dependencies; T030 depends on T022+T024+T027+T028+T029; T031 depends on T030
- Phase 4 tests T032–T035 are all `[P]`
- Phase 4 implementation: T036 and T038 are `[P]`; T037 depends on T036; T039/T040/T041 are sequential edits to `main.js`/`runState.js`
- Phase 5 tests T042–T044 are all `[P]`
- Phase 5 implementation: T045 unblocks T046; T046 unblocks T047; T048 is independent

---

## Parallel Example: User Story 1 tests

```text
# Launch all US1 tests in parallel (separate files):
T015  tests/contract/test_scales.py
T016  tests/contract/test_scale_notes.py
T017  tests/unit/js/notes.test.js
T018  tests/unit/js/scales.test.js
T019  tests/unit/js/yin.test.js
T020  tests/unit/js/runState.test.js
```

```text
# Then launch the independent US1 module implementations in parallel:
T021  services/scales.py
T023  static/game/notes.js
T024  static/game/scales.js
T025  static/game/yin.js
T026  static/game/yin-worklet.js
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (User Story 1) — the hardcoded-default playable game
4. STOP and VALIDATE: walk quickstart §§1–5 of `specs/002-subway-scales/quickstart.md` (skip the picker, strict-octave, settings, and device-switching sections)
5. Demo as MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → demo the MVP (default scale only)
3. + US2 → demo: arbitrary scales + difficulty + persisted settings
4. + US3 → demo: device picker, live tuner, tolerance + strict-octave
5. + Polish → run the full quickstart end-to-end as the acceptance gate

### Parallel Team Strategy

After Phase 2 lands:

- Dev A → US1 (largest scope, blocks demo)
- Dev B → US2 (settings backend + picker UI; can be merged once US1's `Run` exists)
- Dev C → US3 (audio settings panel; coordinate with Dev A on `audio.js` and `runState.js`)

---

## Notes

- `[P]` = different files, no incomplete prerequisites
- Browser end-to-end (mic + WebGL) is intentionally NOT in the automated test suite; the quickstart in T053 is the acceptance gate, per plan.md Complexity Tracking
- Commit after each task or each small logical group; do not skip pre-commit hooks
- Stop at any checkpoint to validate the current user story standalone before continuing
