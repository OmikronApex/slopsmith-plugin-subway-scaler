# Contract: POST /api/plugins/subway_scaler/game/start

**Purpose**: Initialize a new game session with a selected scale.

**Protocol**: HTTP POST | JSON Request/Response

---

## Request

```json
{
  "scale_id": "major",
  "difficulty": "easy"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scale_id | string | yes | ID of the scale to play (e.g., "major", "minor", "pentatonic") |
| difficulty | string | no | Difficulty level: "easy" \| "medium" \| "hard" (default: "easy") |

### Validation

- `scale_id` must reference a valid scale in scales.json
- `difficulty` if provided must be one of: easy, medium, hard

---

## Response (Success)

**Status Code**: 200 OK

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "initial_track": 2,
  "root_note": {
    "note_id": "C4",
    "midi": 60,
    "fret": 3,
    "string": 2
  },
  "first_wave": {
    "wave_id": "w-1",
    "safe_track": 2,
    "spawn_time_ms": 0,
    "speed_px_per_ms": 0.1,
    "duration_ms": 2500
  },
  "game_state": {
    "status": "running",
    "score": 0,
    "difficulty_level": 0,
    "speed_multiplier": 1.0,
    "current_track": 2
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| session_id | string (UUID) | Unique identifier for this game session |
| initial_track | int [0-5] | Initial track player is positioned on (not root track) |
| root_note | Note object | Root note of the scale (first note to play) |
| first_wave | CartWave object | First cart wave approaching |
| game_state | GameState object | Current game state snapshot |

---

## Response (Validation Error)

**Status Code**: 400 Bad Request

```json
{
  "error": "invalid_scale",
  "message": "Scale 'invalid_scale' not found"
}
```

---

## Errors

| Status | Error Code | Message | Cause |
|--------|-----------|---------|-------|
| 400 | invalid_scale | Scale '{scale_id}' not found | scale_id doesn't exist |
| 400 | invalid_difficulty | Difficulty must be 'easy', 'medium', or 'hard' | invalid difficulty value |
| 500 | internal_error | Failed to initialize session | Server error |

---

## Example Usage (JavaScript)

```javascript
const response = await fetch('/api/plugins/subway_scaler/game/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scale_id: 'major',
    difficulty: 'easy'
  })
});

const data = await response.json();
if (response.ok) {
  sessionId = data.session_id;
  startGameLoop(data.game_state, data.first_wave);
} else {
  console.error(data.message);
}
```

