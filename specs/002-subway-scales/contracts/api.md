# API Contract: Subway Scales Backend

All endpoints are JSON-in / JSON-out and rooted at `/api/plugins/subway_scaler/` per constitution principle IV. Errors use a single shape:

```json
{ "error": { "code": "string-slug", "message": "Human-readable explanation" } }
```

Standard HTTP status codes: 200 success, 400 bad request, 404 not found, 422 validation error, 500 server error.

---

## GET `/api/plugins/subway_scaler/status`

Existing health-check endpoint, retained.

**Response 200**:

```json
{ "status": "ok", "message": "Subway Scaler is ready" }
```

---

## GET `/api/plugins/subway_scaler/scales`

List every scale family the plugin knows about. Used to populate the scale picker.

**Response 200**:

```json
{
  "scales": [
    { "id": "major",          "name": "Major",         "intervals": [0,2,4,5,7,9,11,12] },
    { "id": "natural-minor",  "name": "Natural Minor", "intervals": [0,2,3,5,7,8,10,12] }
  ]
}
```

Validation: `intervals[0] == 0`, strictly increasing, all values in `[0, 24]`.

---

## GET `/api/plugins/subway_scaler/scales/{scale_id}/notes`

Expand a scale into a concrete note sequence for a chosen root and octave range.

**Query parameters**:

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| `root_midi` | int | yes | — | 21–108. |
| `octaves` | int | no | 1 | 1 or 2. |
| `descending` | bool | no | false | Append descending pass after ascending. |

**Response 200**:

```json
{
  "scaleId": "major",
  "rootMidi": 60,
  "octaves": 1,
  "descending": false,
  "notes": [
    { "midi": 60, "name": "C4", "frequencyHz": 261.626 },
    { "midi": 62, "name": "D4", "frequencyHz": 293.665 }
  ]
}
```

**Errors**:

- 404 `scale-not-found` if `scale_id` is unknown.
- 422 `invalid-root` if `root_midi` is out of range.
- 422 `invalid-octaves` if `octaves` is not 1 or 2.

---

## GET `/api/plugins/subway_scaler/settings`

Return the persisted player settings, applying defaults for any missing fields. Reads `data/settings.json`; if the file is missing or corrupt, returns defaults (and overwrites a corrupt file).

**Response 200**:

```json
{
  "lastScaleId": "major",
  "lastRootMidi": 60,
  "lastOctaves": 1,
  "lastDifficulty": "medium",
  "strictOctave": false,
  "audio": {
    "deviceId": null,
    "deviceLabel": "",
    "sampleRate": 48000,
    "toleranceCents": 50,
    "confidenceThreshold": 0.8,
    "stabilityFrames": 3
  }
}
```

---

## PUT `/api/plugins/subway_scaler/settings`

Replace the persisted settings. The body uses the same shape as the GET response. Unknown fields are rejected; partial updates are *not* supported (callers send the full object after merging client-side).

**Request body**: same JSON shape as the GET response.

**Response 200**: the stored settings (echo of the canonicalised body).

**Errors**:

- 422 `invalid-settings` with a list of field-level violations:

  ```json
  {
    "error": {
      "code": "invalid-settings",
      "message": "Settings failed validation",
      "fields": {
        "lastDifficulty": "must be one of: easy, medium, hard",
        "audio.toleranceCents": "must be between 1 and 100"
      }
    }
  }
  ```

Validation rules:

- `lastScaleId` must match an id from `GET /scales`.
- `lastRootMidi` ∈ `[21, 108]`.
- `lastOctaves` ∈ `{1, 2}`.
- `lastDifficulty` ∈ `{easy, medium, hard}`.
- `audio.toleranceCents` ∈ `[1, 100]`.
- `audio.confidenceThreshold` ∈ `[0.0, 1.0]`.
- `audio.stabilityFrames` ∈ `[1, 10]`.

---

## Out of scope for this contract

The following are deliberately client-side and not exposed over HTTP:

- Live pitch detections (`PitchDetection`) — streamed inside the browser only.
- `Run` state — exists entirely in the page lifetime; no server replay or leaderboard in v1.
- Audio device enumeration — comes from `navigator.mediaDevices.enumerateDevices()` directly.
