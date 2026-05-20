---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - prds/prd-subway-scaler.md
  - architecture.md
  - ux-design-specification.md
---

# slopsmith-plugin-subway-scaler - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for slopsmith-plugin-subway-scaler, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-001: The system shall provide a session setup screen where the player selects scale, difficulty, and instrument; root note is randomised to fret 5–8 at session start (not player-selectable).

FR-002: The system shall render the fretboard as a 3D perspective track where scale notes appear as string-colored safe zones positioned at the corresponding fret and string lanes.

FR-003: The system shall detect the player's played note in real time via YIN audio detection and move the character to the matching track lane instantly on each correct note detection.

FR-004: The system shall calculate and display a score that increments on each correctly detected note, with a base of 100 points scaled by the current difficulty multiplier.

FR-005: The system shall increase track speed and cart spawn frequency dynamically as the player's score increases, applying a 5% speed multiplier per correct note up to a configurable cap.

FR-006: The system shall end the session when the character occupies a lane that a cart occupies at the same position, triggering a collision animation followed by the game-over overlay.

FR-007: The system shall display sparkle/glow visual feedback on the safe zone when a correct note is detected, fading the safe zone after confirmation.

FR-008: The system shall offer a variant switch at configurable score/loop intervals, presenting a parallel track at a semitone-shifted root note; the player accepts by playing the new root note within a timed decision window, or ignores (no penalty) by letting the timer expire.

### NonFunctional Requirements

NFR-001 (FR-011): The render loop shall maintain 60 fps minimum; the wave queue shall be pruned every frame (10-second lookback); texture scrolling and variant switching shall not cause frame drops.

NFR-002 (FR-012): The plugin shall keep memory usage below 500 MB RAM; old frames shall be pruned from the scene graph and particle effects recycled.

NFR-003 (FR-013): The system shall handle invalid note input (log and ignore), audio device disconnect (auto-pause → reconnect overlay), failed texture load (fallback or visible error), and plugin crash (restart game instance).

NFR-004 (FR-014): The system shall persist session state to `localStorage` and restore it on reconnect; state shall be cleared on clean session end.

NFR-005 (FR-015): The audio detection module shall support professional audio interfaces, USB-MIDI controllers, and Slopsmith's centralized detection API via a pluggable adapter interface.

NFR-006 (FR-016): The system shall persist the player's last-used scale, difficulty, and instrument to `localStorage` key `subway-scaler-settings`; root note is not persisted (always re-randomised). A reset-to-defaults option shall be available.

NFR-007 (C-001): The plugin shall follow the Slopsmith plugin API, avoid external dependencies, and work with both Docker and desktop Slopsmith versions.

NFR-008 (C-003): The plugin shall run in Chrome, Firefox, Edge, and Safari with WebGL support; no WebGL fallback required.

### Additional Requirements

- **No starter template**: The project is an extension of an existing codebase. Epic 1 Story 1 must cover file renames and refactors, not greenfield scaffolding.
- **File renames required**: `runState.js` → `GameState.js`, `audio.js` → `AudioDetector.js` (adapter pattern), `grid.js` → `TrackSystem.js`, `scene.js` → `SceneManager.js`.
- **New JS modules**: `GameLoop.js`, `CartSystem.js`, `DifficultyManager.js` must be created (logic extracted from `game-client.js` and ported from `game_engine.py`).
- **New Python endpoint**: `GET /game/session-config` added to `services/game_routes.py`; response shape validated against `tabulator.py` output before implementation.
- **`game_engine.py` migration**: Existing Python game logic (cart/wave/difficulty) must be ported to `CartSystem.js` and `DifficultyManager.js` — not created from scratch. Stories must reference this migration explicitly.
- **`PHASES` constants**: `GameState.js` exports `PHASES` object with `IDLE`, `PLAYING`, `PAUSED`, `GAME_OVER`, `RESTARTING`; all modules must import and use these constants — never string literals.
- **GameState mutation ownership**: Each `GameState` sub-object is owned by exactly one module; only the owning module writes, all others read-only. See Architecture ownership table.
- **API boundary naming**: All JSON keys at Python↔JS boundaries must use `snake_case`; camelCase keys at the API boundary are forbidden.
- **Error propagation**: All async errors (audio, fetch) propagate to `GameLoop.js` via throw — never silently swallowed in lower modules.
- **JS test location**: `tests/unit/js/` (not `static/game/tests/`). New tests: `GameLoop.test.js`, `CartSystem.test.js`. Existing renames: `grid.test.js` → `TrackSystem.test.js`, `runState.test.js` → `GameState.test.js`.
- **New Python test**: `tests/contract/test_game_session_config.py` for the new `/game/session-config` endpoint.

### UX Design Requirements

UX-DR1: Implement `static/game/ui/tokens.js` as the single source of truth for all design tokens — export JS hex constants for Three.js materials and call `injectTokens()` at app init to derive and inject all CSS custom properties; no hardcoded hex values in any CSS file.

