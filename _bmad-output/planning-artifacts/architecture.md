---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: complete
completedAt: '2026-05-20'
lastStep: 8
inputDocuments:
  - prd-subway-scaler.md
workflowType: architecture
project_name: slopsmith-plugin-subway-scaler
user_name: Robin Kasparek
date: 2026-05-20
---

# Architecture Decision Document

_Subway Scaler Plugin_

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Initialization

**Workflow initialized for: `slopsmith-plugin-subway-scaler`**

**Input Documents Discovered:**
- PRD: `prd-subway-scaler.md`
- Project Context: `_bmad-output/project-context.md`

**Ready to begin architectural decision making.**

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements (8 core features):**
- FR-001 through FR-004: Session setup, note visualization, audio detection, scoring
- FR-005 through FR-008: Difficulty scaling, collision detection, visual feedback, variant switching
- All require real-time audio processing and 3D rendering

**Non-Functional Requirements:**
- FR-011: 60 FPS minimum (performance-critical)
- FR-012: Memory < 500MB (browser-based)
- FR-013: Error recovery (audio device disconnect, plugin crash)
- FR-014: Session state persistence
- FR-015: Multiple audio input types (professional, USB-MIDI, centralized)
- FR-016: Settings persistence

### Scale & Complexity

**Complexity indicators:**
- **Real-time features:** Audio detection, 60 FPS rendering, dynamic difficulty scaling
- **Multi-tenancy:** None (single-user plugin)
- **Integration complexity:** High (Slopsmith compatibility, pluggable audio interface)
- **User interaction complexity:** Medium (MIDI input + UI controls)
- **Data complexity:** Low (JSON scale data, local settings)

**Primary domain:** Full-stack (Web frontend + Python backend plugin)

**Scale level:** Medium (Desktop plugin, no external dependencies)

### Technical Constraints & Dependencies

1. **Slopsmith Plugin API** — Must follow Slopsmith plugin architecture
2. **No external dependencies** — Avoid third-party packages not in Slopsmith ecosystem
3. **Audio detection** — YIN implementation with pluggable interface
4. **Browser support** — Chrome, Firefox, Edge, Safari (WebGL required)
5. **Platform support** — Windows, Linux, macOS via Docker or native

### Cross-Cutting Concerns Identified

1. **Real-time audio processing** — Low-latency note detection pipeline
2. **3D rendering performance** — Three.js scene graph management, frame culling
3. **Audio device compatibility** — Multiple input types with unified interface
4. **Difficulty progression** — Dynamic speed and frequency scaling
5. **Session state management** — Local storage for settings and session data

### Architecture Summary

**Estimated architectural components:**
- Audio processing module (YIN + pluggable adapter)
- 3D rendering module (Three.js scene manager)
- Game loop (render loop + update loop)
- Note detection controller (maps audio input to game state)
- Difficulty manager (speed/frequency scaling)
- UI module (settings, scale selection)
- Variant switcher (mid-session root note change)

**Does this match your understanding of the project scope?**

### Architecture Analysis

**Content prepared for document:**

