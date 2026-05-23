# Game Engine Analysis — `game_engine.py`

_Generated for Epic 2 (Game Engine Migration). Stories 2.2 and 2.3 must read this before writing any code._

> **⚠️ Architecture note (2026-05-23):** `CartSystem.js`, `GameLoop.js`, `DifficultyManager.js`, and `ui/score-display.js` have been removed. Wave scheduling migrated to `WaveScheduler.js` (owned by `main.js`). Speed scaling is applied in `game_engine.py` (`speed_multiplier *= 1.05`) and exposed via `timing_params` at session start. References to those removed modules below reflect the original design intent and are no longer accurate.

---

## 1. Module-Level Constants

```python
# game_engine.py lines 19–25
OCTAVES_PER_VARIANT = 2       # Trigger variant offer after N completed octave loops
DEFAULT_WINDOW_MS   = 10000   # Variant decision window: 10 s
VARIANT_SHIFT_UP    = 5       # +5 semitones for RIGHT variant
VARIANT_SHIFT_DOWN  = 2       # -2 semitones for LEFT variant

# GameEngine class constants (lines 232–236)
WAVE_LOOKAHEAD_MS   = 10000   # Keep this many ms of carts queued ahead
WAVE_SPACING_FACTOR = 0.4     # < 1.0 → carts arrive closer together
```

---

## 2. Cart / Wave State Lifecycle (AC-2)

### 2.1 Session Initialisation

`create_session()` always forces `octaves=1, descending=True` regardless of caller arguments (lines 68–70). This is a **hardcoded override**, not a parameter default.

Initial wave (`w-0`) is created inline with:
- `spawn_time_ms = 0` (game-relative ms)
- `speed_px_per_ms = 100.0 / base_duration` (REST coordinate system)
- `duration_ms = base_duration` (difficulty-dependent)
- `next_deadline_ms = base_duration` (T when first cart reaches player)
- `total_waves_spawned = 1`
- `next_wave_note_index = 1` (wave spawner starts from note index 1, skipping the root that was used for wave 0)

### 2.2 Wave Spawn Trigger

`update_session_state()` is called on every REST poll (not per frame — there is no frame loop in Python). The spawn loop runs as long as:

```python
session.next_deadline_ms < game_now + WAVE_LOOKAHEAD_MS  # line 261
```

`game_now = now_ms - session.started_at_ms` (elapsed game time in ms).

Each iteration:
1. Advance spawn cursor: `session.next_deadline_ms += (base_duration * WAVE_SPACING_FACTOR) / session.speed_multiplier`
2. Generate wave for `session.notes[next_wave_note_index]`
3. Append to `session.waves`
4. Advance `next_wave_note_index = (next_wave_note_index + 1) % len(session.notes)` (wraps through scale notes continuously)
5. Increment `total_waves_spawned`

### 2.3 Wave Queue Lookahead

`WAVE_LOOKAHEAD_MS = 10000` — always keep 10 seconds of carts pre-generated ahead of current game time.

### 2.4 Wave Pruning Rule

```python
session.waves = [
    w for w in session.waves
    if w.spawn_time_ms + w.duration_ms > game_now - 10000   # line 252–255
]
```

A wave is pruned when its focus window ended more than 10 seconds ago. This prevents `session.waves` from growing unboundedly.

### 2.5 Cart Movement Formula

**Not in Python.** Python only tracks `speed_px_per_ms` as metadata on each `CartWave`. The actual position update (`cart.z -= speed * deltaTime`) is entirely a JS responsibility.

### 2.6 Collision Detection

**Completely absent in Python.** `play_note()` only checks MIDI match for scoring. Collision (cart reaching character without the correct note being played) must be implemented purely in JS `CartSystem.update()`.

---

## 3. Difficulty Scaling Formula (AC-3)

### 3.1 Duration Map

```python
duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}  # ms
base_duration = duration_map.get(difficulty, 2500)
```

This constant appears in three places: `create_session()` (line 130), `update_session_state()` (line 257), and `generate_next_wave()` (line 277).

