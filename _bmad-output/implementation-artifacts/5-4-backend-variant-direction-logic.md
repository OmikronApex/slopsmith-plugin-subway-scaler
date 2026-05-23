# Story 5-4: Backend Variant Direction Logic

**Status:** backlog

**Epic:** 5 — Variant Track System
**Story ID:** 5-4
**Story Key:** 5-4-backend-variant-direction-logic
**Depends on:** 5-3
**Prerequisite for:** 5-5

---

## Context

### Scale range
The game plays the **full scale across all strings** from the lowest (root) to the highest
string on the instrument, constrained to a maximum of 3 frets per string. This is already
implemented in `_build_full_scale_notes` in `game_engine.py` and does NOT play just one octave.
The session note array contains ascending notes followed by descending notes (minus the
final root to avoid a duplicate at loop wrap-around).

### Traversal and pass direction
The player continuously alternates between ascending passes (low to high string, UP) and
descending passes (high to low string, DOWN). Every 3rd completed pass, the backend proposes
a variant. The direction of the variant depends on which direction the 3rd pass was:

- 3rd pass = UP (ascending, low to high) → propose **RIGHT** variant
- 3rd pass = DOWN (descending, high to low) → propose **LEFT** variant

Example cycle: Up, Down, Up → RIGHT offer; Down, Up, Down → LEFT offer.
After accepting or timing out, the counter resets and the pattern repeats.

This logic is already implemented (`SCALES_PER_VARIANT = 3`, `last_pass_direction`, `propose_variant`).

### Variant anchor notes
- **RIGHT**: the trigger/anchor note = `max(note.midi for note in session.notes) + 2`
  (2 frets above the highest scale note the player just reached). This is already implemented
  in `_candidate_root_for_side`.
- **LEFT**: the trigger/anchor note = `session.root_midi - 2` (2 frets below the current
  root). Already implemented.

### What changes in this story: accept behavior
The `accept_variant` function currently sets `current_note_index = 1` for both sides and
treats `variant.root_midi` as the new session root regardless of direction. This needs to
change:

**LEFT accept:**
- `variant.root_midi` = new scale's root. Build scale normally with this root.
- After accept, the new scale plays **UP** (ascending) starting at the transition note itself.
- `session.current_note_index = 0` — player plays the transition note first, then second note, etc.
- The current code sets index to `1`, skipping the transition note. Fix: set to `0`.

**RIGHT accept:**
- `variant.root_midi` = `old_highest + 2` = the **highest note** of the new scale, NOT the root.
- The new scale must be built such that its highest note equals `variant.root_midi`. This
  requires finding the actual root_midi that, when passed to `_build_full_scale_notes`, yields
  a scale whose apex = `variant.root_midi`.
- After accept, the new scale plays **DOWN** (descending). The transition note (apex) has
  already been played as the acceptance trigger, so the first note to play is one step below
  the apex: `current_note_index = new_asc_count` (first descending note in the notes array).
- `session.root_midi` must be updated to the computed new root (not `variant.root_midi`).

---

## User Story

As a player,
I want each accepted variant to immediately continue in the natural direction from the
transition note — ascending from the new root after a LEFT transition, and descending from the
new apex after a RIGHT transition — so that the scale flows without an awkward direction
reversal or skipped note at the transition point.

---

## Acceptance Criteria

**AC-1 — RIGHT: `_candidate_root_for_side(session, "RIGHT")` returns highest note + 2:**
Given a session with a known scale (e.g. C major with highest note E4, MIDI 64), the function
returns MIDI 66 (two semitones above the highest note). Verified by unit test.
*(Already implemented — keep tests green.)*

**AC-2 — LEFT: `_candidate_root_for_side(session, "LEFT")` returns root − 2:**
Returns `session.root_midi - 2`. Verified by unit test.
*(Already implemented — keep tests green.)*

