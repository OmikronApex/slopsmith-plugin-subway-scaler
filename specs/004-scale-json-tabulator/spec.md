# Feature Specification: Scale JSON Tabulator

**Feature Branch**: `004-scale-json-tabulator`  
**Created**: 2026-05-13  
**Status**: Draft  
**Input**: Relocate Scale definitions to separate .json file with proper tabulator for multi-string encoding.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Define Scales in JSON Configuration (Priority: P1)

Plugin developers can externalize scale definitions from code into a machine-readable JSON file, making scales easily editable without code changes.

**Why this priority**: Core refactoring that enables all other features; foundational for configuration-driven scale system.

**Independent Test**: Load scale definitions from JSON file and confirm they match expected scale patterns (notes, intervals).

**Acceptance Scenarios**:

1. **Given** a JSON file with scale definitions, **When** plugin loads, **Then** all scales are available for use
2. **Given** modified JSON scale definitions, **When** plugin reloads, **Then** updated scales reflect changes without code rebuild
3. **Given** invalid JSON, **When** plugin loads, **Then** clear error message identifies the problem

---

### User Story 2 - Encode Scales as Playable Multi-String Patterns (Priority: P1)

Tabulator encodes scales as fret positions across multiple strings, matching how musicians actually play scales on guitar rather than single-string linear patterns.

**Why this priority**: Core requirement for musical accuracy; ensures scales are playable and musically intuitive.

**Independent Test**: Given a scale (e.g., C major), verify tabulator generates multi-string fret patterns that represent the scale correctly.

**Acceptance Scenarios**:

1. **Given** a scale and target string, **When** tabulator encodes, **Then** fret positions span multiple strings following standard guitar layout
2. **Given** finger position constraints, **When** tabulator encodes, **Then** pattern respects string open notes and standard tuning
3. **Given** multiple octaves in scale, **When** tabulator encodes, **Then** pattern wraps across strings appropriately

---

### User Story 3 - Validate Scale Patterns Against Guitar Geometry (Priority: P2)

System validates that encoded scale patterns are physically playable on standard guitar tuning, preventing invalid fret/string combinations.

**Why this priority**: Ensures usability; prevents malformed scales that can't be played.

**Independent Test**: Validate several scale patterns and confirm all fret positions are within playable range on 6-string guitar.

**Acceptance Scenarios**:

1. **Given** a scale pattern, **When** validation runs, **Then** all fret numbers are within 0-24 range (standard guitar)
2. **Given** a scale pattern, **When** validation runs, **Then** string assignments match 6-string standard guitar tuning (E-A-D-G-B-E)

---

### Edge Cases

- What happens when scale definition references undefined notes?
- How does system handle scales with notes outside standard tuning range?
- What happens when JSON file is missing or malformed?
- How are enharmonic equivalents (C# vs Db) handled?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load scale definitions from external JSON file on plugin initialization
- **FR-002**: System MUST parse JSON scale structure containing note names, intervals, and metadata
- **FR-003**: Tabulator MUST encode scales as fret positions across multiple strings (not single-string patterns)
- **FR-004**: Tabulator MUST respect standard guitar tuning (E-A-D-G-B-E) when mapping notes to strings/frets
- **FR-005**: Tabulator MUST generate playable patterns where all fret positions fall within standard guitar range (0-24 frets)
- **FR-006**: System MUST validate scale patterns against guitar geometry and report errors
- **FR-007**: System MUST handle scale patterns that span multiple octaves with proper string wrapping

### Key Entities

- **Scale**: Represents a musical scale with name, root note, intervals, and metadata (e.g., {"name": "Major", "root": "C", "intervals": [0, 2, 4, 5, 7, 9, 11]})
- **ScalePattern**: Represents fret/string positions for a scale (e.g., [{"string": 1, "fret": 0}, {"string": 2, "fret": 2}, ...])
- **GuitarGeometry**: Standard 6-string guitar with tuning E-A-D-G-B-E and fret range 0-24

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All scales can be defined in JSON and loaded without code changes
- **SC-002**: Tabulator generates multi-string patterns that match standard guitar fingering positions for at least 5 common scales (Major, Minor, Pentatonic, Blues, Dorian)
- **SC-003**: Invalid scale definitions produce clear error messages identifying the issue
- **SC-004**: Scale patterns validate correctly against guitar geometry with zero false positives/negatives in test suite

## Assumptions

- Scales are defined in standard Western musical notation (semitone intervals from root)
- Standard 6-string guitar with EADGBE tuning (no alternate/extended tunings in v1)
- Fret range limited to 0-24 (standard guitar standard)
- One scale pattern per scale (not multiple fingering variations)
- JSON schema is defined and documented separately
- Enharmonic equivalents (C#/Db) are treated as separate scale notes