### 3.2 Base Speed (REST Coordinate System — Do Not Port Literally)

```python
base_speed = 100.0 / base_duration  # px/ms in REST coordinate system (line 135, 283)
```

This is a **backend coordinate system value**. JS uses its own speed units (units/second, rAF deltaTime). Do not use these values in JS — see Discrepancy #3 and Story 2.3 dev notes for JS BASE_SPEED constants.

### 3.3 Speed Multiplier — 5% Per Correct Note, No Cap

```python
session.speed_multiplier *= 1.05   # line 197, play_note()
```

- Initial value: `1.0`
- Incremented on every correct note match
- **No cap** — the multiplier grows without bound in Python
- This is a **discrepancy** — JS DifficultyManager adds per-difficulty caps (see §6)

### 3.4 Wave Spacing Formula

```python
session.next_deadline_ms += (base_duration * WAVE_SPACING_FACTOR) / session.speed_multiplier
```

As `speed_multiplier` grows, the gap shrinks → carts arrive more frequently. Correct interpretation: higher speed = shorter interval between cart arrivals.

### 3.5 Cart Frequency

Determined by the gap formula above. Initial gap (speed_multiplier=1.0, medium difficulty):
```
2500 * 0.4 / 1.0 = 1000 ms between wave deadlines
```

At 2× speed (after ~14 correct notes):
```
2500 * 0.4 / 2.0 = 500 ms between wave deadlines
```

### 3.6 Score Increment

```python
session.current_score += 100   # line 183, play_note() — flat, no difficulty multiplier
```

**Discrepancy** with Architecture AC-4 (`100 * difficultyMultiplier`). JS CartSystem implements the Architecture spec. See §6.

---

## 4. Python → JS GameState Mapping Table (AC-4)

| Python `GameSession` field | JS `GameState` equivalent | Notes |
|---------------------------|--------------------------|-------|
| `scale_id` | `GameState.session.scale` | Loaded from `/game/session-config` |
| `difficulty` | `GameState.session.difficulty` | |
| `root_midi` | `GameState.session.rootMidi` | |
| `instrument_id` | `GameState.session.instrument` | |
| `current_score` | `GameState.runtime.score` | Written by `CartSystem.js` only |
| `speed_multiplier` (combined with base_speed) | `GameState.runtime.speed` | JS merges base speed and multiplier into one value; `DifficultyManager.js` owns |
| `status` | `GameState.runtime.phase` | Python: `"running"/"paused"/"failed"` → JS `PHASES.PLAYING / PHASES.PAUSED / PHASES.GAME_OVER` |
| `waves` | `GameState.scene.carts` | Shape differs — see cart shape map in Story 2.2 dev notes |
| `notes` | `GameState.session.notes` | Loaded once from `/game/session-config`; not mutated at runtime |
| `current_note_index` | `GameState.runtime.currentNoteIndex` | Managed by `GameLoop.js` |
| `num_lanes` | `GameState.session.trackCount` | Loaded from `/game/session-config` |
| `base_fret` | `GameState.session.baseFret` | Loaded from `/game/session-config` |
| `next_wave_note_index` | `CartSystem._nextWaveNoteIndex` | Internal to `CartSystem.js` — NOT on GameState |
| `next_deadline_ms` | `CartSystem._nextDeadlineMs` | Internal to `CartSystem.js` — NOT on GameState |
| `total_waves_spawned` | `CartSystem._totalWavesSpawned` | Internal to `CartSystem.js` — NOT on GameState |
| `octave_loops_completed` | `DifficultyManager.loopCount` | Internal to `DifficultyManager.js` — NOT on GameState |
| `session_id` | (none) | REST-only identifier; dropped in JS |
| `started_at_ms` | (none) | JS uses rAF timestamp; not persisted |
| `ended_at_ms` | (none) | REST-only; dropped |
| `total_notes_played` | (none) | Not tracked in JS runtime; may derive from score if needed |
| `required_timestamp_ms` | (none — see §5) | REST timing gate; JS uses rAF timing natively |
| `active_variant` / `active_window` | Epic 5 scope | Not implemented in Epic 2 |
| `last_variant_side` / `variant_history` | Epic 5 scope | Not implemented in Epic 2 |
| `scale_id_for_variant` | Epic 5 scope | Not implemented in Epic 2 |
| `current_track` | `GameState.scene.character.lane` | Written by `GameLoop.js` |

