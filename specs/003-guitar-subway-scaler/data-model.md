# Data Model: Guitar Subway Scaler (v5)

## Entities

### Instrument (static, server-side) — unchanged

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | string | `^[a-z0-9-]+$` |
| `name` | string | non-empty |
| `kind` | enum | `"guitar" \| "bass"` |
| `stringCount` | int | 4 or 6 |
| `tuning` | int[] | length 4 or 6, strictly increasing, each in `[21, 108]` |
| `maxFret` | int | 12 ≤ n ≤ 24 |

### PlayerSettings (unchanged from v1)

`instrumentId`, `strictTuning` already shipped.

### NoteEvent (transient, client-side) — unchanged

```ts
{ midi: number, name: string, frequencyHz: number, timestamp: number }
```

### FretboardPosition (transient, client-side) — unchanged

```ts
{ stringIdx: number, fret: number } | null
```

### StringColourPalette (NEW v5, static)

Module-level constant in `static/game/stringPalette.js`:

```ts
const STRING_COLOURS: readonly number[];  // hex RGB ints, length 6
```

Indexed 0..5: Red, Yellow, Blue, Orange, Green, Purple. Bass mode uses indices 0..3.

### Lane / Track Plank (transient, client-side)

```ts
{ fret: number, x: number }
```

One per distinct fret in the visible queue. Ordered by fret ASC. `x = laneX(fret, anchorFret)` where `anchorFret` = lowest fret in the visible queue.

### Scene Cart (transient, client-side) — refined for v5

```ts
{
  stringIdx: number,
  fret: number,
  rowIndex: number,    // 0-based, 0 == front
  bodyColour: number,  // palette[stringIdx]
  mesh: THREE.Group,
}
```

Placement: `(laneX(fret, anchorFret), 0, queueZ(rowIndex))`. Body material colour from `STRING_COLOURS[stringIdx]`. Roof material = single shared dark gray (`0x444444`).

Invariant: **at most one Scene Cart per `rowIndex`** (FR-004, SC-003).

### PlayerLocation (transient, client-side) — unchanged

```ts
{ stringIdx: number, fret: number, x: number, y: number, z: number }
```

`y` constant during normal play; only changes on `falling` state.

## Relationships

- `PlayerSettings.instrumentId` → `Instrument.id` (validated at PUT).
- `NoteEvent` + prev `FretboardPosition` + `Instrument` ⇒ new `FretboardPosition`.
- `FretboardPosition.stringIdx` ⇒ `STRING_COLOURS[stringIdx]` (clamped by `instrument.stringCount`).
- Visible queue = first `VISIBLE_ROWS` entries of `sequencePositions.slice(run.cursor)`.

## State transitions

```text
on run start:
    sequencePositions = buildSequencePositions(notesResp.notes, instrument)
    refreshSceneQueueFromRun()
    # = scene.setQueue(sequencePositions.slice(cursor, cursor + VISIBLE_ROWS))

on note accepted:
    run.cursor++
    scene.advanceQueue()        # tween char to next front
    refreshSceneQueueFromRun()  # extend tail if more upcoming
```

The v4 `buildRowIndices` / `positionRowIdx` pair is removed.

## Invariants

- **One cart per row** (FR-003, FR-004, SC-003): the scene's row list and the visible-queue positions are 1-to-1.
- **Body = palette[stringIdx]** (FR-008, SC-004) for every visible cart.
- **Roof uniform** (FR-009, SC-005).
- **Camera Y constant** (FR-002, SC-007).
- **Plank count = |distinct frets|** (FR-006, SC-006).
