# Data Model: Guitar Subway Scaler (v2)

## Entities

### Instrument (static, server-side) — unchanged

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | string | `^[a-z0-9-]+$` |
| `name` | string | non-empty |
| `kind` | enum | `"guitar" \| "bass"` |
| `stringCount` | int | 4 or 6 |
| `tuning` | int[] | length 4 or 6, each in `[21, 108]`, strictly increasing |
| `maxFret` | int | 12 ≤ n ≤ 24 |

Registry: `guitar-standard` (tuning `[40,45,50,55,59,64]`, maxFret 24), `bass-4-standard` (tuning `[28,33,38,43]`, maxFret 24). Shipped in v1.

### PlayerSettings (extended) — unchanged

Adds `instrumentId: string = "guitar-standard"` and `strictTuning: bool = false`. Shipped in v1.

### NoteEvent (transient, client-side) — unchanged

```ts
{ midi: number, name: string, frequencyHz: number, timestamp: number }
```

### FretboardPosition (transient, client-side) — unchanged

```ts
{ stringIdx: number, fret: number } | null
```

### Lane (transient, client-side) — unchanged

```ts
{ fret: number, x: number }
```

### Row (transient, client-side) — unchanged shape, refined semantics

```ts
{ stringIdx: number, z: number, openMidi: number }
```

Carts in the row are placed at the row's Z minus a per-cart longitudinal offset (see ScaleCart below).

### ScaleNoteSet (transient, client-side, NEW)

Computed once per `(scaleId, rootMidi, octaves)` selection from the existing `GET /scales/{id}/notes` response:

```ts
{ pitchClasses: Set<number> }   // each value in [0, 11]
```

Built as `new Set(notesResponse.notes.map(n => n.midi % 12))`. Independent of instrument; reused across instrument changes within a run.

### ScaleCell (transient, client-side, NEW)

Output of `static/game/scaleMap.js::inScaleCells(...)`:

```ts
{ stringIdx: number, fret: number }
```

A `ScaleCell` exists in the result iff `(instrument.tuning[stringIdx] + fret) % 12 ∈ pitchClasses` AND `fret` is within the requested `fretRange`.

### ScaleCart (transient, client-side, NEW)

One per visible ScaleCell. Placed at:

```text
x = laneX(fret, activeFret)
z = rowZ(stringIdx) − queueIndex * CART_GAP_Z
```

where `queueIndex` is the cart's 0-based position in the row's fret-ascending order. `CART_GAP_Z = 0.05`. `ScaleCart` has no separate data fields beyond the `ScaleCell` it represents plus the computed `(x, z)`.

### PlayerLocation (transient, client-side) — unchanged

```ts
{ stringIdx: number, fret: number, x: number, y: number, z: number }
```

`y` is the character's vertical offset during a jump arc; `(x, z)` mirror the targeted cell. Note: the character lands on the cell's `(x, rowZ(stringIdx))` — **not** on the cart's offset Z. Carts queue behind the cell's spatial centre; the character occupies the centre.

## Relationships

- `PlayerSettings.instrumentId` references `Instrument.id` (validated at PUT). Unchanged.
- A `NoteEvent` + prev `FretboardPosition` + active `Instrument` deterministically yields a new `FretboardPosition`. Unchanged.
- `(scaleId, rootMidi, octaves)` deterministically yields a `ScaleNoteSet`.
- A `ScaleNoteSet` + active `Instrument` + visible `fretRange` deterministically yields the ordered list of `ScaleCell`s (sorted by `stringIdx ASC, fret ASC`).
- Each `ScaleCell` projects to exactly one `ScaleCart` via the geometry above.

## State transitions

Run state machine (`runState.js`) unchanged. The scene refreshes its cart set in two situations:

```text
on run start:
    scaleNoteSet = pitchClassesOf(notesResponse)
    cells = scaleMap.inScaleCells(scaleNoteSet, instrument, fretWindow)
    scene.setCarts(cells)             # NEW API; replaces per-lane pool from v1
    prevPos = null

on note event e:
    pos = fretboard.resolve(e.midi, prevPos, instrument)
    if pos is null:
        return
    if prevPos is null or pos.stringIdx == prevPos.stringIdx:
        scene.lateralLaneChange(pos)
    else:
        scene.rowJump(pos)
    if scene.activeFret slid the lane window:
        scene.setCarts(scaleMap.inScaleCells(scaleNoteSet, instrument, newFretWindow))
    prevPos = pos

on instrument change between runs:
    scene.setInstrument(instrument)   # rebuilds rows
    scene.setCarts(scaleMap.inScaleCells(scaleNoteSet, instrument, fretWindow))
```

`scene.setCarts(cells)` replaces the current set of carts atomically — no partial updates.

## Invariants

- **Cell ⇒ Cart**: every visible cell in the active window has exactly one cart (SC-006).
- **No cart for non-scale cell**: the cart set is closed under the scaleMap output (SC-006).
- **No same-row overlap**: any two carts on the same row differ in `z` by at least `CART_GAP_Z` (SC-007).
- **Camera angle**: pitch fixed at 45° (SC-008).
