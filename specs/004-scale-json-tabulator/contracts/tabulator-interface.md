# Contract: Tabulator Interface

**Module**: `services.tabulator`  
**Responsibility**: Encode scales as multi-string fret patterns respecting guitar geometry.

## Interface: Tabulator

### Method: encode_scale

**Signature**:
```python
def encode_scale(
    scale: Scale,
    root_note: str,
    guitar: GuitarGeometry = default_6string_guitar
) -> ScalePattern:
    """Encode a scale as fret/string positions for guitar."""
```

**Parameters**:
- `scale`: Scale object with intervals
- `root_note`: Note name (C, C#, D, ..., B)
- `guitar`: Guitar geometry (defaults to standard 6-string)

**Returns**: ScalePattern with {string, fret} pairs.

**Validation**:
- Raises `ValueError` if root_note invalid
- Raises `ValueError` if scale intervals out of range
- Returns pattern with all frets in 0-24 range
- Returns pattern respecting tuning E-A-D-G-B-E

**Example**:
```python
scale = Scale(id="major", name="Major", intervals=[0,2,4,5,7,9,11,12])
pattern = encode_scale(scale, "C")
# pattern.pattern = [
#   {"string": 1, "fret": 0},  # E string, C note (fret 0 = E, need +8 semitones = fret 8)
#   {"string": 2, "fret": 3},  # A string, D note
#   ...
# ]
```

## Interface: GeometryValidator

### Method: validate_pattern

**Signature**:
```python
def validate_pattern(pattern: ScalePattern) -> tuple[bool, list[str]]:
    """Validate pattern playability on standard guitar."""
```

**Returns**: (is_valid, error_messages)

**Validation checks**:
1. All frets in range 0-24
2. All strings in range 1-6
3. No duplicate strings
4. Respects standard tuning

**Example**:
```python
is_valid, errors = validate_pattern(pattern)
if not is_valid:
    for error in errors:
        print(f"Invalid: {error}")
```

## Contract Tests

- `test_tabulator_major_scale_c`: Encode C major on standard tuning
- `test_tabulator_fret_range_validation`: Frets stay 0-24
- `test_tabulator_string_range_validation`: Strings stay 1-6
- `test_geometry_validator_valid_pattern`: Valid pattern passes
- `test_geometry_validator_invalid_fret`: Invalid fret rejected
- `test_geometry_validator_invalid_string`: Invalid string rejected

## Breaking Changes

None - new interface, non-breaking addition to existing scales service.