```markdown
## Project Context Analysis

### Requirements Overview

**Functional Requirements (8 core features):**
- FR-001 through FR-004: Session setup, note visualization, audio detection, scoring
- FR-005 through FR-008: Difficulty scaling, collision detection, visual feedback, variant switching
- All require real-time audio processing and 3D rendering

**Non-Functional Requirements:**
- FR-011: 60 FPS minimum (performance-critical)
- FR-012: Memory < 500MB (browser-based)
- FR-013: Error recovery (audio device disconnect, plugin crash)
- FR-014: Session state persistence
- FR-015: Multiple audio input types (professional, USB-MIDI, centralized)
- FR-016: Settings persistence

### Scale & Complexity

**Complexity indicators:**
- **Real-time features:** Audio detection, 60 FPS rendering, dynamic difficulty scaling
- **Multi-tenancy:** None (single-user plugin)
- **Integration complexity:** High (Slopsmith compatibility, pluggable audio interface)
- **User interaction complexity:** Medium (MIDI input + UI controls)
- **Data complexity:** Low (JSON scale data, local settings)

**Primary domain:** Full-stack (Web frontend + Python backend plugin)

**Scale level:** Medium (Desktop plugin, no external dependencies)

### Technical Constraints & Dependencies

1. **Slopsmith Plugin API** — Must follow Slopsmith plugin architecture
2. **No external dependencies** — Avoid third-party packages not in Slopsmith ecosystem
3. **Audio detection** — YIN implementation with pluggable interface
4. **Browser support** — Chrome, Firefox, Edge, Safari (WebGL required)
5. **Platform support** — Windows, Linux, macOS via Docker or native

### Cross-Cutting Concerns Identified

1. **Real-time audio processing** — Low-latency note detection pipeline
2. **3D rendering performance** — Three.js scene graph management, frame culling
3. **Audio device compatibility** — Multiple input types with unified interface
4. **Difficulty progression** — Dynamic speed and frequency scaling
5. **Session state management** — Local storage for settings and session data

### Architecture Summary

**Estimated architectural components:**
- Audio processing module (YIN + pluggable adapter)
- 3D rendering module (Three.js scene manager)
- Game loop (render loop + update loop)
- Note detection controller (maps audio input to game state)
- Difficulty manager (speed/frequency scaling)
- UI module (settings, scale selection)
- Variant switcher (mid-session root note change)

**Does this match your understanding of the project scope?**
```

---

## Starter Template / Tech Foundation

### Primary Technology Domain

Full-stack Slopsmith plugin — existing codebase extended. No new starter needed.

### Stack (confirmed)

- Python 3.12+ / FastAPI / Pydantic v2 — data & settings REST API
- Three.js / ES modules — 3D rendering, game loop, audio detection
- pytest — backend testing
- JSON files — no external DB
- No bundler — plain ES modules, static files served by FastAPI

### Architectural Boundary Decisions

**Game Loop:** JS-owned `requestAnimationFrame`. Browser constraint — only path to 60fps (FR-011).

**Game Logic:** JS-owned. Real-time state (carts, collision, score) computed in browser. No network in the hot path.

**Audio Detection — Pluggable JS Adapter**

Defined as a JS class interface. Current impl: in-browser YIN via Web Audio API (~0ms latency). Future: drop-in `SlopsmithDetector` calling Slopsmith's endpoint. Game loop calls only the interface — swap = one class.

```js
class AudioDetector { async detect() {} }      // interface

class YinDetector extends AudioDetector {       // current
  // Web Audio API + YIN in-browser
}

class SlopsmithDetector extends AudioDetector { // future
  async detect() { return fetch('/api/detect').then(r => r.json()) }
}
```

**State Split**

| State | Owner | Transport |
|---|---|---|
| Scale catalog | Python | REST (load once at session start) |
| Settings | Python | REST |
| Cart positions, score, collision | JS | In-memory |
| Note detection | JS (YIN) | None (in-browser) |

**System Boundary Diagram**

```
Browser                          Python (FastAPI)
─────────────────────────────    ──────────────────────────
requestAnimationFrame loop       REST endpoints
  ├─ render (Three.js)             ├─ GET /scales
  ├─ game logic (carts, score)     ├─ GET/POST /settings
  └─ AudioDetector                 └─ (future: POST /detect)
       └─ YinDetector (now)
       └─ SlopsmithDetector (later)
```

---

## Core Architectural Decisions

### Already Decided (Step 3 / Project Context)

- Stack, game loop ownership, audio adapter pattern, state split — see _Tech Foundation_ section
- Error response shape, MIDI constraints, Pydantic v2 patterns — see _project-context.md_
- No authentication (single-user local plugin)
- No database (JSON files only)

### Frontend Module Architecture

**Decision:** ES module split

```
static/game/
  main.js              ← entry point, wires modules together
  GameLoop.js          ← requestAnimationFrame, update/render orchestration
  SceneManager.js      ← Three.js scene, camera, renderer lifecycle
  TrackSystem.js       ← track geometry, fret safe-zone positioning
  CartSystem.js        ← cart spawning, movement, collision detection
  DifficultyManager.js ← speed/frequency scaling logic
  AudioDetector.js     ← AudioDetector interface + YinDetector impl
  GameState.js         ← in-memory state object (single source of truth)
```

**Rationale:** Each module maps 1:1 to a PRD feature — implementable as independent stories, independently testable.

### Game State Shape

**Decision:** Structured sub-objects