UX-DR2: Implement the Night City palette in `tokens.js`: `color-bg-void` (#0D0D1A), `color-bg-stage` (#1A1A2E), `color-bg-near` (#252538), `color-accent` (#FFB800), `color-text-primary` (#E8E8F0), `color-text-disabled` (#555570), `color-edge` (#08080F).

UX-DR3: Implement Rocksmith string colors in `tokens.js` as `STRING_COLORS`: string 1 #FF3333, string 2 #FFDD00, string 3 #3366FF, string 4 #FF8800, string 5 #33AA33, string 6 #9933CC, string 7 #FF66AA.

UX-DR4: Implement the session setup screen in `static/game/ui/setup.css`: Scale (full-width native `<select>`), Difficulty toggle group (Easy/Medium/Hard), Instrument toggle group (Guitar/Bass), root-randomised context label, and START button. Settings persisted to `localStorage` key `subway-scaler-settings` (Scale, Difficulty, Instrument); root note not persisted.

UX-DR5: Root note shall be randomised to fret 5–8 at session start; the setup form shall show a label "root randomised fret 5–8" and shall NOT include a root note selector.

UX-DR6: Implement the first-wave tutorial: slow the first cart wave and display a brief text cue ("Play [note] on string [N], fret [N]") that fades out after the first correct note is detected. No tutorial screen — all within the gameplay canvas.

UX-DR7: Implement fret labels in neutral grey (`#666680`) at the bottom of each lane. String colors (`STRING_COLORS`) are applied ONLY to safe zone elements — not to lane geometry or labels.

UX-DR8: Implement variant spatial direction convention in `TrackSystem.js`: variant at higher fret appears from the RIGHT of the current track; variant at lower fret appears from the LEFT. Gap width between tracks represents physical hand distance on the neck.

UX-DR9: Implement the RGB-shift glitch overlay entry/exit animation as a pure CSS `@keyframes` in `overlays.css`. Apply to all overlay components (pause, game-over, audio disconnect) with calibrated timing: pause ~250ms entry / ~150ms exit, game-over ~180ms entry / ~100ms exit. Add `@media (prefers-reduced-motion: reduce)` fallback replacing glitch with a simple opacity fade.

UX-DR10: Implement the Pause overlay in `overlays.css`: RESUME primary button (full-width) + "Quit to Menu" tertiary text link (below, no visual weight). RGB-shift glitch entry; Escape key triggers RESUME.

UX-DR11: Implement the Game Over overlay in `overlays.css`: final score display + context line (personal best or delta from last run via `localStorage`), RESTART button (primary, large, `color-accent`), MAIN MENU button (secondary outline, smaller). RGB-shift glitch entry.

UX-DR12: Implement the Audio Disconnect overlay: auto-triggered by `GameLoop.js` on audio error; displays "Audio disconnected — reconnect to resume" message + RESUME primary button.

UX-DR13: Implement the Score Display as an HTML element absolutely positioned top-right over the Three.js canvas with `aria-live="polite"` and a brief `color-accent` pulse animation (~150ms) on each score increment.

UX-DR14: Implement the Decision Window Timer Bar as an HTML element absolutely positioned over the canvas, animated via CSS `width` transition driven by the variant window duration from `DifficultyManager.js`.

UX-DR15: Implement ARIA roles across all HTML surfaces: `role="form"` + `aria-label` on setup, `role="radiogroup"` + `role="radio"` + `aria-checked` on toggle groups, `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on all overlays. Focus trapped in overlays; focus returns to canvas on overlay close.

UX-DR16: Enforce minimum 44×44px touch targets on all interactive elements via padding in `overlays.css` and `setup.css`.

UX-DR17: Vendor a chunky monospace font at `static/game/fonts/` (e.g., Space Mono or JetBrains Mono) and load via `@font-face` in CSS. The same typeface must be used for Three.js canvas text (fret labels, tutorial hint) via canvas texture rendering.

UX-DR18: Implement responsive layout with two breakpoints in `setup.css`: `< 600px` stacks toggle groups vertically and reduces form padding; `≥ 600px` uses default layout. Setup form max-width: 480px, centred. No responsive logic in Three.js scene (only the `resize` handler updates renderer + camera aspect).

### FR Coverage Map

| Requirement | Epic | Notes |
|---|---|---|
| FR-001 | 1 | Session setup, root randomisation, settings persistence |
| FR-002 | 3 | 3D track, safe zone positioning, string color coding |
| FR-003 | 3 | YIN detection, character movement |
| FR-004 | 3 | Score calculation, increment |
| FR-005 | 3 | Speed scaling, cart frequency (CartSystem/DifficultyManager from Epic 2) |
| FR-006 | 3 | Collision detection, game-over phase transition |
| FR-007 | 3 | Sparkle/glow on correct note |
| FR-008 | 5 | Variant offer, timed window, transition |
| NFR-001 | 3 & 5 | 60fps loop; variant no frame drops |
| NFR-002 | 3 | Scene graph pruning, particle recycling |
| NFR-003 | 3 & 4 | Audio error phase in Epic 3; overlay UX in Epic 4 |
| NFR-004 | 1 & 4 | Settings persist in Epic 1; session state/restore in Epic 4 |
| NFR-005 | 3 | Pluggable AudioDetector adapter |
| NFR-006 | 1 | localStorage subway-scaler-settings |
| NFR-007 | 1 | Slopsmith compat, no external deps |
| NFR-008 | 1 | Browser matrix verification |
| UX-DR1–5 | 1 | tokens.js, Night City palette, Rocksmith colors, setup screen, root randomisation |
| UX-DR6–7 | 3 | First-wave tutorial, fret label/string color rule |
| UX-DR8 | 5 | Variant spatial direction convention |
| UX-DR9–12 | 4 | RGB-shift glitch, all overlay components |
| UX-DR13 | 3 | Score display (live during gameplay) |
| UX-DR14 | 5 | Decision window timer bar |
| UX-DR15–16 | 4 | ARIA roles, touch targets |
| UX-DR17 | 1 | Vendored font (needed at first render) |
| UX-DR18 | 1 | Responsive breakpoints (needed at first render) |
| Arch: File renames | 1 | GameState.js, AudioDetector.js, TrackSystem.js, SceneManager.js + test renames |
| Arch: game_engine.py analysis | 2 | Analysis spike before any porting begins |
| Arch: CartSystem.js port | 2 | Port from game_engine.py, unit tested |
| Arch: DifficultyManager.js port | 2 | Port from game_engine.py, unit tested |
| Arch: /game/session-config | 1 | New endpoint + contract test |
| Arch: Pause semantics | 3 | Pausable/resumable via PHASES, required before Epic 4 |
| Arch: Integration test | 3 | session-config → GameState → GameLoop → CartSystem → score |

## Epic List

### Epic 1: Foundation & Session Setup
Player can load the plugin, see a Night City-styled setup screen, configure scale/difficulty/instrument, have their choices persisted, and see a clear error if the game fails to load. All JS files renamed per architecture, GameState.js scaffolded with PHASES constants, spatial direction convention for variants documented in TrackSystem.js scaffold, tokens.js single source of truth wired and tested, `/game/session-config` endpoint live with contract test.
**FRs covered:** FR-001, NFR-003 (setup error path), NFR-006, NFR-007, NFR-008
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR17, UX-DR18

### Epic 2: Game Engine Migration
The existing Python game logic in `game_engine.py` is fully analysed, documented, and ported to `CartSystem.js` and `DifficultyManager.js`. These modules are unit-tested in isolation before any gameplay wiring begins. The rest of the stack can build on them without reverse-engineering Python.
**Arch coverage:** Analysis spike → `/docs/game-engine-analysis.md`, `CartSystem.js`, `DifficultyManager.js`, `CartSystem.test.js`

### Epic 3: Core Gameplay Loop
Player can play a complete session: 3D Night City track renders with string-colored safe zones, notes detected via YIN in real time, character moves, score increments, speed escalates, carts spawn, and collision triggers game over. Game loop is pausable/resumable via GameState phase transitions (required contract for Epic 4 overlays).
**FRs covered:** FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, NFR-001, NFR-002, NFR-005
**UX-DRs covered:** UX-DR6, UX-DR7, UX-DR13

### Epic 4: Session UX & Accessibility
Player gets polished overlay transitions (pause, game-over, audio disconnect) with RGB-shift glitch entry/exit; can restart in under 500ms; plugin meets WCAG 2.1 AA on all HTML surfaces with full keyboard and touch support.
**NFRs covered:** NFR-003, NFR-004 (overlay side)
**UX-DRs covered:** UX-DR9, UX-DR10, UX-DR11, UX-DR12, UX-DR15, UX-DR16

### Epic 5: Variant System
Player can practice neck position shifts via mid-session variant track offers. The parallel track appears from the correct spatial direction (left for lower fret, right for higher fret), a timed decision window counts down visually, and accepting triggers a smooth transition with speed reset as the reward signal.
**FRs covered:** FR-008, NFR-001 (variant no frame drops)
**UX-DRs covered:** UX-DR8, UX-DR14

---

## Epic 1: Foundation & Session Setup

Player can load the plugin, see a Night City-styled setup screen, configure scale/difficulty/instrument, and have their choices persisted. All JS files renamed per architecture, GameState.js scaffolded with PHASES constants, tokens.js single source of truth wired and tested, `/game/session-config` endpoint live with contract test.

### Story 1.1: Rename and Scaffold JS Module Files

As a developer,
I want all JS modules renamed to their architectural names and new stub modules created,
So that the codebase structure matches the architecture document and all future epics build on known module paths.

**Acceptance Criteria:**

**Given** the existing JS files in `static/game/`
**When** the rename and scaffold task is complete
**Then** `runState.js` → `GameState.js`, `audio.js` → `AudioDetector.js`, `grid.js` → `TrackSystem.js`, `scene.js` → `SceneManager.js` (files moved, no logic changes)
**And** `GameLoop.js`, `CartSystem.js`, `DifficultyManager.js` exist as empty ES module stubs (`export default class` with empty constructor)
**And** `main.js` import paths updated to reflect all new file names
**And** no references to old file names remain in the codebase

**Given** the existing JS test files in `tests/unit/js/`
**When** the rename task is complete
**Then** `grid.test.js` → `TrackSystem.test.js`, `runState.test.js` → `GameState.test.js`
**And** all existing tests continue to pass after renames

### Story 1.2: Implement GameState Module with PHASES Constants

As a developer,
I want a structured GameState module that exports the canonical state object and PHASES constants,
So that all game modules share a single authoritative state shape and phase transitions are made safely without string literals.

**Acceptance Criteria:**

**Given** `GameState.js` is imported
**When** the module is loaded
**Then** it exports a `GameState` object with shape: `{ session: { scale, rootMidi, difficulty, instrument }, runtime: { score, speed, phase, currentNote }, scene: { carts: [], tracks: [], character: {} } }`
**And** it exports `PHASES`: `{ IDLE: 'idle', PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'game_over', RESTARTING: 'restarting' }`
**And** `GameState.runtime.phase` initialises to `PHASES.IDLE`

**Given** `tests/unit/js/GameState.test.js`
**When** all tests run
**Then** initial state shape is validated, PHASES values are validated, module exports are validated, and all tests pass

### Story 1.3: Implement Design Token System

As a developer,
I want a single-source-of-truth token module that exports JS hex constants and injects CSS custom properties at init,
So that Three.js materials and HTML overlays use identical colour values with zero CSS/JS drift.

**Acceptance Criteria:**

**Given** `static/game/ui/tokens.js` is loaded and `injectTokens()` is called
**When** the page initialises
**Then** `document.documentElement` has CSS custom properties for the full Night City palette: `--color-bg-void: #0D0D1A`, `--color-bg-stage: #1A1A2E`, `--color-bg-near: #252538`, `--color-accent: #FFB800`, `--color-text-primary: #E8E8F0`, `--color-text-disabled: #555570`, `--color-edge: #08080F`
**And** CSS custom properties for all 7 Rocksmith string colors: `--color-string-1` (#FF3333) through `--color-string-7` (#FF66AA)

**Given** `STRING_COLORS` is imported by a Three.js module
**When** accessed
**Then** it returns JS hex integer values (e.g. `STRING_COLORS[1] === 0xFF3333`)

**Given** `injectTokens()` is called before `requestAnimationFrame()` starts
**When** the first frame renders
**Then** all Three.js materials reference `STRING_COLORS` constants — no hardcoded hex in Three.js material definitions

**Given** any CSS file in `static/game/ui/`
**When** inspected
**Then** no hardcoded hex values exist — all colours use `var(--color-*)` custom properties

### Story 1.4: Implement /game/session-config Endpoint

As a developer,
I want a `GET /game/session-config` endpoint that returns scale notes with fret/string positions,
So that the JS frontend can initialise the track layout without computing fret positions client-side.

**Acceptance Criteria:**

**Given** `GET /game/session-config?scale_id=major&root_midi=65&instrument_id=guitar-standard`
**When** the request is made
**Then** HTTP 200 with JSON body: `{ scale_id, root_midi, instrument_id, notes: [{ midi, name, string, fret }], track_count }`
**And** all field names are `snake_case`
**And** fret values are computed by `tabulator.py`'s existing fret formula, verified against existing tabulator tests
**And** `track_count` equals the number of distinct frets in the box pattern (clamped 3–12)

**Given** an unknown `scale_id`
**When** the request is made
**Then** HTTP 404 with `{ "error": { "code": "SCALE_NOT_FOUND", "message": "..." } }`

**Given** `root_midi` outside range 21–108
**When** the request is made
**Then** HTTP 422 with `{ "error": { "code": "INVALID_ROOT", "message": "..." } }`

**Given** `tests/contract/test_game_session_config.py`
**When** all contract tests run
**Then** valid request → 200 + correct shape, invalid scale → 404, invalid root_midi → 422, snake_case field names — all pass

### Story 1.5: Vendor Font and Setup CSS Foundation

As a developer,
I want a vendored monospace font loaded via `@font-face` and setup.css base styles with responsive breakpoints,
So that the setup screen renders the Night City typographic identity without requiring internet access.

**Acceptance Criteria:**

**Given** a monospace font (e.g. Space Mono) placed at `static/game/fonts/`
**When** `setup.css` is loaded
**Then** `@font-face` declares the font for regular and bold weights
**And** the font is applied to all setup screen elements
**And** no external font CDN URLs exist anywhere in the codebase

**Given** viewport width ≥ 600px
**When** the setup screen renders
**Then** the form container has `max-width: 480px` and is horizontally centred

**Given** viewport width < 600px
**When** the setup screen renders
**Then** toggle groups stack vertically and form padding reduces per the compact breakpoint

### Story 1.6: Session Setup UI and Settings Persistence

As a player,
I want a setup screen where I can select scale, difficulty, and instrument with my choices remembered between sessions,
So that I can configure and start a training session quickly without re-entering settings each visit.

**Acceptance Criteria:**

**Given** the plugin loads for the first time
**When** the setup screen renders
**Then** a Scale selector (full-width native `<select>`) is populated from `GET /scales`
**And** a Difficulty toggle group shows Easy / Medium / Hard (Medium pre-selected)
**And** an Instrument toggle group shows Guitar / Bass (Guitar pre-selected)
**And** a label reads "root randomised fret 5–8"
**And** a START button is present and enabled
**And** no Root Note field exists on the form

**Given** the player selects settings and taps START
**When** START is activated
**Then** a root MIDI value is computed by randomly selecting a fret between 5 and 8 on the lowest instrument string
**And** `{ scale_id, difficulty, instrument_id }` is written to `localStorage` key `subway-scaler-settings`
**And** `root_midi` is NOT written to localStorage

**Given** the plugin loads on a subsequent visit
**When** the setup screen renders
**Then** Scale, Difficulty, and Instrument show the last-saved values

**Given** keyboard navigation on the setup screen
**When** Tab is pressed
**Then** focus moves: Scale → Difficulty group → Instrument group → START
**And** within toggle groups, Arrow keys move between options

### Story 1.7: Handle Session-Config Fetch Failure at Game Start

As a player,
I want to see an error message if the game fails to load after I tap START,
So that I know what went wrong and can try again without being left on a blank screen.

**Acceptance Criteria:**

**Given** the player taps START
**When** `GET /game/session-config` returns a network error or a non-200 response
**Then** the setup screen remains visible (no transition to game canvas)
**And** an error message is displayed below the START button reading "Couldn't load session — check your connection and try again"
**And** the START button is re-enabled so the player can retry
**And** the error message is dismissed automatically when START is tapped again

**Given** the error message is displayed
**When** inspected for accessibility
**Then** it has `role="alert"` so screen readers announce it immediately without requiring focus

---

## Epic 2: Game Engine Migration

The existing Python game logic in `game_engine.py` is fully analysed, documented, and ported to `CartSystem.js` and `DifficultyManager.js`. These modules are unit-tested in isolation before any gameplay wiring begins.

### Story 2.1: Analyse and Document game_engine.py

As a developer,
I want a written analysis of `game_engine.py`'s game loop phases, cart state transitions, and difficulty scaling formula,
So that the Epic 2 porting work starts from a clear map rather than live reverse-engineering.

**Acceptance Criteria:**

**Given** `services/game_engine.py` exists in the codebase
**When** the analysis is complete
**Then** `/docs/game-engine-analysis.md` exists and documents: all cart/wave state transitions with entry/exit conditions, the difficulty scaling formula (speed multiplier per note, cart frequency calculation), the relationship between Python-side game state and the planned JS GameState shape, and any edge cases or implicit assumptions found in the Python logic
**And** any discrepancies between `game_engine.py` and the Architecture document are noted explicitly
**And** the document is reviewed before Story 2.2 begins

### Story 2.2: Implement CartSystem Module

As a developer,
I want a `CartSystem.js` module that handles cart spawning, movement, and collision detection,
So that the core obstacle logic is owned in JS with clear state ownership and is unit-testable in isolation.

**Acceptance Criteria:**

**Given** `CartSystem.js` is initialised with a reference to `GameState`
**When** `CartSystem.update(deltaTime)` is called
**Then** carts in `GameState.scene.carts` advance toward the character by `GameState.runtime.speed * deltaTime`
**And** carts that have passed the character's Z position are removed from `GameState.scene.carts`
**And** `CartSystem.js` is the only module that writes to `GameState.scene.carts` and `GameState.runtime.score`

**Given** a cart occupies the same lane as the character at the character's Z position
**When** `CartSystem.update()` is called
**Then** `GameState.runtime.phase` is set to `PHASES.GAME_OVER`
**And** `CartSystem.js` imports and uses `PHASES` from `GameState.js` — no string literals

**Given** the player's current note matches a lane's safe zone
**When** `CartSystem.update()` is called
**Then** `GameState.runtime.score` increments by `100 * difficultyMultiplier`
**And** the matched safe zone is marked as cleared in `GameState.scene.carts`

**Given** `tests/unit/js/CartSystem.test.js`
**When** all tests run
**Then** cart advancement, collision detection, score increment, and safe zone clearing are each independently tested and pass
**And** the game_engine.py analysis document is referenced to verify parity with the original Python logic

### Story 2.3: Implement DifficultyManager Module

As a developer,
I want a `DifficultyManager.js` module that owns speed and cart frequency scaling,
So that difficulty progression is isolated, testable, and configurable without touching game loop logic.

**Acceptance Criteria:**

**Given** `DifficultyManager.js` is initialised with a starting difficulty level (`easy` / `medium` / `hard`)
**When** `DifficultyManager.tick(true)` is called (correct note detected)
**Then** `GameState.runtime.speed` increases by 5% of the current speed (ported from `game_engine.py` formula)
**And** `GameState.runtime.speed` never exceeds the difficulty-level cap constant
**And** `DifficultyManager.js` is the only module that writes to `GameState.runtime.speed`

**Given** `DifficultyManager.js` is called each frame by `GameLoop.js`
**When** `DifficultyManager.tick(false)` is called (no correct note this tick)
**Then** `GameState.runtime.speed` is unchanged

**Given** a difficulty level of `easy`, `medium`, or `hard`
**When** the session initialises
**Then** `GameState.runtime.speed` is set to the corresponding base speed constant
**And** cart spawn interval is set to the corresponding base interval constant (both ported from `game_engine.py`)

**Given** `tests/unit/js/DifficultyManager.test.js`
**When** all tests run
**Then** speed increment on `tick(true)`, no-op on `tick(false)`, cap enforcement, and per-difficulty initialisation are each independently tested and pass

---

## Epic 3: Core Gameplay Loop

Player can play a complete session: 3D Night City track renders with string-colored safe zones, notes detected via YIN in real time, character moves, score increments, speed escalates, carts spawn, and collision triggers game over. Game loop is pausable/resumable via GameState phase transitions.

### Story 3.1: Implement SceneManager and Three.js Canvas

As a developer,
I want a `SceneManager.js` that owns the Three.js renderer, camera, and scene lifecycle,
So that all rendering concerns are isolated and the canvas fills 100% of the offered viewport at all times.

**Acceptance Criteria:**

**Given** `SceneManager.init(container)` is called with a DOM element
**When** the scene initialises
**Then** a Three.js `WebGLRenderer` is created and appended to `container`
**And** the renderer fills 100% of `container` width and height
**And** a `resize` event handler updates renderer size and camera aspect ratio when the container dimensions change

**Given** `SceneManager.render()` is called
**When** the frame renders
**Then** `SceneManager.js` reads `GameState.scene.*` (read-only) and renders the current scene state
**And** `SceneManager.js` does not write to any `GameState` sub-object

**Given** the Three.js renderer initialises
**When** the first frame renders
**Then** the background colour matches `color-bg-void` (`#0D0D1A`) from `tokens.js`

### Story 3.2: Implement TrackSystem and Safe Zone Rendering

As a developer,
I want a `TrackSystem.js` that builds the 3D perspective track geometry and positions safe zones per session config,
So that the player can see which string/fret to play as lanes scroll toward them.

**Acceptance Criteria:**

**Given** `TrackSystem.init(sessionConfig)` is called with the `/game/session-config` response
**When** the track initialises
**Then** `GameState.scene.tracks` is populated with lane geometry objects, one per note in `sessionConfig.notes`
**And** lane count equals `sessionConfig.track_count`
**And** each lane's material colour matches `color-bg-stage` (`#1A1A2E`)
**And** `TrackSystem.js` is the only module that writes to `GameState.scene.tracks`

**Given** a safe zone is rendered for a note
**When** the safe zone is visible
**Then** its material colour matches `STRING_COLORS[note.string]` from `tokens.js`
**And** fret labels are rendered at the bottom of each lane in neutral grey (`#666680`) using the vendored monospace font via canvas texture
**And** string colours are applied only to safe zone geometry — not to lane surfaces or labels

**Given** the variant spatial direction convention
**When** `TrackSystem.js` is scaffolded
**Then** a constant `VARIANT_DIRECTION` is defined: `{ LOWER_FRET: 'left', HIGHER_FRET: 'right' }` — documented for Epic 5 use, not yet wired to variant logic

### Story 3.3: Implement AudioDetector with YIN Adapter

As a developer,
I want an `AudioDetector.js` that wraps YIN detection behind a pluggable adapter interface,
So that note detection works now via `YinDetector` and can be swapped for `SlopsmithDetector` with no changes to the game loop.

**Acceptance Criteria:**

**Given** `AudioDetector.js` exports a `YinDetector` class that extends `AudioDetector`
**When** `YinDetector.detect()` is called
**Then** it uses the existing `yin.js` / `yin-worklet.js` implementation unchanged
**And** it returns `{ midi, confidence }` or throws `AudioDetectorError` on failure
**And** `YinDetector` does not reference `GameState` directly — it only returns a value

**Given** `AudioDetector.detect()` throws
**When** `GameLoop.js` calls `detect()`
**Then** the error propagates to `GameLoop.js` — it is not silently swallowed in `AudioDetector.js`

**Given** `tests/unit/js/AudioDetector.test.js` (renamed from `audio.test.js`)
**When** all tests run
**Then** the adapter interface is validated, YIN delegation is verified, and error propagation is tested — all pass

### Story 3.4: Implement GameLoop with Phase Management

As a developer,
I want a `GameLoop.js` that owns the `requestAnimationFrame` tick, audio detection, and game phase transitions,
So that the game runs at 60fps, phase changes are centralised, and the loop is pausable/resumable via `GameState.runtime.phase`.

**Acceptance Criteria:**

**Given** `GameLoop.start()` is called with `GameState.runtime.phase === PHASES.IDLE`
**When** the loop starts
**Then** `GameState.runtime.phase` transitions to `PHASES.PLAYING`
**And** each tick calls: `AudioDetector.detect()` → update `GameState.runtime.currentNote` → `CartSystem.update(deltaTime)` → `DifficultyManager.tick(noteDetected)` → `SceneManager.render()`, where `noteDetected` is `true` when the detected note matched a safe zone this tick
**And** `GameLoop.js` is the only module that writes to `GameState.runtime.currentNote` and `GameState.scene.character`

**Given** `AudioDetector.detect()` throws `AudioDetectorError`
**When** the error is caught by `GameLoop.js`
**Then** `GameState.runtime.phase` transitions to `PHASES.PAUSED`
**And** the render loop continues but the update loop stops

**Given** `GameState.runtime.phase === PHASES.PAUSED`
**When** `GameLoop.resume()` is called
**Then** `GameState.runtime.phase` transitions to `PHASES.PLAYING` and the update loop restarts

**Given** `GameState.runtime.phase === PHASES.GAME_OVER`
**When** `CartSystem.js` sets this phase
**Then** `GameLoop.js` detects the phase on the next tick and stops the update loop
**And** the render loop continues so the final scene frame remains visible behind any overlay

**Given** `tests/unit/js/GameLoop.test.js`
**When** all tests run
**Then** phase transitions (idle→playing, playing→paused, paused→playing, playing→game_over) are each independently tested and pass

### Story 3.5: Implement First-Wave Tutorial Hint

As a player,
I want the first cart wave slowed and a brief text cue telling me which note to play,
So that I succeed on my very first note without needing a separate tutorial screen.

**Acceptance Criteria:**

**Given** a new session starts
**When** the first cart wave spawns
**Then** its approach speed is reduced to 50% of the session base speed
**And** a text overlay appears over the track reading "Play [note name] — string [N], fret [N]" (values from `GameState.session`)
**And** the text uses the vendored monospace font rendered to a Three.js canvas texture

**Given** the first correct note is detected
**When** `CartSystem.update()` marks the first safe zone as cleared
**Then** the tutorial text overlay fades out over ~500ms
**And** normal cart speed resumes from the next wave onward
**And** the tutorial hint never reappears for the remainder of the session

### Story 3.6: Implement Score Display

As a player,
I want a persistent score counter visible during gameplay,
So that I can track my progress at a glance without it interrupting my focus.

**Acceptance Criteria:**

**Given** the game canvas is active
**When** the score display renders
**Then** it is positioned top-right, overlaid on the canvas as an HTML element using `var(--color-text-primary)` text
**And** it shows the current `GameState.runtime.score` value
**And** it has `aria-live="polite"` so screen readers announce score changes without interrupting

**Given** `GameState.runtime.score` increments
**When** the score display updates
**Then** the element briefly pulses `var(--color-accent)` for ~150ms then returns to `var(--color-text-primary)`

**Given** the game is in `PHASES.GAME_OVER` or `PHASES.PAUSED`
**When** an overlay is visible
**Then** the score display remains visible behind the overlay backdrop

### Story 3.7: Implement Visual Feedback on Correct Note

As a player,
I want a sparkle/glow effect on the safe zone when I play a correct note,
So that I get immediate confirmation that the game heard my note.

**Acceptance Criteria:**

**Given** the player plays a note that matches the active safe zone's lane
**When** `CartSystem.update()` marks the safe zone as cleared
**Then** a sparkle/glow particle effect plays at the safe zone's Three.js world position for ~300ms
**And** the safe zone geometry fades out over the same ~300ms
**And** the effect uses `STRING_COLORS[note.string]` as its base colour

**Given** a sparkle effect completes
**When** the effect object is removed from the scene
**Then** it is disposed from the Three.js scene graph (geometry and material disposed) — no memory leak

### Story 3.8: Integration Test — Session Config to Score

As a developer,
I want an integration test that exercises the full path from session config through game state to score increment,
So that the plumbing between Epic 1 backend and Epic 3 JS modules is verified before Epic 4 begins.

**Acceptance Criteria:**

**Given** a mock `/game/session-config` response for C major, root MIDI 60, guitar-standard
**When** `main.js` initialises `GameState.session` from the response and runs 3 simulated game ticks with correct note detection
**Then** `GameState.runtime.score` equals `300 * difficultyMultiplier` after 3 ticks
**And** `GameState.scene.carts` reflects the updated cart positions after each tick
**And** `GameState.runtime.phase` remains `PHASES.PLAYING` throughout

**Given** the integration test file at `tests/integration/test_game_loop.js`
**When** all integration tests run
**Then** the session-config → GameState → GameLoop → CartSystem → score path passes end-to-end

---

## Epic 4: Session UX & Accessibility

Player gets polished overlay transitions (pause, game-over, audio disconnect) with RGB-shift glitch entry/exit; can restart in under 500ms; plugin meets WCAG 2.1 AA on all HTML surfaces with full keyboard and touch support.

### Story 4.1: Implement Overlay Container with RGB-Shift Glitch Animation

As a developer,
I want a shared overlay container component with an RGB-shift glitch entry/exit animation,
So that all overlays share a consistent transition that reinforces the retro gaming identity.

**Acceptance Criteria:**

**Given** `overlays.css` is loaded and an overlay enters the DOM with the `overlay--entering` class
**When** the entry animation plays
**Then** the RGB-shift glitch `@keyframes` plays: chromatic aberration split (~30ms), channels converge (~60ms), fully sharp and settled (~200ms total for game-over, ~250ms for pause)
**And** a semi-opaque `var(--color-bg-void)` backdrop covers the full viewport

**Given** the overlay exits with the `overlay--exiting` class
**When** the exit animation plays
**Then** the reverse glitch plays at half the entry duration (~100ms game-over, ~150ms pause)

**Given** the OS `prefers-reduced-motion` setting is enabled
**When** any overlay enters or exits
**Then** the glitch animation is replaced by a simple opacity fade (~200ms) — no rapid visual flicker

**Given** `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` are set on the overlay
**When** the overlay opens
**Then** focus moves to the first focusable element inside the overlay
**And** focus is trapped within the overlay while it is open

### Story 4.2: Implement Pause Overlay

As a player,
I want a pause overlay that appears when the game pauses,
So that I can resume my session or exit cleanly without losing game state.

**Acceptance Criteria:**

**Given** `GameState.runtime.phase` transitions to `PHASES.PAUSED`
**When** `GameLoop.js` detects the phase change
**Then** the pause overlay renders with: heading "PAUSED", RESUME primary button, "Quit to Menu" tertiary text link
**And** the overlay enters with the RGB-shift glitch animation (pause calibration: ~250ms entry)

**Given** the audio disconnect variant
**When** `GameLoop.js` sets phase to `PHASES.PAUSED` due to `AudioDetectorError`
**Then** the heading reads "Audio disconnected — reconnect to resume"
**And** the RESUME button and "Quit to Menu" link are present

**Given** the player activates RESUME (click, tap, or Escape key)
**When** RESUME is triggered
**Then** `GameLoop.resume()` is called → `GameState.runtime.phase` transitions to `PHASES.PLAYING`
**And** the overlay exits with the reverse glitch (~150ms)
**And** focus returns to the canvas

**Given** the player activates "Quit to Menu"
**When** the link is triggered
**Then** the game canvas resets, `GameState` is cleared, and the setup screen is shown
**And** `{ scale_id, difficulty, instrument_id }` from the interrupted session is preserved in `localStorage`

### Story 4.3: Implement Game Over Overlay

As a player,
I want a game-over overlay that shows my final score and lets me restart immediately or return to settings,
So that I can get back into practice with one tap or adjust settings before my next attempt.

**Acceptance Criteria:**

**Given** `GameState.runtime.phase` transitions to `PHASES.GAME_OVER`
**When** `GameLoop.js` detects the phase change
**Then** the game-over overlay renders with: final score (large, `var(--color-accent)`), a context line (personal best or delta from last run via `localStorage`), RESTART primary button (large), MAIN MENU secondary outline button (smaller)
**And** the overlay enters with the RGB-shift glitch animation (game-over calibration: ~180ms entry)

**Given** the player activates RESTART
**When** RESTART is triggered
**Then** `GameState` is reset, `main.js` re-calls `/game/session-config` with same settings and a new randomised root MIDI (fret 5–8)
**And** the game loop restarts — character running within 500ms of the button tap
**And** the score context line for the next game-over shows the delta from this run's score

**Given** the player activates MAIN MENU
**When** the button is triggered
**Then** the game canvas resets and the setup screen is shown with last-session settings pre-filled

**Given** the game-over overlay is open
**When** Escape is pressed
**Then** nothing happens — explicit button action is required to exit game-over

### Story 4.4: Implement ARIA Roles and Keyboard Navigation

As a player using keyboard or assistive technology,
I want all HTML surfaces to have correct semantic roles and keyboard navigation,
So that I can use the plugin fully without a mouse or touch input.

**Acceptance Criteria:**

**Given** the setup screen
**When** inspected for accessibility
**Then** `role="form"` and `aria-label="Session Setup"` are set on the form element
**And** each toggle group has `role="radiogroup"` with an `aria-label` matching its label text
**And** each toggle option has `role="radio"` and `aria-checked` reflecting its selected state

**Given** any overlay
**When** it opens
**Then** `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the overlay heading are set
**And** focus is trapped inside the overlay — Tab does not reach elements outside it

**Given** keyboard navigation throughout the plugin
**When** Tab and Arrow keys are used
**Then** all interactive elements are reachable in logical document order
**And** visible `:focus-visible` styles are present on all interactive HTML elements

**Given** the score display
**When** `GameState.runtime.score` changes
**Then** `aria-live="polite"` ensures screen readers announce the new score without interrupting

### Story 4.5: Implement Touch Targets and Final Accessibility Audit

As a player on a touch device,
I want all interactive elements to have adequate touch targets and the plugin to pass an accessibility audit,
So that the plugin is usable on tablet without mis-taps and meets its WCAG 2.1 AA commitment.

**Acceptance Criteria:**

**Given** all interactive elements across `setup.css` and `overlays.css`
**When** measured
**Then** every button, toggle option, and text link has a minimum 44×44px tap area (height + padding combined)

**Given** the Night City colour palette in use
**When** contrast ratios are checked
**Then** `var(--color-accent)` (#FFB800) on `var(--color-bg-void)` (#0D0D1A) achieves ≥ 4.5:1 ✓
**And** `var(--color-text-primary)` (#E8E8F0) on `var(--color-bg-stage)` (#1A1A2E) achieves ≥ 4.5:1 ✓

**Given** an axe DevTools or Lighthouse accessibility audit on the setup screen and each overlay
**When** the audit completes
**Then** zero WCAG 2.1 AA violations are reported on HTML surfaces
**And** any canvas-related warnings are documented as known non-applicable

---

## Epic 5: Variant System

Player can practice neck position shifts via mid-session variant track offers. The parallel track appears from the correct spatial direction (left for lower fret, right for higher fret), a timed decision window counts down visually, and accepting triggers a smooth transition with speed reset as the reward signal.

### Story 5.1: Implement Variant Offer Trigger

As a developer,
I want `DifficultyManager.js` to trigger variant offers at configurable intervals based on loop count,
So that neck shift practice is introduced naturally as the player progresses.

**Acceptance Criteria:**

**Given** `DifficultyManager.js` tracks the number of completed scale loops
**When** the loop count reaches the configured variant interval (default: every 2 octave loops)
**Then** `DifficultyManager.js` emits a variant offer event with two options: `+5 semitones` (higher fret) and `-2 semitones` (lower fret) relative to the current root
**And** both options are validated to keep `root_midi` within the range [21, 108]
**And** if either option would exceed the valid MIDI range, it is replaced with the in-range option

**Given** a variant offer is active
**When** the decision window expires without acceptance
**Then** `DifficultyManager.js` resets the loop counter and schedules the next variant offer for the configured interval
**And** no penalty is applied to score or speed

**Given** the difficulty level is `hard`
**When** compared to `easy`
**Then** the variant offer interval is shorter (fewer loops between offers)

### Story 5.2: Implement Variant Track Geometry

As a developer,
I want `TrackSystem.js` to render a parallel variant track that slides in from the correct side,
So that the player sees the neck shift spatially represented with the direction matching physical guitar orientation.

**Acceptance Criteria:**

**Given** `TrackSystem.showVariant(variantConfig)` is called with a new root MIDI and fret
**When** the variant track appears
**Then** a single-lane variant track group slides in from the LEFT if `variantConfig.fret < currentRootFret`, or from the RIGHT if `variantConfig.fret > currentRootFret` — using the `VARIANT_DIRECTION` constants defined in Story 3.2
**And** a one-lane-width gap appears between the current track and the variant track (representing physical hand distance on the neck)
**And** the variant lane's fret label is shown in `var(--color-accent)` to distinguish it from the current track's neutral grey labels
**And** the variant safe zone (new root note) is marked with a dashed outline and "NEW ROOT" label in the corresponding `STRING_COLORS` colour

**Given** `TrackSystem.hideVariant()` is called (timer expired, player ignored)
**When** the variant track exits
**Then** the variant track group slides back out in the direction it entered
**And** the current track geometry is unchanged

**Given** the variant track is visible
**When** `SceneManager.render()` runs
**Then** the variant track renders as part of `GameState.scene.tracks` (read-only by SceneManager)
**And** `TrackSystem.js` remains the only module that writes to `GameState.scene.tracks`

### Story 5.3: Implement Decision Window Timer Bar

As a player,
I want a visible countdown bar while a variant track is offered,
So that I know how long I have to decide without a number or audio cue distracting me.

**Acceptance Criteria:**

**Given** a variant track offer becomes active
**When** the timer bar appears
**Then** an HTML element is absolutely positioned over the canvas (above the track lanes)
**And** its `width` animates from 100% to 0% via a CSS transition driven by the variant window duration constant from `DifficultyManager.js`
**And** the bar colour is `var(--color-accent)`

**Given** the player accepts the variant (plays the new root note)
**When** acceptance is detected
**Then** the timer bar disappears immediately (no fade)

**Given** the timer bar reaches 0% width
**When** the CSS transition completes
**Then** a `transitionend` event triggers `TrackSystem.hideVariant()` and the timer bar is removed from the DOM

**Given** `prefers-reduced-motion` is enabled
**When** the timer bar is active
**Then** the CSS `width` transition is replaced by a static bar that disappears at the moment the window expires

### Story 5.4: Implement Variant Acceptance and Transition

As a player,
I want accepting a variant offer to smoothly transition me to the new scale root with a speed reset as a reward,
So that neck shifts feel like a power-up rather than a disruption.

**Acceptance Criteria:**

**Given** a variant track offer is active and `GameState.runtime.currentNote` matches the variant root MIDI
**When** `CartSystem.update()` detects the match
**Then** `main.js` is notified of variant acceptance
**And** `main.js` calls `GET /game/session-config` with the new `root_midi` and same `scale_id` and `instrument_id`
**And** `GameState.session.rootMidi` is updated to the new root MIDI

**Given** the new session config is received
**When** `TrackSystem.js` re-initialises with the new config
**Then** a tunnel/turn transition animation plays (~400ms) — track geometry transitions to the new layout
**And** `GameState.runtime.speed` is reset to the base difficulty speed by `DifficultyManager.js`
**And** the timer bar is removed and the decision window is closed
**And** gameplay continues on the new root immediately after the transition

**Given** the variant transition completes
**When** a game-over occurs on the new root
**Then** the game-over score context line reflects the full session score including notes scored on both root positions
