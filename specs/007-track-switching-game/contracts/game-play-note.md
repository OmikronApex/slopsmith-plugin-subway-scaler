# Contract: POST /api/plugins/subway_scaler/game/{session_id}/play-note

**Purpose**: Submit detected note input and update game state.

**Protocol**: HTTP POST | JSON Request/Response

---

## Request

```json
{
  "midi": 60,
  "timestamp_ms": 1523
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| midi | int [0-127] | yes | MIDI note number detected by frontend |
| timestamp_ms | int | yes | Client timestamp when note was detected (milliseconds since session start) |

### Validation

- `midi` must be int in range [0, 127]
- `timestamp_ms` must be int >= 0
- `session_id` in URL must match active session

---

## Response (Correct Note)

**Status Code**: 200 OK

```json
{
  "success": true,
  "note_correct": true,
  "current_score": 1,
  "difficulty_level": 1,
  "speed_multiplier": 1.1,
  "character_moved_to_track": 2,
  "next_note": {
    "note_id": "D4",
    "midi": 62,
    "fret": 5,
    "string": 2
  },
  "next_wave": {
    "wave_id": "w-2",
    "safe_track": 2,
    "spawn_time_ms": 1523,
    "speed_px_per_ms": 0.11,
    "duration_ms": 2400
  },
  "game_state": {
    "status": "running",
    "score": 1,
    "difficulty_level": 1,
    "speed_multiplier": 1.1,
    "current_track": 2
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| success | bool | true if note was processed |
| note_correct | bool | true if note matched expected note |
| current_score | int | Running count of correct notes |
| difficulty_level | int | Updated difficulty (incremented if correct) |
| speed_multiplier | float | Updated speed multiplier |
| character_moved_to_track | int | Track number character moved to |
| next_note | Note object | Next expected note in sequence |
| next_wave | CartWave object | Next cart wave approaching |
| game_state | GameState object | Updated game state snapshot |

---

## Response (Wrong Note / Collision)

**Status Code**: 200 OK

```json
{
  "success": true,
  "note_correct": false,
  "game_state": {
    "status": "failed",
    "score": 3,
    "difficulty_level": 3,
    "speed_multiplier": 1.3,
    "final_score": 3
  },
  "reason": "wrong_note"
}
```

**OR** (collision detected via timing):

```json
{
  "success": true,
  "note_correct": false,
  "game_state": {
    "status": "failed",
    "score": 5,
    "final_score": 5
  },
  "reason": "deadline_missed"
}
```

---

## Response (Session Not Found)

**Status Code**: 404 Not Found

```json
{
  "error": "session_not_found",
  "message": "Session 'invalid-session-id' not found"
}
```

---

## Errors

| Status | Error Code | Message | Cause |
|--------|-----------|---------|-------|
| 404 | session_not_found | Session not found | Invalid session_id |
| 400 | invalid_midi | MIDI must be 0-127 | MIDI out of range |
| 400 | invalid_timestamp | Timestamp must be >= 0 | Negative timestamp |
| 400 | note_outside_window | Note submitted outside time window | Deadline missed |
| 500 | internal_error | Failed to process note | Server error |

---

## Timing Validation

Server validates that submission is within the acceptable time window:

```
window_start_ms = last_note_deadline_ms
window_end_ms = last_note_deadline_ms + 100  # 100ms tolerance

if timestamp_ms < window_start_ms OR timestamp_ms > window_end_ms:
  return note_outside_window error
```

---

## Example Usage (JavaScript)

```javascript
const onNotePlayed = async (midiNote, timestampMs) => {
  const response = await fetch(
    `/api/plugins/subway_scaler/game/${sessionId}/play-note`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        midi: midiNote,
        timestamp_ms: timestampMs
      })
    }
  );

  const data = await response.json();
  if (data.success) {
    if (data.note_correct) {
      moveCharacterToTrack(data.character_moved_to_track);
      displayNextNote(data.next_note);
      updateScore(data.current_score);
      queueNextWave(data.next_wave);
    } else {
      endGame(data.game_state.score);
    }
  }
};
```

