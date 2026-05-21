# Story 2.1: Analyse and Document game_engine.py

Status: review

**Epic:** 2 — Game Engine Migration
**Story ID:** 2.1
**Story Key:** 2-1-analyse-and-document-game-engine-py

---

## Story

As a developer,
I want a written analysis of `game_engine.py`'s game loop phases, cart state transitions, and difficulty scaling formula,
so that the Epic 2 porting work starts from a clear map rather than live reverse-engineering.

---

## Acceptance Criteria

**AC-1 — Output document exists:**
`docs/game-engine-analysis.md` created and documents all items below.

**AC-2 — Cart/wave state transitions:**
All cart/wave state transitions with entry/exit conditions documented. Include: wave spawning trigger, wave queue lookahead, wave pruning rule, cart movement formula, collision detection (note: absent in Python — see discrepancies).

**AC-3 — Difficulty scaling formula:**
Document speed multiplier per correct note, base speed per difficulty level, wave spacing formula, and cart frequency calculation. Exact constants from source.

**AC-4 — Python→JS GameState mapping:**
Table mapping each Python `GameSession` field to the planned JS `GameState` shape (or "no JS equivalent" if dropped).

**AC-5 — Edge cases and implicit assumptions:**
Document: descending scale note-drop logic, `required_timestamp_ms` gate, octave loop detection, variant shift constants, session cleanup TTL. Flag anything surprising.

**AC-6 — Discrepancies with Architecture doc:**
All divergences between `game_engine.py` behavior and the Architecture document listed explicitly with recommended resolution for Stories 2.2 and 2.3.

**AC-7 — Document reviewed before Story 2.2:**
sprint-status.yaml for 2-2 stays backlog until this story is done.

---

## Tasks / Subtasks

- [x] Task 1: Read and annotate game_engine.py fully (AC: 2, 3, 4, 5)
  - [x] Read `services/game_engine.py` top to bottom — do NOT skim
  - [x] Read `services/schemas.py` for GameSession, CartWave, VariantTrackSet, SwitchWindow shapes
  - [x] Note all constants at module level
- [x] Task 2: Map cart/wave lifecycle (AC: 2)
  - [x] Document: wave spawn trigger (`update_session_state` while-loop condition)
  - [x] Document: wave queue lookahead logic (`WAVE_LOOKAHEAD_MS = 10000`)
  - [x] Document: wave pruning rule (`spawn_time_ms + duration_ms > game_now - 10000`)
  - [x] Document: cart movement formula (frontend-side, not in Python — note as gap)
  - [x] Document: collision detection (NOT in Python — pure JS responsibility)
- [x] Task 3: Document difficulty scaling (AC: 3)
  - [x] Extract `duration_map`: easy=4000ms, medium=2500ms, hard=1500ms
  - [x] Extract `base_speed = 100.0 / base_duration`
  - [x] Extract `speed_multiplier *= 1.05` per correct note
  - [x] Extract wave spacing: `next_deadline_ms += (base_duration * WAVE_SPACING_FACTOR) / speed_multiplier`
  - [x] Extract `WAVE_SPACING_FACTOR = 0.4`
  - [x] Note: NO speed cap in Python — flag as discrepancy
- [x] Task 4: Build Python→JS mapping table (AC: 4)
  - [x] Map all GameSession fields to JS GameState sub-objects
  - [x] Mark fields dropped in JS (session_id, timestamps, REST-specific state)
- [x] Task 5: Document edge cases (AC: 5)
  - [x] Descending scale: last note dropped to prevent root duplicate on loop
  - [x] `required_timestamp_ms` gate: prevents replaying note too early
  - [x] Octave loop: `current_note_index == 0 && prev_idx == len(notes) - 1`
  - [x] Variant shifts: `VARIANT_SHIFT_UP = 5`, `VARIANT_SHIFT_DOWN = 2` semitones
  - [x] Session cleanup TTL: 3600 seconds
- [x] Task 6: Document discrepancies (AC: 6)
  - [x] List each divergence with recommended JS resolution
- [x] Task 7: Write `docs/game-engine-analysis.md` (AC: 1–6)
  - [x] Use the content from tasks 1–6 to produce the document
  - [x] Document must be self-contained — dev agent for Story 2.2 should need nothing else

---

## Dev Notes

### Source files to read

| File | Purpose |
|------|---------|
| `services/game_engine.py` | Primary source — full read required |
| `services/schemas.py` | GameSession, CartWave, VariantTrackSet, SwitchWindow, SpeedMultiplier shapes |
| `_bmad-output/planning-artifacts/architecture.md` | Compare against — discrepancy detection |
| `_bmad-output/planning-artifacts/epics.md` | Story 2.2 / 2.3 ACs for comparison |

### Output file

`docs/game-engine-analysis.md` — create this directory if not present. `docs/` dir already exists at project root.

### Key findings (pre-analyzed — verify these in source)