**AC-3 — LEFT accept: scale starts at transition note, ascending:**
After `accept_variant` for a LEFT variant:
- `session.root_midi` = `variant.root_midi` (the new scale's root = transition note).
- `session.current_note_index` = `0` — the first note the player must play is the transition
  note itself (`notes[0]`), followed by `notes[1]`, ascending.
- `session.last_pass_direction` = `None`; `session.scale_passes_completed` = `0`.
Verified by unit test asserting `current_note_index == 0` after a LEFT accept.

**AC-4 — RIGHT accept: scale ends at transition note, descending first:**
After `accept_variant` for a RIGHT variant:
- A root is computed such that `_build_full_scale_notes(scale_id, computed_root, instrument)`
  yields a scale whose highest note = `variant.root_midi` (= old_highest + 2).
- `session.root_midi` = `computed_root` (NOT `variant.root_midi`).
- `session.current_note_index` = `new_asc_count` — first note the player plays is the first
  descending note (one step below the apex = transition note).
- `session.last_pass_direction` = `None`; `session.scale_passes_completed` = `0`.
Verified by unit test:
  - Assert `session.notes[session.ascending_note_count - 1].midi == original_highest + 2`.
  - Assert `session.current_note_index == session.ascending_note_count`.

**AC-5 — Boundary: unplayable RIGHT variant handled gracefully:**
If `highest_note_midi + 2` exceeds the instrument's playable range, `_is_playable_root()`
returns `False` and `propose_variant()` falls back to LEFT; if LEFT is also unplayable, returns
`{"success": false, "error": "no_playable_variant"}`. Verified by unit test.

**AC-6 — Contract tests updated:**
All assertions in `tests/contract/test_scale_notes.py` and `tests/contract/test_variant.py`
that touch `current_note_index` or `root_midi` after accept are updated to match AC-3 / AC-4.

**AC-7 — Integration tests updated:**
All assertions in `tests/integration/test_variant_flow.py` pass with the new accept behavior.

**AC-8 — Full test suite passes:**
`.venv/Scripts/python.exe -m pytest tests/` exits with 0 failures.

---

## Tasks / Subtasks

- [ ] Task 1 — Pre-flight audit
  - Run before touching any code:
    ```bash
    grep -n "current_note_index" services/game_engine.py
    grep -rn "current_note_index\|root_midi" tests/
    ```
  - Document every hit. The expected delta: one block in `accept_variant` and N test
    assertion lines.

- [ ] Task 2 — Fix LEFT accept: `current_note_index = 0`
  - In `accept_variant`, locate:
    ```python
    session.current_note_index = 1 % len(new_notes) if new_notes else 0
    ```
  - Replace with a branch:
    ```python
    if variant.side == "LEFT":
        session.current_note_index = 0
    else:
        # RIGHT: see Task 3
        ...
    ```

- [ ] Task 3 — Implement RIGHT accept: find root for target highest note
  - In `accept_variant`, RIGHT branch:
    1. `target_highest_midi = variant.root_midi`
    2. Search for a `candidate_root` (scan from `target_highest_midi` downward, e.g. try
       `target_highest_midi - interval` for each semitone offset from 1 to 36) such that
       `_build_full_scale_notes(scale_id, candidate_root, instrument)` yields a scale
       whose apex (`notes[asc_count - 1].midi`) equals `target_highest_midi`.
    3. If no root found, fall back: keep current root and start descending from current apex.
    4. Set `session.root_midi = candidate_root`.
    5. Rebuild notes with `_build_full_scale_notes(scale_id, candidate_root, instrument)`.
    6. Set `session.current_note_index = new_asc_count`.
  - Store `total_notes_played = 0` and `current_track = variant.base_lane` as before.

- [ ] Task 4 — Update unit tests for LEFT and RIGHT accept (AC-3, AC-4)
  - Add or update tests asserting:
    - LEFT: `session.current_note_index == 0` and `session.root_midi == variant_root`
    - RIGHT: `session.notes[session.ascending_note_count - 1].midi == target_highest` and
      `session.current_note_index == session.ascending_note_count`

- [ ] Task 5 — Update contract and integration tests (AC-6, AC-7)
  - In `tests/contract/test_variant.py` and `tests/integration/test_variant_flow.py`, update
    `current_note_index` and `root_midi` assertions to match the new behavior.

- [ ] Task 6 — Run full suite (AC-8)
  - `.venv/Scripts/python.exe -m pytest tests/ -v`
  - All tests green. Fix any remaining assertion mismatches before marking done.

---

## Dev Notes

### Scale range — already implemented

`_build_full_scale_notes` generates the scale from the root up to the highest string on the
instrument (capped at 3 frets per string), then mirrors it descending. The `octaves` param in
`scales.expand` is computed dynamically from the instrument's string range. Do NOT limit to
one octave. Do NOT change this function's scale-generation logic.

### session.notes structure

```
index: 0    1    2  ...  asc_count-1  |  asc_count  asc_count+1  ...  len-1
note:  root 2nd  3rd ... apex(highest)|  apex-1     apex-2        ... 2nd
```

`ascending_note_count` = number of ascending notes including the apex.
- `notes[0]` = root = lowest note
- `notes[ascending_note_count - 1]` = apex = highest note
- `notes[ascending_note_count]` = first descending note (one step below apex)
- `notes[-1]` = second note (the final root is dropped to avoid duplicate at wrap)

### LEFT accept: start at index 0

`notes[0]` = transition note (= new root = old_root - 2). Starting at 0 means the player
plays the transition note again as the first game note, which confirms their new position
before ascending. This is intentional — it mirrors the physical act of "landing" on the new
root.

### RIGHT accept: find root for target highest

The target apex is `variant.root_midi = old_highest + 2`. `_build_full_scale_notes` does not
expose a "given highest, find root" API, so search:

```python
def _find_root_for_highest(self, scale_id, target_highest, instrument):
    for semitone_offset in range(2, 37):  # scales don't span more than ~3 octaves
        candidate = target_highest - semitone_offset
        if not self._is_playable_root(candidate, instrument):
            continue
        notes, asc_count = self._build_full_scale_notes(scale_id, candidate, instrument)
        if notes and notes[asc_count - 1].midi == target_highest:
            return candidate, notes, asc_count
    return None, None, None
```

If no root is found (e.g. the scale gap doesn't land on the target), fall back to using the
current session root and starting descending from the current apex.

### RIGHT accept: current_note_index

After the player plays the transition note (apex) to trigger the accept, that note is already
consumed. The next note to play is `notes[ascending_note_count]` (first descending step). This
gives the player the experience of "arriving at the new highest note and immediately coming
back down."

### Pass counter and direction mapping

```python
# Already in play_note — DO NOT change:
if apex_reached:
    session.scale_passes_completed += 1
    session.last_pass_direction = "UP"
elif root_reached:
    session.scale_passes_completed += 1
    session.last_pass_direction = "DOWN"

# Already in propose_variant — DO NOT change:
side = "RIGHT" if session.last_pass_direction == "UP" else "LEFT"
```

After a RIGHT accept the counter resets to 0, direction = None. The next pass will be DOWN
(descending), so after 3 passes (DOWN, UP, DOWN) the next offer will be LEFT. This gives the
pattern: …RIGHT offer, Down, Up, Down, LEFT offer, Up, Down, Up, RIGHT offer, …

### Python venv

Use `.venv/Scripts/python.exe -m pytest tests/` — plain `pytest` is not on PATH.

---

## Dev Agent Record

_(filled in by dev agent after implementation)_

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

### Change Log
