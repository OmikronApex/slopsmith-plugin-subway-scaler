# Phase 1 Data Model: Subway Scales

All entities are derived from the spec's Key Entities section and refined against the Phase 0 research decisions. Fields shown without types are described in plain prose; this document is implementation-agnostic enough to serve both the Python (Pydantic) and JS sides.

## Scale

Represents one named musical scale built from a root note and a set of intervals.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable slug, e.g., `major`, `natural-minor`, `mixolydian`. |
| `name` | string | Human-readable name shown in the UI. |
| `intervals` | int[] | Semitone offsets from the root, starting at 0. For example, major = `[0,2,4,5,7,9,11,12]`. |

Validation: `intervals` is non-empty, strictly increasing, all values in `[0, 24]`, first value is 0.

## Note

A pitch class with an octave; used for both expected targets and detection results.

| Field | Type | Notes |
|-------|------|-------|
| `midi` | int | 0–127. Source of truth. |
| `name` | string | Derived: `C, C#, D, ..., B` + octave, e.g., `E4`. |
| `frequencyHz` | float | Derived: `440 * 2^((midi - 69) / 12)`. |

Validation: `21 ≤ midi ≤ 108` (piano range superset; covers the C2–C7 assumption).

## ExpectedNote

The realisation of a Scale at a particular root and octave range, used to drive a Run.

| Field | Type | Notes |
|-------|------|-------|
| `index` | int | Position in the run's sequence (0-based). |
| `note` | Note | The note the player must play. |
| `strictOctave` | bool | If false, any octave of the same pitch class counts. |

The expansion rule is: given `Scale.intervals`, root `r` (MIDI), octave count `n` (1 or 2), build `[Note(midi = r + iv + 12*k) for k in 0..n-1, iv in intervals[:-1]]` followed by the final note `Note(midi = r + intervals[-1] + 12*(n-1))`. If "descending" is enabled, append the reverse minus the first to avoid duplicating the apex.

## Run

A single practice attempt; state machine + per-note timing.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID; used only client-side. |
| `scaleId` | string | FK to Scale.id. |
| `rootMidi` | int | The chosen root note. |
| `octaves` | int | 1 or 2. |
| `descending` | bool | Whether to play the descending pass after the ascending pass. |
| `difficulty` | enum | `easy` / `medium` / `hard`; controls cart speed and time per note. |
| `sequence` | ExpectedNote[] | Pre-expanded full note sequence for the run. |
| `cursor` | int | Index of the currently-expected note. |
| `timePerNoteMs` | int | Derived from difficulty; same for all notes in the run. |
| `deadlineAt` | timestamp | Absolute wall-clock time when the current note's window expires. |
| `state` | enum | `idle` / `running` / `paused` / `succeeded` / `failed` / `abandoned`. |
| `startedAt` | timestamp | Set when state transitions to `running`. |
| `endedAt` | timestamp \| null | Set when state transitions to a terminal value. |

State transitions:

```
idle ──start──► running ──correct-in-time──► running (cursor += 1)
                │                            │
                │                            └─cursor == len(sequence)──► succeeded
                │
                ├──deadline-expired──► failed
                ├──pause──► paused ──resume──► running
                └──abandon──► abandoned
```

Validation: `0 ≤ cursor ≤ len(sequence)`; `cursor == len(sequence)` only when `state == succeeded`. `difficulty → timePerNoteMs` mapping (initial values, tunable): easy = 4000 ms, medium = 2500 ms, hard = 1500 ms.

## PitchDetection

A single result frame emitted by the YIN AudioWorklet.

| Field | Type | Notes |
|-------|------|-------|
| `frequencyHz` | float \| null | Null when no periodic signal was found. |
| `confidence` | float | `1 - aperiodicity`, clamped to `[0, 1]`. |
| `note` | Note \| null | Quantized result; null when `frequencyHz` is null or confidence below threshold. |
| `centsOffset` | float | Signed; `|centsOffset| ≤ 50` when `note` is set. |
| `timestampMs` | float | `currentTime` of the AudioContext in ms. |

Validation: `confidence ∈ [0, 1]`; if `note` is set then `frequencyHz` is set; `centsOffset` only meaningful when `note` is set.

## AudioInput

The player's selected capture device and detection settings.

| Field | Type | Notes |
|-------|------|-------|
| `deviceId` | string \| null | `MediaDeviceInfo.deviceId`; null means "default". |
| `deviceLabel` | string | Human-readable label, persisted so we can re-select even if `deviceId` rotates. |
| `sampleRate` | int | Negotiated by `AudioContext`; typically 48000. |
| `toleranceCents` | int | 25–50; default 50. |
| `confidenceThreshold` | float | 0.5–0.95; default 0.8. |
| `stabilityFrames` | int | 1–5; default 3 (per R3). |

## PlayerSettings (persisted)

The shape of `data/settings.json`. All fields optional; missing fields fall back to defaults.

| Field | Type | Notes |
|-------|------|-------|
| `lastScaleId` | string | e.g., `major`. |
| `lastRootMidi` | int | 60 (C4) by default. |
| `lastOctaves` | int | 1 or 2. |
| `lastDifficulty` | enum | `easy` / `medium` / `hard`. |
| `strictOctave` | bool | Default false. |
| `audio` | AudioInput | Embedded. |

## GameWorld (client-only, transient)

State for the 3D scene; not persisted, not sent over the wire.

| Field | Type | Notes |
|-------|------|-------|
| `currentCart` | object | Cart hosting the character right now. |
| `upcomingCarts` | object[] | Queue of incoming carts; each tagged with its `ExpectedNote.index`. |
| `cliffDistanceM` | float | Decreases over time during a run; reaching 0 with `state != running` triggers the fall animation. |
| `characterState` | enum | `idle` / `jumping` / `falling`. |

GameWorld is fully derived from `Run` + elapsed time; no independent persistence.
