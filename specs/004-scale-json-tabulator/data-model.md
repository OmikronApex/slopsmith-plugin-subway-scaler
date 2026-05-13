# Data Model: Scale JSON Tabulator

**Phase**: Phase 1 - Design  
**Date**: 2026-05-13  
**Status**: Design document

## Entity: Scale

**Purpose**: Represents a musical scale definition.

**Fields**:
- `id` (string): Unique identifier (lowercase, hyphenated, e.g., "major", "minor-pentatonic")
- `name` (string): Human-readable display name (e.g., "Major", "Minor Pentatonic")
- `intervals` (array[int]): Semitone intervals from root (e.g., [0, 2, 4, 5, 7, 9, 11, 12])

**Validation**:
- `id`: 1-50 characters, alphanumeric + hyphens, no spaces
- `name`: 1-100 characters
- `intervals`: Non-empty array, first element must be 0, values 0-12, sorted ascending, typically closes octave at 12

**Relationships**: Referenced by scale patterns and API endpoints.

**State**: Immutable - loaded at startup, no modifications during runtime.

## Entity: ScalePattern

**Purpose**: Represents fret/string positions for a scale on guitar.

**Fields**:
- `scaleId` (string): Foreign key to Scale
- `rootNote` (string): MIDI note name (e.g., "C", "C#", "D", ..., "B")
- `pattern` (array[StringFretPair]): List of {string, fret} positions

**StringFretPair**:
- `string` (int): 1-6 (1 = highest pitch string E)
- `fret` (int): 0-24

**Validation**:
- `string`: Must be in range 1-6
- `fret`: Must be in range 0-24
- No duplicate string assignments (one note per string)
- Pattern must respect standard tuning (E-A-D-G-B-E)

**State**: Generated on-demand from Scale + root note by Tabulator.

## Entity: GuitarGeometry

**Purpose**: Defines physical properties of standard 6-string guitar.

**Fields**:
- `strings` (int): 6 (immutable)
- `tuning` (array[string]): ["E", "A", "D", "G", "B", "E"] (immutable)
- `midiOpenNotes` (array[int]): [40, 45, 50, 55, 59, 64] in MIDI numbers
- `fretRange` (object): {min: 0, max: 24}

**Validation**:
- Immutable - defines standard tuning only

**State**: Singleton, initialized at startup.

## Data Flow

1. **Load**: Plugin reads scales.json → deserialize to Scale objects (Pydantic)
2. **Request**: Client asks for scale pattern (scaleId + rootNote)
3. **Tabulate**: Tabulator.encode(scale, rootNote) → ScalePattern
4. **Validate**: GeometryValidator.validate(pattern) → bool + errors
5. **Return**: Serialize ScalePattern to JSON → client

## Database/Storage

- **Scales**: JSON file (scales.json) - loaded once at startup
- **Patterns**: Generated in-memory, not persisted
- **Geometry**: Constants, not stored

## Constraints

- No scale modifications at runtime (v1)
- No multi-octave patterns (v1)
- Standard 6-string tuning only (v1)
