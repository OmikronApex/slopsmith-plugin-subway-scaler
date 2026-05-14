# Data Model: Track-Switching Game

**Created**: 2026-05-14  
**Feature**: [spec.md](spec.md)  
**Status**: Complete

---

## Game State Machine

```
         start()
           ↓
    [IDLE] ──→ [RUNNING]
              ↓        ↑
         tick()        │ resume()
         +note()       │
         ─────→ [PAUSED]
              
         collision or
         deadline miss
              ↓
        [FAILED] ──→ [ABANDONED]
                    (explicit exit)
```

### State Definitions

- **IDLE**: Game ready to start; no session active
- **RUNNING**: Active gameplay; cart waves moving, awaiting note input
- **PAUSED**: Game suspended; cart waves frozen; can resume
- **FAILED**: Player collision or deadline missed; session over
- **ABANDONED**: Player quit during running state

### State Transitions

| From | To | Trigger | Precondition |
|------|---|---------|---|
| IDLE | RUNNING | `start(nowMs)` | None |
| RUNNING | PAUSED | `pause(nowMs)` | state === RUNNING |
| PAUSED | RUNNING | `resume(nowMs)` | state === PAUSED |
| RUNNING | FAILED | `tick(nowMs)` OR `collide()` | deadline passed OR wrong track |
| any | ABANDONED | `abandon()` | state !== (FAILED \| SUCCEEDED) |

---

## Core Entities

### GameSession

Represents one game session from start to end.

```
{
  session_id: string (UUID),
  status: "running" | "paused" | "failed" | "abandoned",
  scale_id: string,
  current_score: int,                  # Number of correct notes
  current_track: int (0-5),            # Which string (0=high E, 5=low E)
  difficulty_level: int (0+),          # Starts at 0, increments per note
  speed_multiplier: float,             # 1.0 + (0.1 * difficulty_level)
  sequence: ScaleProgression,
  current_note_index: int,
  started_at_ms: int,
  ended_at_ms: int | null,
  next_deadline_ms: int
}
```

### ScaleProgression

Tracks position within ascending/descending scale loop.

```
{
  scale_id: string,
  notes: Note[],                      # Full ascending scale notes
  current_index: int,                 # Index into notes array
  is_ascending: bool,                 # true = ascending (0→N), false = descending (N→0)
  
  // Helper methods
  next_note() → Note:
    if is_ascending:
      if current_index >= notes.length - 1:
        is_ascending = false
        current_index = notes.length - 2  # Skip duplicate root
        return notes[current_index]
      else:
        current_index += 1
        return notes[current_index]
    else:
      if current_index <= 0:
        is_ascending = true
        current_index = 1  # Skip duplicate root
        return notes[current_index]
      else:
        current_index -= 1
        return notes[current_index]
}
```

### CartWave

One row of subway carts passing the player.

```
{
  wave_id: string (UUID),
  safe_track: int (0-5),               # Which track is empty
  carts: Cart[6],                      # All 6 tracks
  spawn_time_ms: int,
  speed_px_per_ms: float,              # Scales with difficulty
  z_position: float,                   # Current position (0 = player position)
  
  // Carts are simple: { track: int, x_position: float, z_position: float }
}
```

### SafeZoneTrack

Visual representation of safe zone (colored track).

```
{
  zone_id: string (UUID),
  track: int (0-5),
  color: string (hex),                 # e.g., "#FF0000" (red for root)
  start_z: float (-20),
  speed_px_per_ms: float,              # Same as wave it precedes
  duration_ms: int,                    # Time window for player input
  spawn_time_ms: int,
  visible: bool
}
```

### Note

Represents a single note in the scale.

```
{
  note_id: string (e.g., "C4"),
  midi: int (0-127),
  fret: int (0-22),                    # Guitar fret
  string: int (0-5),                   # Which string
  note_name: string (e.g., "C")
}
```

### DifficultyLevel

Tracks game speed and time pressure.

```
{
  level: int,
  speed_multiplier: float = 1.0 + (0.1 * level),
  time_per_note_ms: int = max(800, 2500 - (level * 50)),
  cart_speed_px_per_ms: float = 0.1 * speed_multiplier
}
```

---

## Game Logic Flow

### Initialization (Game Start)

1. Player selects scale
2. `GameSession.start(scale_id, user_settings)` called
3. ScaleProgression initialized with ascending scale notes
4. First CartWave generated (speed_multiplier = 1.0)
5. First SafeZoneTrack generated (shows root note track in red)
6. Render loop begins

### Per-Frame Update (tick)

1. `tick(nowMs)` called at ~60 fps
2. Update CartWave z_position based on speed
3. Update SafeZoneTrack z_position
4. Check for deadline: if nowMs >= next_deadline_ms → FAILED
5. Render carts and safe zones at current positions
6. Check if player in correct track when safe zone reaches player position

### Note Input Handler (play_note)

1. Frontend detects pitch → maps to MIDI note
2. `play_note(session_id, detected_midi, timestamp_ms)` called
3. Server validates:
   - Is expected_note.midi === detected_midi? (with tolerance)
   - Is timestamp_ms within valid window?
4. If valid:
   - Increment current_score
   - Increment difficulty_level → recalculate speed_multiplier
   - Advance ScaleProgression.next_note()
   - Move character to safe track
   - Generate next CartWave + SafeZoneTrack at higher speed
   - Reset next_deadline_ms
5. If invalid:
   - Set status = FAILED
   - Record final_score
   - Render end screen

### Collision Detection

SafeZone reaches player position at z=0:

```
if safe_zone.z_position >= 0 AND safe_zone.z_position <= player_collision_threshold:
  if player.current_track === safe_zone.track:
    # SUCCESS: Player was in correct track
    trigger_note_acceptance()
  else:
    # COLLISION: Player in wrong track
    trigger_collision()
    status = FAILED
```

---

## Validation Rules

### Track Index
- Must be int in range [0, 5] (6 strings)
- Mapped to guitar strings: 0=high E, 5=low E

### MIDI Note
- Must be int in range [0, 127]
- Tolerance: ±50 cents (from runState.js toleranceCents)

### Difficulty Level
- Must be int >= 0
- Speed multiplier = 1.0 + (0.1 * level)
- Speed caps out at 2.5x for playability

### Timestamp
- Must be int in milliseconds
- Must be <= now (server time)
- Must be >= last_deadline_ms (within window)

### Scale ID
- Must reference valid scale in scales.json (from 004-scale-json-tabulator)
- Must contain ≥3 notes for viable gameplay

---

## State Persistence & Recovery

### Session Lifetime
- Created at game start
- Destroyed when status = FAILED or ABANDONED
- No cross-session persistence (single-player)

### Frontend State Sync
- Frontend maintains local copy of GameSession state
- Polls server at 100-200ms interval for authoritative state
- If poll returns FAILED, render end screen
- On reconnect (if network glitch), recover from server state

---

## Performance Notes

### Cart Pool
- Reuse CartWave objects when old waves exit (spawn Z > screen bounds)
- Target: 4-8 active carts at a time (6 per wave × 1-2 waves on screen)

### Safe Zone Pool
- Reuse SafeZoneTrack objects similarly
- Only one visible at a time (follows behind wave)

### Rendering
- Three.js CartRenderer.updateMeshPosition() called each tick
- SafeZoneRenderer.updateMeshPosition() called each tick
- All animations driven by z_position calculations in GameSession state

