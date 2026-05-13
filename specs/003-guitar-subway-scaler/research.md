# Research: Guitar Subway Scaler (v5)

Resolved decisions for the v5 spec update: one cart per row + Rocksmith string colours. Earlier decisions (resolver, tunings, lane geometry, 45° camera, no-Y-arc animations) carry over.

## 1. One cart per row (NEW v5 — replaces v4 row-grouping)

**Decision**: Each upcoming note in the run's resolved sequence occupies its own Z row. Visible queue = `sequencePositions.slice(run.cursor, run.cursor + VISIBLE_ROWS)`. `VISIBLE_ROWS = 6` default. Cart `i` (0-indexed from the front) sits at `(laneX(fret, anchorFret), 0, queueZ(i))`.

**Rationale**: User explicitly requested "never more than one in the same row". Simplest possible model; eliminates the row-grouping pass introduced in v4 and the multi-cart-per-row geometry in `scene.js`.

**Alternatives considered**:
- v4 row-grouping (consecutive same-string notes merged into one row) — rejected per user direction.

## 2. Tracks (lane planks)

**Decision**: For the visible queue, compute the set of distinct frets. Render one plank per fret, ordered ascending left-to-right. Anchor X so the lowest fret sits at `laneX(loFret, loFret) = 0`. Carts attach to the plank for their note's fret.

**Rationale**: User specified "Fret 1 to Fret x from left to right" — i.e. ascending order. Hide unused lanes to keep the scene readable.

## 3. Rocksmith string palette (NEW v5)

**Decision**: Hex palette, low→high pitch:

```text
0 → Red    #E53935
1 → Yellow #FDD835
2 → Blue   #1E88E5
3 → Orange #FB8C00
4 → Green  #43A047
5 → Purple #8E24AA
```

Encapsulated in `static/game/stringPalette.js`:

```js
export const STRING_COLOURS = [0xE53935, 0xFDD835, 0x1E88E5, 0xFB8C00, 0x43A047, 0x8E24AA];
export function colourForString(stringIdx, instrument) {
  const max = instrument ? instrument.stringCount : STRING_COLOURS.length;
  const i = Math.max(0, Math.min(stringIdx, max - 1));
  return STRING_COLOURS[i];
}
```

For bass (4 strings) only the first four entries are used.

**Rationale**: These hex values match the standard Rocksmith Remastered palette (and Slopsmith mirrors them). Centralising in one module makes the palette unit-testable and easy to swap.

**Alternatives considered**: per-string materials defined inline in `scene.js` — rejected; couples colour data to WebGL setup and prevents unit testing.

## 4. Roof colour

**Decision**: Single dark gray (`0x444444`) for every cart's roof, independent of string. Encoded as a single Three.js `MeshStandardMaterial` reused across all carts.

**Rationale**: Only the body carries string information; uniform roof avoids visual noise.

## 5. Cart body materials

**Decision**: One `MeshStandardMaterial` per string colour (created lazily on first use, cached by string index). Carts for the same string share the same material instance — cheap, no per-frame allocations.

## 6. Out-of-range note slots

**Decision**: A null position still occupies a Z slot — no cart is rendered, but the next position's row index does not shift forward. This keeps the visible queue indices aligned with the run's note indices.

**Rationale**: Visually communicates "this note can't be played on this instrument" by an empty slot rather than silently collapsing the queue.

## 7. Character animation (unchanged from v4)

Lateral X tween on accept. No Y arc. Tween-interrupt snaps to the previous target. Camera fixed.

## 8. Carryovers from earlier versions

- `fretboard.resolve` (deterministic MIDI → (string, fret) with same-string bias) unchanged.
- `grid.laneX`, `queueZ`, `cameraFor45Deg` unchanged.
- `scaleMap.js` retained but unused by the scene.
- Backend unchanged.
