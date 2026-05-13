# Quickstart: Scale JSON Tabulator

**Phase**: Phase 1 - Design  
**Date**: 2026-05-13

## Overview

This document guides developers through using the scale JSON tabulator feature.

## Getting Started

### 1. Load Scales from JSON

Scales are defined in `scales.json` (plugin root) and loaded at startup:

```python
from services.scales import load_scales_from_json

# In plugin initialization:
scales = load_scales_from_json("scales.json")
# Returns dict[str, Scale]
```

### 2. Generate Scale Patterns

Given a scale and root note, generate playable fret positions:

```python
from services.scales import get_scale
from services.tabulator import Tabulator

scale = get_scale("major")
tabulator = Tabulator()
pattern = tabulator.encode_scale(scale, root_note="C")
# Returns ScalePattern with {string, fret} positions
```

### 3. Validate Patterns

Check that patterns are playable on standard guitar:

```python
from services.tabulator import GeometryValidator

validator = GeometryValidator()
is_valid, errors = validator.validate_pattern(pattern)

if not is_valid:
    for error in errors:
        print(f"Error: {error}")
```

### 4. Use in API Endpoints

Extend scales endpoint to provide tabulator:

```python
@router.get("/api/plugins/subway_scaler/scales/{scale_id}/tabulate")
def tabulate_scale(scale_id: str, root_note: str):
    """Encode scale as fret/string positions for given root note."""
    scale = get_scale(scale_id)
    if not scale:
        raise HTTPException(status_code=404)
    
    pattern = tabulator.encode_scale(scale, root_note)
    validator.validate_pattern(pattern)  # Ensure valid before returning
    return pattern
```

## scales.json Format

Create `scales.json` with scale definitions:

```json
{
  "scales": [
    {
      "id": "major",
      "name": "Major",
      "intervals": [0, 2, 4, 5, 7, 9, 11, 12]
    },
    {
      "id": "minor-pentatonic",
      "name": "Minor Pentatonic",
      "intervals": [0, 3, 5, 7, 10, 12]
    }
  ]
}
```

## Testing

### Contract Tests

Test scales API directly:

```python
def test_get_scale_from_json():
    scale = get_scale("major")
    assert scale.id == "major"
    assert scale.intervals == [0, 2, 4, 5, 7, 9, 11, 12]
```

### Tabulator Tests

Test encoding logic:

```python
def test_encode_major_scale():
    scale = Scale(id="major", name="Major", intervals=[0,2,4,5,7,9,11,12])
    pattern = tabulator.encode_scale(scale, "C")
    assert len(pattern.pattern) >= 1
    for pair in pattern.pattern:
        assert 1 <= pair["string"] <= 6
        assert 0 <= pair["fret"] <= 24
```

### Geometry Validation Tests

Test validation logic:

```python
def test_validate_valid_pattern():
    is_valid, errors = validator.validate_pattern(valid_pattern)
    assert is_valid
    assert len(errors) == 0

def test_validate_invalid_fret():
    invalid_pattern.pattern[0]["fret"] = 30
    is_valid, errors = validator.validate_pattern(invalid_pattern)
    assert not is_valid
    assert "fret" in errors[0].lower()
```

## Typical Workflow

1. **Dev**: Create scales.json with initial scale definitions
2. **Test**: Write contract tests for JSON loading
3. **Impl**: Implement Tabulator.encode_scale()
4. **Test**: Verify patterns match expected fret/string positions
5. **Valid**: Test GeometryValidator catches edge cases
6. **Integrate**: Add API endpoint, test end-to-end

## Performance Notes

- Scale loading happens once at startup
- Pattern generation is O(n) where n = scale size (~8 notes typically)
- Validation is O(n) 
- No async needed; fast operations

## Future Enhancements

- v2: Multi-octave patterns with proper wrapping
- v2: Finger-position optimization (minimize movement)
- v2: Alternative tunings (drop-D, DADGAD, etc.)
- v2: Caching of encoded patterns