```js
{
  session: { scale, rootMidi, difficulty, instrument }, // loaded from Python once
  runtime: { score, speed, phase },                    // updated every frame
  scene:   { carts: [], tracks: [], character: {} }    // Three.js entity refs
}
```

**Rationale:** Clean separation between immutable session config (fetched from backend at start) and mutable runtime/scene state (owned entirely by JS).

### Python API Surface

**Decision:** One new endpoint for game data needs.

| Endpoint | Method | Purpose |
|---|---|---|
| `/game/session-config` | GET | Returns scale notes + fret/string positions for given scale, root, instrument |
| `/scales` | GET | Scale catalog (existing) |
| `/settings` | GET/POST | Persist last scale, instrument, difficulty (existing) |

No session lifecycle endpoints — game state is entirely JS-owned. Backend is stateless with respect to active sessions.

### Error & Edge Case Handling

**Audio device disconnect (FR-013):**
- `GameLoop.js` catches detector errors → pauses the loop immediately
- Shows reconnect/resume overlay
- Game only resumes on explicit user click of "Resume" — no auto-resume
- Owned by `GameLoop.js` (already controls loop pause/resume)

**Game over flow:**
- Collision detected in `CartSystem.js` → sets `runtime.phase = 'game_over'`
- `GameLoop.js` sees phase → freezes scene, stops update loop (render loop continues for overlay)
- Score overlay shown with restart option
- Restart resets `GameState` and reinitializes modules — no page reload

### Decision Impact Analysis

**Implementation sequence implied:**
1. `GameState.js` — foundation everything else reads/writes
2. `SceneManager.js` + `TrackSystem.js` — static scene first
3. `GameLoop.js` — wires update/render, owns error/phase handling
4. `CartSystem.js` — dynamic entities
5. `AudioDetector.js` — YIN impl
6. `DifficultyManager.js` — scales runtime params
7. Python `GET /game/session-config` — backend data contract

**Cross-component dependencies:**
- `CartSystem` reads `runtime.speed` from `GameState`
- `DifficultyManager` writes `runtime.speed` to `GameState`
- `GameLoop` reads `runtime.phase` to decide pause/game-over behavior
- `AudioDetector` result flows into `GameLoop` → `GameState.runtime.currentNote`

---

## Implementation Patterns & Consistency Rules

### Potential Conflict Points Identified

5 areas where AI agents could diverge without explicit rules: API field format, JS naming, GameState mutation ownership, test location, phase transitions.

### Naming Patterns

**API JSON Field Format (Python ↔ JS boundary)**

`snake_case` at all API boundaries. JS reads and writes `snake_case` keys when calling Python endpoints. No alias configuration needed on the Python side.

```js
// Correct
const config = await fetch('/game/session-config').then(r => r.json())
config.root_midi   // snake_case — matches API
config.scale_id

// Wrong
config.rootMidi    // camelCase — never use at API boundary
```

**JavaScript Naming Conventions**

| Target | Convention | Example |
|---|---|---|
| Class modules | `PascalCase.js` | `GameLoop.js`, `CartSystem.js` |
| Utility modules | `camelCase.js` | `mathUtils.js` |
| Classes | `PascalCase` | `YinDetector`, `SceneManager` |
| Functions/methods | `camelCase` | `spawnCart()`, `updateSpeed()` |
| Variables | `camelCase` | `currentNote`, `cartList` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_FRET_SPAN`, `DEFAULT_SPEED` |

**Python Naming (from project-context.md — unchanged)**

`snake_case` functions/variables, `PascalCase` classes, `UPPERCASE` constants.

### Structure Patterns

**Test Location**

Mirror the Python `tests/` pattern in JS:

```
static/game/
  CartSystem.js
  GameLoop.js
  ...
tests/
  test_scales.py          ← Python tests (existing)
  test_game_routes.py     ← Python tests (existing)
static/game/tests/
  CartSystem.test.js      ← JS tests
  GameLoop.test.js
  AudioDetector.test.js