**Constants at module level (`game_engine.py` lines 19–26):**
```python
OCTAVES_PER_VARIANT = 2       # Variant trigger: every 2 completed octave loops
DEFAULT_WINDOW_MS = 10000     # Variant decision window (10s)
VARIANT_SHIFT_UP = 5          # +5 semitones for RIGHT variant
VARIANT_SHIFT_DOWN = 2        # -2 semitones for LEFT variant
```

**Difficulty timing constants (lines 130, 257):**
```python
duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}  # ms per wave focus
base_speed = 100.0 / base_duration  # px/ms — JS uses its own coord system
```

**Speed multiplier (line 197):**
```python
session.speed_multiplier *= 1.05  # 5% per correct note, NO cap
```

**Wave spacing (lines 263–264):**
```python
WAVE_SPACING_FACTOR = 0.4
WAVE_LOOKAHEAD_MS = 10000
next_deadline_ms += (base_duration * WAVE_SPACING_FACTOR) / session.speed_multiplier
```

**Wave pruning (lines 253–255):**
```python
session.waves = [w for w in session.waves
    if w.spawn_time_ms + w.duration_ms > game_now - 10000]
```

**Score increment (line 183):** flat `+100` — no difficulty multiplier in Python.

**Octave loop detection (lines 192–194):**
```python
if session.current_note_index == 0 and prev_idx == len(session.notes) - 1:
    session.octave_loops_completed += 1
```

**Descending scale note-drop (lines 73–74):**
```python
if descending and len(notes) > 1:
    notes = notes[:-1]  # last note = root duplicate, drop it
```

### Known discrepancies to document

| # | Python behavior | Architecture says | Recommended resolution |
|---|----------------|-------------------|----------------------|
| 1 | Score: flat `+100` per note | `100 * difficultyMultiplier` | JS CartSystem uses multiplier (Architecture wins) |
| 2 | No speed cap | "up to configurable cap" | JS DifficultyManager defines cap per difficulty |
| 3 | Speed in px/ms (REST API units) | JS uses rAF deltaTime | JS defines own speed constants — Python values are backend-only |
| 4 | Collision detection: absent | CartSystem.js handles it | Implement purely in JS; no Python port needed |
| 5 | `GameSession` has session_id, timestamps | JS GameState has none | Drop REST session tracking; JS uses rAF timestamps |
| 6 | Wave spawning on REST poll | CartSystem.update() per frame | JS drives spawning; Python REST irrelevant at runtime |

### Python→JS state mapping (partial — complete in document)

| Python `GameSession` field | JS `GameState` equivalent | Notes |
|---------------------------|--------------------------|-------|
| `scale_id` | `GameState.session.scale` | |
| `difficulty` | `GameState.session.difficulty` | |
| `root_midi` | `GameState.session.rootMidi` | |
| `instrument_id` | `GameState.session.instrument` | |
| `current_score` | `GameState.runtime.score` | |
| `speed_multiplier` | `GameState.runtime.speed` (combined) | JS merges base_speed * multiplier |
| `status` | `GameState.runtime.phase` | Python: "running"/"paused"/"failed" → JS PHASES |
| `waves` | `GameState.scene.carts` | Shape differs — see wave→cart shape map |
| `session_id` | (none) | REST-only; dropped in JS |
| `started_at_ms` | (none) | JS uses rAF timestamp; not persisted |
| `next_deadline_ms` | (internal to CartSystem) | CartSystem tracks spawn cursor privately |
| `total_waves_spawned` | (internal to CartSystem) | |
| `octave_loops_completed` | (internal to DifficultyManager) | |
| `active_variant` / `active_window` | Epic 5 scope | Not in Epic 2 |

### Architecture compliance

- This is a documentation story — no JS files created
- Output is `docs/game-engine-analysis.md`
- Python source files: read-only, no changes
- No tests required for this story

### Testing

No test files for this story. Story completion = document exists and passes review.

### References

- `services/game_engine.py` — primary source
- `services/schemas.py` — GameSession, CartWave shapes
- `_bmad-output/planning-artifacts/architecture.md` — "Gap Analysis" section documents known divergences
- `_bmad-output/planning-artifacts/epics.md` — Epic 2 story ACs (2.2, 2.3)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Read `services/game_engine.py` (599 lines) and `services/schemas.py` fully
- Documented all 6 module-level constants; discovered forced `octaves=1, descending=True` override not in story pre-analysis
- Mapped all 27 `GameSession` fields to JS equivalents or "dropped"
- Documented 6 discrepancies with Architecture doc; all have recommended JS resolutions
- Key finding: Python score is flat +100; Architecture and Story 2.2 AC-4 specify `100 * difficultyMultiplier` — Architecture wins for JS
- Created `docs/game-engine-analysis.md` — self-contained reference for Stories 2.2 and 2.3

### File List

- `docs/game-engine-analysis.md` (created)

### Change Log

- 2026-05-21: Created game-engine-analysis.md covering AC-1 through AC-6
