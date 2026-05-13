# Research: Scale JSON Tabulator

**Phase**: Phase 0 - Research & Investigation  
**Date**: 2026-05-13  
**Scope**: Technical design decisions for scales externalization and tabulator

## JSON Schema Design

**Decision**: Scales stored in JSON array with object per scale. Root note specified by integer (semitone offset from C).

**Rationale**: 
- Matches existing Python schema (Scale dataclass with id, name, intervals)
- Integer intervals are language-independent and mathematically precise
- Human-readable note names in display layer only

**Format**:
```json
{
  "scales": [
    {
      "id": "major",
      "name": "Major",
      "intervals": [0, 2, 4, 5, 7, 9, 11, 12]
    }
  ]
}
```

**Alternatives considered**:
- YAML: Less standard in Python web context, requires extra dependency
- CSV: Too flat for musical data
- Database: Overkill for <20 scale definitions, kills offline capability

## Tabulator Algorithm

**Decision**: Tabulator maps scale notes to strings starting from string 1 (highest pitch) using modulo arithmetic. Respects 6-string standard tuning (E-A-D-G-B-E).

**Rationale**:
- Guitar layout is naturally multi-string: each string has distinct open note
- Starting from highest string follows standard guitar fingering pedagogy
- Modulo 12 maps MIDI notes to pitch class, then to guitar position
- Respects fret range 0-24 (standard guitar)

**Key insight**: Scale interval [0, 2, 4, 5, 7, 9, 11] in semitones maps to fret offsets when root note is known. For C major on string 1 (E open = MIDI 40), C = 36, need fret offset calculation.

**Algorithm outline**:
```
for each scale note (root + interval):
  find lowest playable fret across any string
  prefer open strings, then low frets (≤ 5)
  enforce fret range 0-24
  return {string, fret} pair
```

**Alternatives considered**:
- Single-string patterns: Violates spec requirement for multi-string encoding
- Complex fingering optimization: Out of scope for v1; v2 feature
- MIDI-only patterns: Loses guitar-specific context

## Validation

**Decision**: Geometry validator checks (1) fret range 0-24, (2) string in 1-6, (3) tuning consistency.

**Rationale**:
- Prevents impossible patterns (fret > 24, string 0, etc.)
- Ensures playability on standard guitar
- Documents assumptions about guitar range

**Alternatives considered**:
- No validation: Allows silent failures
- Overly strict: Complex hand-position constraints belong in v2

## Implementation Path

1. Load scales.json at plugin initialization (services/scales.py)
2. Implement Tabulator class (services/tabulator.py)
3. Geometry validator in same module
4. Add contract tests for each component
5. Export tabulator through scales_router for frontend

## Open Questions

None - spec and constitution provide sufficient guidance.