```

**Module Ownership of GameState**

Each `GameState` sub-object is owned by exactly one module. Only the owning module writes to it; all others read.

| Sub-object | Owner (writes) | Others (read-only) |
|---|---|---|
| `session` | `main.js` | all |
| `runtime.score` | `CartSystem.js` | `GameLoop`, `DifficultyManager` |
| `runtime.speed` | `DifficultyManager.js` | `CartSystem`, `GameLoop` |
| `runtime.phase` | see Phase Transitions | all |
| `runtime.currentNote` | `GameLoop.js` | `CartSystem` |
| `scene.carts` | `CartSystem.js` | `SceneManager` |
| `scene.tracks` | `TrackSystem.js` | `SceneManager` |
| `scene.character` | `GameLoop.js` | `SceneManager` |

### Communication Patterns

**Phase Transitions**

Only valid `runtime.phase` values — no string literals elsewhere in code:

```js
// GameState.js — canonical phase constants
export const PHASES = {
  IDLE:       'idle',
  PLAYING:    'playing',
  PAUSED:     'paused',
  GAME_OVER:  'game_over',
  RESTARTING: 'restarting'
}
```

Transition ownership:

| Transition | Owner |
|---|---|
| `idle → playing` | `main.js` |
| `playing → paused` | `GameLoop.js` (audio error) |
| `paused → playing` | `GameLoop.js` (Resume click) |
| `playing → game_over` | `CartSystem.js` (collision) |
| `game_over → restarting` | `main.js` (Restart click) |
| `restarting → idle` | `main.js` (after reset) |

### Process Patterns

**GameState Mutation**

Direct mutation within owning module only. No setter wrapper methods.

```js
// Correct — DifficultyManager owns runtime.speed
GameState.runtime.speed = newSpeed

// Wrong — CartSystem must not write speed
GameState.runtime.speed = ...  // CartSystem.js — forbidden
```

**JS Async Error Handling**

All `async` functions that call Web APIs (audio, fetch) use `try/catch`. Errors propagate upward to `GameLoop.js` for phase decisions — no silent swallows.

```js
// Correct
async detect() {
  try { return await this._runYin() }
  catch (err) { throw new AudioDetectorError(err.message) }
}

// Wrong
async detect() {
  try { return await this._runYin() }
  catch { return null }  // silent swallow — GameLoop never knows
}
```

**Python Exception Handling (from project-context.md — unchanged)**

Raise typed exceptions (`ScaleNotFound`, `InvalidRoot`, `InvalidOctaves`). Never return `null`/`None` for error states on public APIs.

### Enforcement Guidelines

**All AI agents MUST:**
- Use `snake_case` for all JSON keys at API boundaries (both reading and writing)
- Import `PHASES` from `GameState.js` — never use phase string literals directly
- Only write to `GameState` sub-objects owned by their module
- Propagate errors up to `GameLoop.js` — never silently swallow in lower modules
- Place JS tests in `static/game/tests/`, Python tests in `tests/`

**Anti-patterns:**
```js
// Phase literal — wrong
if (GameState.runtime.phase === 'playing') ...
// Correct
if (GameState.runtime.phase === PHASES.PLAYING) ...

