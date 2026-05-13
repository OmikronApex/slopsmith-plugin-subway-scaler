# API Contract Delta: Guitar Subway Scaler

This document describes only what changes versus `specs/002-subway-scales/contracts/api.md`. All existing endpoints (`/status`, `/scales`, `/scales/{id}/notes`, `/settings`) keep their shape. Route prefix remains `/api/plugins/subway-scaler/`. Error shape is unchanged: `{ "error": { "code", "message", "fields?" } }`.

The vertical-scene layout is entirely client-side: no new endpoints are required to ship it. The only API additions are the instrument registry and the `PlayerSettings` extension.

---

## NEW — GET `/api/plugins/subway-scaler/instruments`

List every instrument preset the plugin knows about. Used to populate the instrument picker.

**Response 200**:

```json
{
  "instruments": [
    {
      "id": "guitar-standard",
      "name": "Guitar (Standard)",
      "kind": "guitar",
      "stringCount": 6,
      "tuning": [40, 45, 50, 55, 59, 64],
      "maxFret": 24
    },
    {
      "id": "bass-4-standard",
      "name": "Bass 4-string (Standard)",
      "kind": "bass",
      "stringCount": 4,
      "tuning": [28, 33, 38, 43],
      "maxFret": 24
    }
  ]
}
```

**Errors**: none — registry is static.

---

## CHANGED — GET / PUT `/api/plugins/subway-scaler/settings`

Body gains two fields:

```json
{
  "lastScaleId": "major",
  "lastRootMidi": 60,
  "lastOctaves": 1,
  "lastDifficulty": "medium",
  "strictOctave": false,
  "instrumentId": "guitar-standard",
  "strictTuning": false,
  "audio": { "...": "unchanged" }
}
```

Additional validation rules on PUT:

- `instrumentId` must match an id from `GET /instruments` — otherwise 422 `invalid-settings` with `fields.instrumentId = "unknown instrument id: <value>"`.
- `strictTuning` must be a boolean — Pydantic surfaces violations under `fields.strictTuning`.

Defaults applied when fields are absent from a freshly-created settings file:

- `instrumentId = "guitar-standard"`
- `strictTuning = false`

Unknown top-level fields remain rejected (`extra = "forbid"`).
