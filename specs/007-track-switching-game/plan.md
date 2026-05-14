# Implementation Plan: Track-Switching Game Rework

**Branch**: `007-track-switching-game` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-track-switching-game/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Rework subway scaler game from character-jumping mechanic to track-switching mechanic. Player avoids subway carts by responding to fret input prompts. Safe zones (colored tracks) travel down the screen, showing which track to occupy before next cart wave arrives. Difficulty increases with each correct note. Game continues looping through ascending-descending scale until player fails. MVP: implement core loop (fret prompt → character move → survive one round) with P1 user stories (start game, play note, survive multiple rounds).

## Technical Context

**Language/Version**: Python 3.10+ (from constitution)  
**Primary Dependencies**: FastAPI (backend), Slopsmith plugin architecture, existing note detection system (reused from prior features)  
**Storage**: JSON files for scale definitions (from 004-scale-json-tabulator migration)  
**Testing**: pytest + contract tests (TDD mandatory per constitution)  
**Target Platform**: Web browser (FastAPI + HTML5/JavaScript frontend)  
**Project Type**: Web-based game plugin (FastAPI plugin within Slopsmith)  
**Performance Goals**: 60 fps gameplay, <100ms input response time (from spec SC-004)  
**Constraints**: Lightweight, no heavy dependencies; fast frontend rendering with vanilla JS + Tailwind CSS  
**Scale/Scope**: Single-player game session; 6 string tracks + N cart waves per session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Modular Design
✓ **PASS**: Game logic will be separated into service layer (GameEngine, ScaleManager, DifficultyCalculator) independent of FastAPI routes and frontend. Clear boundary between game state and presentation.

### II. Test-Driven Development (NON-NEGOTIABLE)
⚠ **GATE REQUIRED**: TDD is mandatory. Implementation cannot begin until:
1. Contract test for game state machine is written and failing
2. Integration test for note input → character movement is written and failing
3. Tests define API contract for `/api/plugins/subway_scaler/game/*` endpoints
**Action**: Phase 0 must include research on existing test structure + contract definitions.

### III. Independent User Stories
✓ **PASS**: Feature spec defines 4 independent P1/P2 stories, each testable and MVP-complete on its own.

### IV. Consistent API Design
✓ **PASS**: All game endpoints will be under `/api/plugins/subway_scaler/` (e.g., `/api/plugins/subway_scaler/game/start`, `/api/plugins/subway_scaler/game/play-note`). JSON request/response bodies documented in contracts.

### V. Performance and Simplicity
✓ **PASS**: Game uses only FastAPI + vanilla JS + Tailwind CSS. Reuses existing note detection system. No new dependencies introduced. 60 fps constraint drives lightweight canvas/DOM rendering approach.

## Project Structure

### Documentation (this feature)

```text
specs/007-track-switching-game/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root - Slopsmith plugin structure)

```text
src/subway_scaler/
├── models/
│   ├── game_state.py           # GameState, Track, CartWave entities
│   ├── scale.py                # ScaleProgression (reuse from 004)
│   └── difficulty.py           # DifficultyLevel
├── services/
│   ├── game_engine.py          # GameEngine - core loop, state machine
│   ├── difficulty_manager.py   # Difficulty scaling logic
│   └── scale_manager.py        # Scale progression (ascending/descending)
├── api/
│   ├── routes.py               # FastAPI routes under /api/plugins/subway_scaler/
│   └── schemas.py              # Pydantic schemas for request/response
├── frontend/
│   ├── game.html               # Main game page
│   ├── styles/
│   │   └── game.css            # Tailwind + custom styles
│   └── js/
│       ├── game-client.js      # Frontend game logic (canvas rendering, input handling)
│       └── api-client.js       # API communication
└── __init__.py

tests/
├── contract/
│   └── test_game_api_contract.py    # Contract tests for game endpoints (TDD gate)
├── integration/
│   ├── test_game_flow.py       # E2E game round (start → play → survive)
│   └── test_note_input.py      # Note input → state transition
└── unit/
    ├── test_game_engine.py
    ├── test_difficulty_manager.py
    └── test_scale_manager.py
```

**Structure Decision**: Standard Slopsmith plugin structure with backend services, FastAPI routes, and frontend assets. Separates game logic (services/) from API layer (api/), following Modular Design principle. Frontend uses vanilla JS + HTML5 canvas for 60 fps gameplay.

## Phase 0: Research & Clarification

### Research Tasks

1. **Existing Game Architecture** - How is current subway scaler implemented? What canvas/rendering library? State management approach?
2. **Note Detection Integration** - How does note input system work? What's the API to query "what note was played"? Latency expectations?
3. **Scale Definition Format** - Output of 004-scale-json-tabulator: How are scales stored in JSON? How to iterate ascending/descending?
4. **Frontend Rendering Strategy** - Canvas (better perf) vs DOM (simpler)? 60 fps target + complex animations (moving carts + tracks).
5. **FastAPI Plugin Pattern** - What's the pattern for game session state in FastAPI? How to handle real-time updates (polling vs WebSocket)?

### Phase 0 Output

**research.md** - Consolidates findings for each research task with Decision/Rationale/Alternatives format.

---

## Phase 1: Design & Contracts

### 1. Data Model (data-model.md)

Extract entities from spec and design state machine:

- **GameState**: current_score, current_track, scale_progression, difficulty_level, is_active, cart_waves
- **Track**: track_index (0-5 for 6 strings), string_name, fret_range
- **CartWave**: cart_positions, safe_track_index, start_time, speed
- **SafeZoneTrack**: track_index, color, duration_ms (time window for player to input note)
- **ScaleProgression**: notes (ascending), is_descending, current_index, selected_scale
- **DifficultyLevel**: level (0-N), speed_multiplier, time_window_ms

State machine: GameState.is_active → true | Receive note input + matches expected track → move character → generate next CartWave | Collision → is_active = false

### 2. Interface Contracts (contracts/)

**POST /api/plugins/subway_scaler/game/start** - Start new game session
- Request: `{ scale_id: string }`
- Response: `{ session_id: string, initial_track: int, first_wave: CartWave }`

**POST /api/plugins/subway_scaler/game/play-note** - Submit note input
- Request: `{ session_id: string, fret: int, string: int, timestamp_ms: int }`
- Response: `{ success: boolean, character_moved_to: int, next_wave: CartWave, score: int }` or `{ success: false, collision: true, final_score: int }`

**GET /api/plugins/subway_scaler/game/:session_id** - Get current game state
- Response: Full GameState snapshot

### 3. Quickstart (quickstart.md)

Developer guide: How to start game, integrate note input, handle updates, render UI. Code examples for backend service usage + frontend API calls.

### Phase 1 Output

**data-model.md**, **contracts/**, **quickstart.md** files created.

---

## Complexity Tracking

> No Constitution violations requiring justification. All design aligns with Modular Design, TDD, API consistency, and Performance principles.

---

## Next Steps

1. Execute Phase 0 research tasks → produce `research.md`
2. Execute Phase 1 design → produce `data-model.md`, `contracts/`, `quickstart.md`
3. Run `/speckit-tasks` to generate implementation task breakdown based on design artifacts
4. Begin implementation following TDD (failing contract tests first)