---

## 5. Edge Cases and Implicit Assumptions (AC-5)

### 5.1 Descending Scale Note-Drop

```python
if descending and len(notes) > 1:
    notes = notes[:-1]   # lines 73–74
```

The last note of a descending scale is the root — identical to `notes[0]`. It is dropped to prevent a duplicate root when the sequence loops. The session therefore loops over `2N - 1` notes (ascending + descending minus repeated root), not `2N`.

**Also:** `create_session()` always forces `octaves=1, descending=True` regardless of arguments (lines 68–70). This is intentional for the endless loop game design.

### 5.2 `required_timestamp_ms` Gate

```python
if timing_ms < session.required_timestamp_ms:
    return {"success": False, "error": "too_early"}   # lines 178–179
```

Prevents the player from replaying the same note before the wave's focus window has elapsed. Initial value is `0` (first note always valid). After a correct note, set to `target_wave.spawn_time_ms + target_wave.duration_ms`.

**JS relevance:** This gate is a REST API concern. In JS, timing is managed by rAF timestamps and CartSystem's `_nextDeadlineMs`. No direct port needed, but the conceptual equivalent is the wave's `spawnTime + duration` window.

### 5.3 Octave Loop Detection

```python
if session.current_note_index == 0 and prev_idx == len(session.notes) - 1:
    session.octave_loops_completed += 1   # lines 192–194
```

Detects when `current_note_index` wraps from the last note back to index 0. In JS, `GameLoop.js` detects this wrap and calls `DifficultyManager.onLoopComplete(gameState)` — `DifficultyManager` does not detect it internally.

### 5.4 Variant Shift Constants

```python
VARIANT_SHIFT_UP   = 5   # RIGHT variant: +5 semitones (avoids overlap with main root)
VARIANT_SHIFT_DOWN = 2   # LEFT variant:  -2 semitones
```

Used in `_candidate_root_for_side()`. JS `DifficultyManager._buildOffer()` must use the same values. Both candidates must be validated against MIDI range [21, 108].

### 5.5 Session Cleanup TTL

```python
def cleanup_sessions(self, ttl_seconds: int = 3600):   # line 320
```

Sessions older than 3600 seconds (1 hour) are removed from the in-memory dict. Called at the start of each `create_session()`. **JS has no session lifecycle** — irrelevant for port, but explains why Python backend is stateless from JS's perspective after session start.

### 5.6 Hardcoded octaves=1, descending=True Override

`create_session()` ignores the `octaves` and `descending` arguments and hardcodes both (lines 68–70). This is **not a bug** — it is an intentional game design choice. Document this so Story 2.2 does not try to "fix" it.

### 5.7 Speed as Derived Value in `generate_next_wave`

```python
current_focus_duration = base_duration / session.speed_multiplier   # line 298
spawn_time_ms = session.next_deadline_ms - current_focus_duration   # line 299
```

The spawn time is computed retrospectively from `next_deadline_ms` minus the focus duration. This means `spawn_time_ms` may be in the past by the time the player polls — that is by design, since the wave was "already in transit".

---

## 6. Discrepancies with Architecture Document (AC-6)

