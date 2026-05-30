# Story 11.1: Expand Instrument Registry — 5-String Bass, 7-String & 8-String Guitar

Status: ready-for-dev

## Story

As a developer,
I want the instrument registry to define 5-string bass, 7-string guitar, and 8-string guitar with correct standard tunings and updated Pydantic validators,
so that the game engine can compute accurate fret/string positions for these instruments and Story 11-2's setup UI can offer them as selections.

## Acceptance Criteria

1. `GET /api/plugins/subway-scaler/instruments` returns all five instruments: `guitar-standard`, `bass-4-standard`, `bass-5-standard`, `guitar-7-standard`, `guitar-8-standard`
2. New instruments have correct tunings: `bass-5-standard` = [23,28,33,38,43] (B0–G2), `guitar-7-standard` = [35,40,45,50,55,59,64] (B1–E4), `guitar-8-standard` = [30,35,40,45,50,55,59,64] (F#1–E4)
3. Each instrument: `stringCount == len(tuning)`, tuning strictly increasing, all values in [21,108]
4. `PUT /api/plugins/subway-scaler/settings` accepts `instrument_id` values of the three new instruments (validation passes)
5. All existing contract tests pass unmodified
6. `tests/contract/test_instruments.py` extended to assert all five IDs present and new instrument fields are correct

## Tasks / Subtasks

- [ ] Update `services/schemas.py` validators (AC: 1, 2, 3)
  - [ ] `Instrument.stringCount`: change `le=6` → `le=8`
  - [ ] `Instrument._validate_tuning`: change `len(v) not in (4, 6)` → `len(v) not in (4, 5, 6, 7, 8)`
  - [ ] `StringFretPair.string`: change `le=6` → `le=8`
  - [ ] `VariantTrackSet.base_string`: change `le=6` → `le=8`
- [ ] Add three new instruments to `services/instruments.py` (AC: 1, 2, 3)
  - [ ] `bass-5-standard`: kind="bass", stringCount=5, tuning=[23,28,33,38,43], maxFret=24
  - [ ] `guitar-7-standard`: kind="guitar", stringCount=7, tuning=[35,40,45,50,55,59,64], maxFret=24
  - [ ] `guitar-8-standard`: kind="guitar", stringCount=8, tuning=[30,35,40,45,50,55,59,64], maxFret=24
- [ ] Extend `tests/contract/test_instruments.py` (AC: 5, 6)
  - [ ] Add new IDs to `REQUIRED_IDS` set (or add separate assertions)
  - [ ] Assert each new instrument's kind, stringCount, tuning, maxFret
- [ ] Run `pytest tests/contract/test_instruments.py tests/contract/test_settings_put.py` and confirm all pass (AC: 4, 5)

## Dev Notes

### `services/schemas.py` — exact changes

Current state (lines to change):

```python
# Line ~78
class Instrument(BaseModel):
    stringCount: int = Field(..., ge=4, le=6)   # ← change le=6 to le=8

# Line ~94 in _validate_tuning
    if len(v) not in (4, 6):                    # ← change to (4, 5, 6, 7, 8)
        raise ValueError("tuning length must be 4 or 6")  # update message too

# Line ~36
class StringFretPair(BaseModel):
    string: int = Field(..., ge=1, le=6)         # ← change le=6 to le=8

# Line ~157
class VariantTrackSet(BaseModel):
    base_string: int = Field(1, ge=1, le=6)      # ← change le=6 to le=8
```

### `services/instruments.py` — new entries

Add to `_RAW` list after `bass-4-standard`:

```python
Instrument(
    id="bass-5-standard",
    name="Bass 5-string (Standard)",
    kind="bass",
    stringCount=5,
    tuning=[23, 28, 33, 38, 43],  # B0, E1, A1, D2, G2
    maxFret=24,
),
Instrument(
    id="guitar-7-standard",
    name="Guitar 7-string (Standard)",
    kind="guitar",
    stringCount=7,
    tuning=[35, 40, 45, 50, 55, 59, 64],  # B1, E2, A2, D3, G3, B3, E4
    maxFret=24,
),
Instrument(
    id="guitar-8-standard",
    name="Guitar 8-string (Standard)",
    kind="guitar",
    stringCount=8,
    tuning=[30, 35, 40, 45, 50, 55, 59, 64],  # F#1, B1, E2, A2, D3, G3, B3, E4
    maxFret=24,
),
```

MIDI note reference (C4=60, formula: `12*(octave+1) + semitone`):
- B0 = 23, E1 = 28, A1 = 33, D2 = 38, G2 = 43
- B1 = 35, E2 = 40, A2 = 45, D3 = 50, G3 = 55, B3 = 59, E4 = 64
- F#1 = 30

### `tests/contract/test_instruments.py` — extension

The existing test checks `REQUIRED_IDS = {"guitar-standard", "bass-4-standard"}`. Extend it:

```python
REQUIRED_IDS = {
    "guitar-standard", "bass-4-standard",
    "bass-5-standard", "guitar-7-standard", "guitar-8-standard",
}

# Add assertions for new instruments inside the existing test or as new parametrized cases:
NEW_INSTRUMENTS = {
    "bass-5-standard":    {"kind": "bass",   "stringCount": 5, "tuning": [23,28,33,38,43]},
    "guitar-7-standard":  {"kind": "guitar", "stringCount": 7, "tuning": [35,40,45,50,55,59,64]},
    "guitar-8-standard":  {"kind": "guitar", "stringCount": 8, "tuning": [30,35,40,45,50,55,59,64]},
}
for inst_id, expected in NEW_INSTRUMENTS.items():
    inst = by_id[inst_id]
    assert inst["kind"] == expected["kind"]
    assert inst["stringCount"] == expected["stringCount"]
    assert inst["tuning"] == expected["tuning"]
    assert inst["maxFret"] == 24
```

### `settings.py` — no change needed

`validate_and_save` already delegates to `instruments_service.INSTRUMENTS` lookup (line 101). Once the new IDs are in the registry, settings validation for them works automatically.

### `tokens.js` — no change needed

`STRING_COLORS` already has 8 entries (indices 0–7). All new instrument string counts are covered.

### Project Structure Notes

- `services/instruments.py` — module-level singleton `INSTRUMENTS` dict; adding to `_RAW` is safe, the dict is rebuilt at import time
- `services/schemas.py` — Pydantic v2 validators use `@field_validator` with `@classmethod` (project rule: never use v1 `validator`)
- All modules use `from __future__ import annotations` (project rule — add if missing)
- Test location: `tests/contract/` for API contract tests

### References

- [Source: services/instruments.py] — existing `_RAW` list and `Instrument` constructor pattern
- [Source: services/schemas.py#Instrument] — `stringCount`, `tuning` validators to update
- [Source: services/schemas.py#StringFretPair] — `string` field `le=6` to update
- [Source: services/schemas.py#VariantTrackSet] — `base_string` field `le=6` to update
- [Source: services/settings.py#validate_and_save] — instrument validation via INSTRUMENTS dict (line 101)
- [Source: tests/contract/test_instruments.py] — existing test structure to extend

## Dev Agent Record

### Agent Model Used

_tbd_

### Debug Log References

### Completion Notes List

### File List
