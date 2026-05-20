---
project_name: slopsmith-plugin-subway-scaler
user_name: Robin Kasparek
date: 2026-05-20
sections_completed: ['technology_stack', 'code_patterns', 'implementation_rules']
existing_patterns_found: 12
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Backend:**
- Python 3.12+
- FastAPI for HTTP server
- Pydantic v2 for data validation
- pytest for testing
- httpx for async HTTP client

**Frontend:**
- Three.js for 3D WebGL rendering
- JavaScript (ES modules)

**Build/Dev:**
- pip for Python package management
- npm for JavaScript dependencies

**Data:**
- JSON files (scales.json, data/settings.json)

---

## Code Patterns & Conventions

### File Organization

**Services module structure:**
```
services/
├── __init__.py          # Scale catalog (SCALES dict)
├── schemas.py           # Pydantic models
├── errors.py            # Custom exceptions
├── scales.py            # Scale data loader, note generation
├── instruments.py       # Instrument registry
├── settings.py          # Settings persistence
├── tabulator.py         # Fret pattern encoder
├── game_engine.py       # Three.js glue logic
└── game_routes.py       # FastAPI endpoints
```

**Naming conventions:**
- Python files: lowercase with snake_case (scales.py, tabulator.py)
- Classes: PascalCase (Tabulator, ScalePattern)
- Functions: snake_case (list_scales, encode_scale)
- Variables: snake_case (scale_id, root_midi)
- Constants: UPPERCASE (SCALES, INSTRUMENTS, _NOTE_NAMES)

### Scale Pattern File Naming

Tab files use the format: `<scale_id>-<root_note>.tab`
Examples:
- `major-C.tab`
- `natural-minor-A.tab`

### Box Pattern Logic

Tabulator implements fret/string pairs using a "box" or "finger pattern" approach:
- Prefer lower frets and higher strings
- Start on lowest possible string for root note
- Stay within 4-5 fret span
- Use 2-4 notes per string

---

## Critical Implementation Rules

### Rule 1: Scale Catalog Initialization

**Location:** `services/__init__.py` (lines 39-46)

_Mandatory for plugin operation._ The scale catalog must load from `scales.json` at startup. If loading fails, initialize with empty dict but allow plugin to continue. Never re-initialize mid-runtime.

```python
_default_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "..", "scales.json")
try:
    _loaded = load_scales_from_json(_default_path)
    SCALES: dict[str, Scale] = {s.id: s for s in _loaded}
except Exception:
    SCALES = {}  # Mandatory for plugin operation
```

### Rule 2: MIDI Value Constraints

_MIDI note numbers must always be in range [21, 108] (A0 to C8)._

**Validation points:**
- `Note` schema field validator (ge=21, le=108)
- `InvalidRoot` exception when root_midi outside bounds
- `InvalidOctaves` exception when octaves not in (1, 2)

### Rule 3: Interval Array Invariants

_Scale interval arrays must follow these rules:_

1. Non-empty list
2. First interval must be 0 (root)
3. All intervals in [0, 24]
4. Strictly increasing order

```python
@field_validator("intervals")
@classmethod
def _validate_intervals(cls, v: list[int]) -> list[int]:
    if not v:
        raise ValueError("intervals must be non-empty")
    if v[0] != 0:
        raise ValueError("intervals must start at 0")
    if any(not (0 <= x <= 24) for x in v):
        raise ValueError("intervals must be in [0, 24]")
    for a, b in zip(v, v[1:]):
        if b <= a:
            raise ValueError("intervals must be strictly increasing")
    return v
```

### Rule 4: Instrument Registry

_Must initialize with default instruments before first load._

Default instruments (from `instruments.py`):
- `guitar-standard`: 6 strings, MIDI tuning [40, 45, 50, 55, 59, 64], maxFret=24
- `bass-4-standard`: 4 strings, MIDI tuning [28, 33, 38, 43], maxFret=24

### Rule 5: Settings Persistence

_Settings file path is fixed at `data/settings.json`._

_Must validate scale_id and instrument_id against current registries before saving._

```python
if s.lastScaleId not in scales_service.SCALES:
    raise InvalidSettings({"lastScaleId": f"unknown scale id: {s.lastScaleId}"})

if s.instrumentId not in instruments_service.INSTRUMENTS:
    raise InvalidSettings({"instrumentId": f"unknown instrument id: {s.instrumentId}"})
```

### Rule 6: Fret Calculation

**String indexing:** String 1 is highest pitch (lowest index in tuning array).

**Fret formula:**
```
fret = (note_pc - open_pc) % 12
```

Where `note_pc` is the pitch class of the target note, and `open_pc` is the pitch class of the open string.

### Rule 7: Note Naming

**Format:** `NoteName + Octave`

Examples: `C4`, `D#5`, `F3`

**MIDI to note name mapping:**
```python
_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
def midi_to_name(midi: int) -> str:
    return f"{_NOTE_NAMES[midi % 12]}{(midi // 12) - 1}"
```

### Rule 8: Audio Input

_Device ID stored as Base64-encoded string in settings._

Default tolerance: 50 cents
Default confidence threshold: 0.8
Default stability frames: 3

### Rule 9: Error Response Shape

_All errors use single-shape JSON structure:_

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "fields": { ... }  // Optional field validation errors
  }
}
```

### Rule 10: Plugin Entry Point

**FastAPI routes defined in `routes.py` (not shown in current scan).**

_Must export `app = FastAPI()` instance._

### Rule 11: Pydantic v2 Migration

_Project uses Pydantic v2 (`model_validate`, `model_post_init`)._

_Avoid v1 methods like `dict()` and `schema()`._

### Rule 12: Type Annotations

_All public APIs use Python 3.10+ union syntax (`|`) for types._

_Example: `def get(instrument_id: str) -> Instrument | None:`_

### Rule 13: Future Imports

_All modules use `from __future__ import annotations` for forward reference support._

### Rule 14: Exception Hierarchy

_Custom exceptions defined in `errors.py`:_
- `ScaleNotFound`
- `InvalidRoot`
- `InvalidOctaves`

_Raise appropriate exception when constraints violated._

---

## Common Pitfalls

### DON'T: Re-initialize SCALES dict

**Why:** The catalog is a module-level singleton. Re-creating it loses loaded scales.

### DON'T: Assume fret 0 is always valid

**Why:** Bass strings may not be frettable at certain notes due to open string pitch.

### DON'T: Use `dict()` for serialization

**Why:** Pydantic v2 uses `model_dump()` instead.

### DON'T: Forget Base64 audio device ID

**Why:** Device IDs are stored as encoded strings. Decoding fails for raw MIDI values.

### DON'T: Hardcode instrument IDs

**Why:** Use `instruments_service.INSTRUMENTS` lookup instead.

---

## Project Structure

```
.
├── README.md
├── pyproject.toml
├── data/
│   └── settings.json
├── services/
│   ├── __init__.py
│   ├── schemas.py
│   ├── errors.py
│   ├── scales.py
│   ├── instruments.py
│   ├── settings.py
│   ├── tabulator.py
│   ├── game_engine.py
│   └── game_routes.py
├── routes.py
├── scales.json
├── tests/
├── static/
│   └── game/
└── design-artifacts/
```