| # | Python `game_engine.py` behavior | Architecture document says | Recommended JS resolution |
|---|-----------------------------------|----------------------------|--------------------------|
| 1 | Score: flat `+100` per correct note (line 183) | `100 * difficultyMultiplier` (AC-4 of Story 2.2) | **Architecture wins.** `CartSystem.js` uses multiplier: easy=1, medium=1.5, hard=2 |
| 2 | No speed cap — `speed_multiplier` grows without bound | "up to configurable cap" per difficulty | **Architecture wins.** `DifficultyManager.js` enforces `Math.min(speed * 1.05, speedCap)` per difficulty |
| 3 | Speed unit: `px/ms` in REST coordinate system (`base_speed = 100.0 / base_duration`) | JS uses `rAF deltaTime` (seconds); JS owns speed constants | **JS defines its own constants.** Do not port Python values. Suggested JS: easy=10, medium=16, hard=25 units/s. Python values are backend-only. |
| 4 | Collision detection: **completely absent** in Python | `CartSystem.js` handles collision → `PHASES.GAME_OVER` | **Implement purely in JS.** No Python port; implement from scratch in `CartSystem.update()` |
| 5 | `GameSession` tracks `session_id`, `started_at_ms`, `ended_at_ms`, REST-specific timing fields | JS `GameState` has none of these | **Drop all REST session tracking.** JS uses rAF timestamps natively. Only port game-logic state. |
| 6 | Wave spawning triggered by REST poll (every ~200ms) | `CartSystem.update()` spawns per rAF frame | **JS drives spawning per frame.** Port `update_session_state` while-loop to `CartSystem._topUpWaveQueue()`. Python REST polling is irrelevant at JS runtime. |

---

## 7. CartWave Shape (Python → JS Cart Object)

Python `CartWave` (from `schemas.py`):

```python
class CartWave(BaseModel):
    wave_id: str
    wave_index: int
    safe_track: int          # fret-relative lane index [0, 11]
    safe_string: Optional[int]  # guitar string [1, 6]
    safe_midi: Optional[int]    # MIDI note for this wave's safe zone
    note_name: Optional[str]
    spawn_time_ms: int          # game-relative ms
    speed_px_per_ms: float      # REST units — DO NOT use in JS
    duration_ms: int
```

JS cart object (plain dict — no class):

```js
{
  z: Number,              // world Z position (JS coordinate system)
  lane: Number,           // maps from Python safe_track
  notemidi: Number,       // maps from Python safe_midi
  cleared: Boolean,       // true after player hit (no Python equivalent)
  safeZoneActive: Boolean,// true while safe zone visible (derived from timing)
  spawnTime: Number,      // ms timestamp (rAF-relative, maps from spawn_time_ms concept)
  duration: Number,       // ms for this wave's focus window
}
```

Python `wave_id`, `wave_index`, `safe_string`, `note_name`, `speed_px_per_ms` are dropped or superseded in JS.

---

## 8. Summary: What Story 2.2 and 2.3 Must Implement

### Story 2.2 — `CartSystem.js`

Port from `update_session_state()` + `generate_next_wave()`:
- `_topUpWaveQueue()` — the `while session.next_deadline_ms < game_now + WAVE_LOOKAHEAD_MS` loop
- Wave pruning — `spawn_time_ms + duration_ms > game_now - 10000`
- Per-frame cart movement: `cart.z -= gameState.runtime.speed * deltaTime` (JS units)
- Collision detection: **new in JS**, no Python equivalent
- Score increment: `100 * difficultyMultiplier` (architecture spec, NOT Python's flat 100)
- Internal state: `_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned`

### Story 2.3 — `DifficultyManager.js`

Port from `play_note()` speed multiplier logic:
- `tick(true)` → `speed = Math.min(speed * 1.05, speedCap)` — port 1.05 exactly, add cap
- `tick(false)` → no-op
- `init(gameState)` → set initial speed from difficulty base constant
- `onLoopComplete(gameState)` → count loops, fire variant offer callback at threshold
- `onDecisionWindowExpired(gameState)` → reset loop counter (no score penalty)
- Variant offer: `rootMidi ± VARIANT_SHIFT_UP/DOWN`, validate MIDI range [21, 108]
- `variantOfferLoopCount`: easy=3, medium=2 (matches `OCTAVES_PER_VARIANT=2`), hard=1