// camelCase API key — wrong
body: JSON.stringify({ rootMidi: 60 })
// Correct
body: JSON.stringify({ root_midi: 60 })
```

### Correction: JS Test Location

**Step 5 stated** JS tests go in `static/game/tests/` — **this was wrong.**

Existing convention (discovered in step 6): `tests/unit/js/`. All new JS tests go there, consistent with the existing `contract/` / `integration/` / `unit/` test hierarchy.

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
slopsmith-plugin-subway-scaler/
├── pyproject.toml                              (existing)
├── scales.json                                 (existing)
├── routes.py                                   (existing)
├── data/
│   └── settings.json                           (existing)
├── services/
│   ├── __init__.py                             (existing)
│   ├── schemas.py                              (existing)
│   ├── errors.py                               (existing)
│   ├── scales.py                               (existing)
│   ├── instruments.py                          (existing)
│   ├── settings.py                             (existing)
│   ├── tabulator.py                            (existing)
│   ├── game_engine.py                          (existing — game logic, needs refactor)
│   └── game_routes.py                          (existing + new /game/session-config endpoint)
├── tests/
│   ├── conftest.py                             (existing)
│   ├── contract/
│   │   ├── test_scales.py                      (existing)
│   │   ├── test_instruments.py                 (existing)
│   │   ├── test_settings_get.py                (existing)
│   │   ├── test_settings_put.py                (existing)
│   │   ├── test_tabulator.py                   (existing)
│   │   ├── test_validator.py                   (existing)
│   │   ├── test_game_start.py                  (existing)
│   │   ├── test_game_state.py                  (existing)
│   │   ├── test_game_play_note.py              (existing)
│   │   ├── test_variant.py                     (existing)
│   │   └── test_game_session_config.py         (new — /game/session-config contract)
│   ├── integration/
│   │   ├── test_settings_flow.py               (existing)
│   │   ├── test_scales_reload.py               (existing)
│   │   ├── test_scale_tabulator_flow.py        (existing)
│   │   ├── test_game_failure.py                (existing)
│   │   ├── test_game_loop.py                   (existing)
│   │   └── test_variant_flow.py                (existing)
│   └── unit/
│       ├── test_game_engine.py                 (existing)
│       ├── test_game_engine_logic.py           (existing)
│       ├── test_wave_logic.py                  (existing)
│       └── js/
│           ├── notes.test.js                   (existing)
│           ├── yin.test.js                     (existing)
│           ├── stringPalette.test.js           (existing)
│           ├── audio.test.js                   (existing — update for adapter pattern)
│           ├── SafeZoneRenderer.test.js        (existing)
│           ├── grid.test.js                    (existing — rename → TrackSystem.test.js)
│           ├── runState.test.js                (existing — rename → GameState.test.js)
│           ├── game-client-variant.test.js     (existing)
│           ├── GameLoop.test.js                (new)
│           └── CartSystem.test.js              (new)
└── static/
    └── game/
        ├── vendor/
        │   └── three.module.js                 (existing — unchanged)
        ├── main.js                             (existing — refactor: session wiring)
        ├── GameState.js                        (rename from runState.js + restructure)
        ├── GameLoop.js                         (new — extract from game-client.js)
        ├── SceneManager.js                     (rename from scene.js)
        ├── TrackSystem.js                      (rename from grid.js)
        ├── CartSystem.js                       (new — extract from game-client.js / game_engine.py)
        ├── DifficultyManager.js                (new — extract from game_engine.py)
        ├── AudioDetector.js                    (rename from audio.js + adapter pattern)
        ├── yin.js                              (existing — unchanged, used by AudioDetector)
        ├── yin-worklet.js                      (existing — unchanged)
        ├── notes.js                            (existing — utility, unchanged)
        ├── stringPalette.js                    (existing — utility, unchanged)
        └── ui/
            └── SafeZoneRenderer.js             (existing — boundary: owned by TrackSystem)
```

### API Boundaries

**Python REST endpoints:**

| Endpoint | Method | Params | Response | Owner |
|---|---|---|---|---|
| `/scales` | GET | — | `[{id, name, intervals}]` | `services/scales.py` |
| `/settings` | GET/POST | body: `{last_scale_id, instrument_id, difficulty}` | settings object | `services/settings.py` |
| `/game/session-config` | GET | `?scale_id=&root_midi=&instrument_id=` | notes + fret/string positions | `services/game_routes.py` (new) |

**`/game/session-config` response shape:**
```json
{
  "scale_id": "major",
  "root_midi": 60,
  "instrument_id": "guitar-standard",
  "notes": [
    { "midi": 60, "name": "C4", "string": 2, "fret": 8 }
  ],
  "track_count": 6
}
```

### Component Boundaries

| Module | Owns | Calls |
|---|---|---|
| `main.js` | session lifecycle, `GameState.session` | Python REST, all modules |
| `GameLoop.js` | rAF tick, `runtime.phase`, `runtime.currentNote`, `scene.character` | `AudioDetector`, `CartSystem`, `SceneManager`, `DifficultyManager` |
| `SceneManager.js` | Three.js renderer, camera | reads `scene.*` from `GameState` |
| `TrackSystem.js` | `scene.tracks` | `SceneManager` |
| `CartSystem.js` | `scene.carts`, `runtime.score` | reads `runtime.speed`, `runtime.currentNote` |
| `DifficultyManager.js` | `runtime.speed` | reads `runtime.score` |
| `AudioDetector.js` | audio pipeline | Web Audio API (or future: fetch) |
| `GameState.js` | state object, `PHASES` constants | nothing |

