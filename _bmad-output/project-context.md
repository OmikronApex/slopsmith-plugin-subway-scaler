# Project Context: Subway Scaler Plugin

## Project Overview
**Subway Scaler** is a guitar/bass scale trainer plugin that combines rhythm gameplay with music theory education. The game follows a *Subway Surfers*-style track system where players avoid trains while playing correct scale notes.

## Core Architecture

### Backend (Python/FastAPI)
- **Entry point**: `routes.py`
- **Main engine**: `services/game_engine.py`
- **Data**: JSON scale definitions, instrument configs
- **Communication**: WebSocket/HTTP API for note inputs

### Frontend (Three.js)
- **Location**: `static/game/`
- **Renderer**: WebGL 3D scene
- **Input**: Keyboard/midi note detection

## Key Implementation Rules

### 1. Time Handling
- **All timing is delta-time based** for frame-rate independence
- Use `time.time() * 1000` for millisecond timestamps
- `next_deadline_ms` and `required_timestamp_ms` drive game flow
- Frontend polls every **200ms**; backend generates lookahead queue

### 2. Score Calculation
- **Playing early**: Rejected (`timing_ms < required_timestamp_ms`)
- **Playing late**: No penalty currently
- **Correct note**: `+100 points`, speed increases 5%
- **Collision with cart on safe track**: Session fails

### 3. Track/Lane System
- **Dynamic lane count**: Based on fret span of scale
- **Formula**: `(max_fret - base_fret) + 1`, clamped 3-12 lanes
- **Safe track**: Determined by first note's fret offset from base
- **Track index**: `fret - base_fret` (clamped to available lanes)

### 4. Wave Spawning
- **Independent queue**: Spawns based on scale progression, not player input
- **Spacing factor**: `WAVE_SPACING_FACTOR = 0.4` (carts closer together)
- **Lookahead queue**: Maintain `WAVE_LOOKAHEAD_MS = 10000` ms of carts
- **Duration**: `base_duration / multiplier` (longer as speed increases)

### 5. Variant Switching (Feature 008)
- **Trigger**: Every 2 octave loops completed
- **Pitch shifts**: +5 semitones (up), -2 semitones (down)
- **Geometry**: Clean variant window matching track count
- **State flow**: SPAWNING → ACTIVE → SWITCH_TRIGGERED → SWITCHED → TIMEOUT

### 6. Instrument Support
- **Guitar strings**: 6 strings, standard tuning E2-E4
- **String indices**: 0=low (E2), 5=high (E4)
- **Fret range**: 0-24 frets
- **Max fret**: Configurable per instrument

### 7. Scale Data Model
- **Notes**: MIDI value, name, string, fret
- **Expand function**: Generates ascending + descending pattern
- **Descending loop**: Drops last note (root) to avoid duplication

### 8. Error Handling
- **Session not found**: Return `{"success": False, "error": "session_not_found"}`
- **Game not running**: Return `{"success": False, "error": "game_not_running"}`
- **Too early**: Reject input, no penalty
- **Wrong note**: Return error, don't advance session

### 9. Variant State Codes
- `SPAWNING`: Variant spawning, fades in
- `ACTIVE`: Player must play trigger to switch
- `SWITCHED`: Transition complete
- `CLOSED`: Window timed out

## Directory Structure

```
project-root/
├── _bmad/           # BMAD automation tools
├── docs/            # Project knowledge base
├── routes.py        # Plugin entry point
├── services/
│   ├── game_engine.py  # Main game logic
│   ├── schemas.py     # Pydantic models
│   ├── instruments.py # Instrument definitions
│   ├── scales.py      # Scale definitions
│   └── tabulator.py   # Finger pattern encoder
├── static/
│   └── game/        # Three.js frontend
│       ├── grid.js       # Grid/background rendering
│       ├── scene.js      # Three.js scene
│       ├── main.js       # Main game loop
│       └── runState.js   # Run state management
├── specify/         # Feature specifications
│   └── feature.json
├── specs/           # Technical specs
├── tests/           # Unit and integration tests
└── _bmad-output/    # Generated artifacts
```

## Current Active Feature: Background Scroll (001-background-scroll)

**Status**: In development on branch `001-background-scroll`

**Goal**: Add scrolling texture to simulate world movement

**Requirements**:
- FR-001: Load scrollable texture from asset
- FR-002: Continuous scrolling during gameplay
- FR-003: Frame-rate independent scroll speed
- FR-004: Seamless texture looping (no visible seams)
- FR-005: Configurable speed and direction
- FR-006: No performance impact

**Edge Cases to Handle**:
- Texture file load failure → fallback/visible error
- Frame rate variations → use delta time
- Non-square textures → tile correctly

## Patterns & Conventions

### Code Style
- Type hints on all functions
- Pydantic models for data validation
- `Optional[T]` for nullable return values
- Logger for all significant events

### Test Structure
- Unit tests in `tests/unit/`
- Match service/function names
- Use `pytest` for Python tests

### API Contract
- Success: `{"success": True, "data": ...}`
- Error: `{"success": False, "error": "reason"}`
- GameState always included in note responses

## Security Considerations
- Validate all external inputs (MIDI messages)
- No direct file system access without validation
- Rate limit rapid note inputs to prevent DoS

## Performance Targets
- Stable 60 FPS minimum
- Wave queue pruned every frame (10s lookback)
- Texture scrolling must not impact render time
- Variant switching should be seamless (no frame drops)
