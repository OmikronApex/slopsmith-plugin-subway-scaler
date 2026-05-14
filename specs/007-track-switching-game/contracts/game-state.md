# Contract: GET /api/plugins/subway_scaler/game/{session_id}

**Purpose**: Retrieve current game state (for polling / synchronization).

**Protocol**: HTTP GET | JSON Response

---

## Request

No body. Query parameters optional:

```
GET /api/plugins/subway_scaler/game/550e8400-e29b-41d4-a716-446655440000
```

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| session_id | string | yes | UUID of active game session |

---

## Response (Game Running)

**Status Code**: 200 OK

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "score": 3,
  "difficulty_level": 3,
  "speed_multiplier": 1.3,
  "current_track": 2,
  "expected_note": {
    "note_id": "E4",
    "midi": 64,
    "fret": 7,
    "string": 2
  },
  "active_waves": [
    {
      "wave_id": "w-4",
      "safe_track": 2,
      "z_position": -8.5,
      "speed_px_per_ms": 0.13,
      "time_to_collision_ms": 650
    },
    {
      "wave_id": "w-5",
      "safe_track": 0,
      "z_position": -15.0,
      "speed_px_per_ms": 0.13,
      "time_to_collision_ms": 1150
    }
  ],
  "active_safe_zone": {
    "zone_id": "sz-4",
    "track": 2,
    "color": "#FF0000",
    "z_position": -8.5,
    "time_to_player_ms": 650
  },
  "next_deadline_ms": 2150,
  "elapsed_ms": 1500
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| session_id | string | Game session ID |
| status | string | "running" \| "paused" \| "failed" \| "abandoned" |
| score | int | Number of correct notes played |
| difficulty_level | int | Current difficulty (0+) |
| speed_multiplier | float | Current speed scalar (1.0+) |
| current_track | int [0-5] | Current player track position |
| expected_note | Note object | Next note the player must play |
| active_waves | CartWave[] | Cart waves currently on screen |
| active_safe_zone | SafeZone object | Current safe zone highlight |
| next_deadline_ms | int | Milliseconds until deadline miss |
| elapsed_ms | int | Milliseconds elapsed since session start |

---

## Response (Game Failed)

**Status Code**: 200 OK

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "score": 7,
  "difficulty_level": 7,
  "speed_multiplier": 1.7,
  "final_score": 7,
  "reason": "wrong_note",
  "ended_at_ms": 3450
}
```

---

## Response (Session Not Found)

**Status Code**: 404 Not Found

```json
{
  "error": "session_not_found",
  "message": "Session 'invalid-session-id' not found or expired"
}
```

---

## Errors

| Status | Error Code | Message | Cause |
|--------|-----------|---------|-------|
| 404 | session_not_found | Session not found or expired | Invalid/expired session_id |
| 500 | internal_error | Failed to retrieve game state | Server error |

---

## Polling Strategy

Frontend should poll at 100-200ms interval during active gameplay:

```javascript
const pollGameState = async () => {
  if (!gameRunning) return;
  
  const response = await fetch(`/api/plugins/subway_scaler/game/${sessionId}`);
  const state = await response.json();
  
  if (state.status === 'failed') {
    endGameScreen(state.final_score);
  } else if (state.status === 'running') {
    updateGameDisplay(state);
    scheduleNextPoll();
  }
};

// Poll every 100-200ms
setInterval(pollGameState, 150);
```

---

## Example Usage (JavaScript)

```javascript
const updateGameDisplay = async () => {
  const response = await fetch(`/api/plugins/subway_scaler/game/${sessionId}`);
  const state = await response.json();
  
  // Update visual elements
  moveCartsTo(state.active_waves);
  moveSafeZoneTo(state.active_safe_zone);
  displayNextNote(state.expected_note);
  updateScore(state.score);
  updateDifficulty(state.difficulty_level);
  updateDeadlineWarning(state.next_deadline_ms);
};
```