### Requirements to Structure Mapping

| FR | File(s) |
|---|---|
| FR-001 Session Start | `main.js` + Python `/scales`, `/settings`, `/game/session-config` |
| FR-002 Note Visualization | `TrackSystem.js`, `SceneManager.js`, `ui/SafeZoneRenderer.js` |
| FR-003 Correct Note Detection | `AudioDetector.js` → `GameLoop.js` → `GameState.runtime.currentNote` |
| FR-004 Score Calculation | `CartSystem.js` (writes `runtime.score`) |
| FR-005 Difficulty Scaling | `DifficultyManager.js` (reads `runtime.score`, writes `runtime.speed`) |
| FR-006 Collision Detection | `CartSystem.js` → sets `PHASES.GAME_OVER` |
| FR-007 Visual Feedback | `SceneManager.js` (sparkle/glow on correct note) |
| FR-008 Variant Switching | `main.js` → re-calls `/game/session-config` with new root |
| FR-013 Error Recovery | `GameLoop.js` (catches audio error → `PHASES.PAUSED`) |
| FR-014 Session State Persistence | `main.js` → POST `/settings` on session end |
| FR-015 Multiple Audio Input Types | `AudioDetector.js` (swap `YinDetector` → `SlopsmithDetector`) |
| FR-016 Settings Persistence | `services/settings.py` |

### Data Flow

```
Session start:
  main.js → GET /scales           → populate UI
  main.js → GET /game/session-config → GameState.session

Active game loop (per frame):
  GameLoop ← AudioDetector.detect()  → GameState.runtime.currentNote
  GameLoop → CartSystem.update()     → GameState.scene.carts / runtime.score
  GameLoop → DifficultyManager.tick()→ GameState.runtime.speed
  GameLoop → SceneManager.render()   ← reads GameState.scene.*

Session end:
  main.js → POST /settings (persist last scale/instrument/difficulty)
```

---

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices compatible. FastAPI Pydantic v2 defaults to `snake_case` — no alias config needed, aligns with API boundary rule. JS `requestAnimationFrame` loop eliminates network latency from hot path, enabling 60fps. AudioDetector JS adapter pattern is compatible with ES modules and Web Audio API.

**Pattern Consistency:** `PHASES` constants prevent string literal drift across modules. Error propagation chain (module → `GameLoop` → phase transition) is internally consistent. `snake_case` at API boundary matches both Pydantic default and documented JS rule.

**Structure Alignment:** Module-to-feature mapping is 1:1 with PRD. `SafeZoneRenderer.js` clarification: owned by `TrackSystem.js` (writes track visuals), rendered by `SceneManager.js` (read-only).

### Requirements Coverage Validation

All 8 functional requirements and 6 non-functional requirements are architecturally supported. See Requirements to Structure Mapping in the Project Structure section above.

### Gap Analysis

**Critical Gaps:** None.

**Important Gaps:**
1. `game_engine.py` contains existing Python game logic (cart/wave/difficulty). Implementation must explicitly port this to `CartSystem.js` and `DifficultyManager.js` — not create from scratch. Stories should reference this migration.
2. `/game/session-config` response schema is proposed but not yet validated against `tabulator.py` output. Verify field names match before implementing the endpoint.

**Minor Gaps:**
- `SafeZoneRenderer.js` ownership gap in component table — resolved above (TrackSystem owns it).
- No logging strategy. Acceptable deferral for MVP.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Audio adapter pattern isolates Slopsmith dependency behind a single swappable class
- GameState ownership table eliminates ambiguity for AI agents writing cross-module code
- Module split maps 1:1 to PRD features — stories are naturally scoped
- Existing test infrastructure (contract/integration/unit) is mature and can absorb new coverage immediately

**Areas for Future Enhancement:**
- Logging strategy (post-MVP)
- DifficultyManager algorithm tuning (tune after playtest data)
- WebGL performance profiling (if 60fps issues arise in Safari)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and GameState ownership boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
1. `GameState.js` — foundation all other modules depend on
2. `services/game_routes.py` — add `/game/session-config` endpoint (validate against `tabulator.py` output first)
3. `AudioDetector.js` — refactor `audio.js` to adapter pattern, keep `yin.js`/`yin-worklet.js` intact
