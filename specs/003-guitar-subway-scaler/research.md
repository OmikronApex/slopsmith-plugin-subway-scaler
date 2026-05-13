# Research: Guitar Subway Scaler (v2)

Resolved decisions for the v2 spec update: 45° top-down camera, behind-each-other cart queue per row, scale-only cart filtering. Earlier decisions (resolver, tunings, lane geometry, animations) carry over from v1 and are re-stated briefly.

## 1. Note → (string, fret) resolution (unchanged from v1)

**Decision**: Deterministic resolver parameterised by instrument tuning and the previous resolved position. Candidates: each string where `0 ≤ midi − openMidi ≤ maxFret`. Pick the candidate closest to the previous position (Euclidean in lane × fret space) with a small same-string bias. With no previous position, pick the lowest-fret candidate.

**Rationale**: Already shipped; unchanged by the v2 visual changes.

## 2. Standard tunings (unchanged)

- Guitar standard: `[40, 45, 50, 55, 59, 64]` (E2…E4), maxFret 24.
- Bass 4 standard: `[28, 33, 38, 43]` (E1…G2), maxFret 24.

## 3. Camera (NEW v2 — replaces v1 §3)

**Decision**: Fixed perspective camera positioned so the view looks **down at 45° toward the active row**. Concretely: place the camera at world `(0, h, h)` for some `h ≈ 8`, with `lookAt(0, 0, -2)`. Tan(45°) = 1, so equal Y and Z offsets give exactly a 45° downward pitch.

**Rationale**: A true 45° angle is the spec requirement and a well-known isometric-ish convention that makes both lane (X) separation and row (Z) separation legible without overlap. A pure top-down would hide row depth; a low-angle would hide adjacent lanes. The fixed angle also lets us pre-compute cart spacing so nothing overlaps under perspective foreshortening (see §6).

**Alternatives considered**:
- Orthographic 45° projection — slightly cleaner geometry but loses the subway "track receding into the distance" feel and complicates the existing renderer.
- Dynamic camera that follows the active row in depth — drops the row jump's spatial cue; if the camera follows you onto the new row, the jump feels weaker.

## 4. Lane (fret) geometry (unchanged from v1)

`d(n) = 1 − 2^(−n/12)` for fret distance from the nut. Visible 9-lane window centred on `activeFret`, `LANE_X_SCALE = 18`. Re-centres on every new active fret.

## 5. Row (string) geometry

**Decision**: Rows are evenly spaced along the depth axis with `ROW_DZ = 3.0` units. Row 0 (lowest-pitch string) sits at the front (Z = 0); successive rows recede along `-Z`. The active row is highlighted with a brighter material.

**Rationale**: Unchanged from v1 — even spacing is the simplest legible option and works for both 4 and 6 rows at a 45° camera.

## 6. Cart placement within a row (NEW v2)

**Decision**: Within a row, carts are placed at the `(x, z)` of their (fret, stringIdx) cell **plus a per-cart longitudinal offset** along the world `-Z` axis to queue them visibly behind one another. Concretely:

- A row's base Z is `rowZ(stringIdx)`.
- Within the row, the in-scale cells are sorted by ascending fret. Cart `k` of that row gets `z = rowZ(stringIdx) − k * CART_GAP_Z` where `CART_GAP_Z = 0.05` units.

This guarantees:

1. No two carts in the same row overlap (SC-007), even when they share an X coordinate (rare, but possible if two adjacent in-scale frets happen to land at very close log-spaced X values).
2. The queue is read left-to-right (low fret → high fret) at a glance.
3. Carts in *different* rows can still share an X without overlapping because their base Z differs by `ROW_DZ` (3.0) >> the longitudinal offset (≤ 0.45 with 9 lanes).

The longitudinal offset is small relative to `ROW_DZ`, so it does not blur the row stack visually.

**Rationale**: The "queued behind one another" requirement (FR-005) is incompatible with placing carts strictly at their cell's `(x, rowZ)` because adjacent same-row carts at neighbouring log-spaced frets get visually close at high frets. The offset adds a deterministic, monotonically-increasing back-shift per cart that the eye reads as a queue without altering the cart's lane identity (X is still the fret's lane X).

**Alternatives considered**:
- **No longitudinal offset**: cart X already encodes fret, so technically they "don't overlap" at the cell level — but at high frets the X gap shrinks enough that the carts visually merge. Spec is explicit: visible gap, behind each other.
- **Offset along the lane's X axis instead**: would break the rule that X = fret. Rejected.

## 7. Scale-only cart filtering (NEW v2)

**Decision**: A pure module `static/game/scaleMap.js` exposes:

```ts
inScaleCells(noteMidiSet, instrument, fretRange) → Array<{stringIdx, fret}>
```

For each string `s` in `instrument.tuning`, for each fret `f` in `[fretRange.lo, fretRange.hi]`, compute `midi = tuning[s] + f`; include `{stringIdx: s, fret: f}` iff `noteMidiSet` includes `midi` **mod-12-matches** any value in `noteMidiSet`. Mod-12 match: two MIDI values match iff `(a − b) % 12 === 0` (i.e., same pitch class regardless of octave). This means selecting "C major" populates every C, D, E, F, G, A, B cell within the instrument's range — across all octaves — not only the one-octave block returned by the API.

**Rationale**:
- The spec wants the player to see "every fingering that produces a note in the scale". Pitch-class equivalence is the standard musical interpretation of "in scale".
- Computing on the client avoids a new endpoint and keeps cell-map updates instantaneous when the player changes scale or root.

**Input source**: the page already calls `GET /api/plugins/subway-scaler/scales/{id}/notes` at run start. The pitch-class set is `notes.map(n => n.midi % 12)` taken as a `Set`.

**Window scoping**: when `scene.js` rebuilds its row geometry around a new active fret, it asks `scaleMap` for the cells inside the current 9-lane window. Cells outside the window are not rendered.

**Alternatives considered**:
- **Strict octave match (no mod-12)**: only shows notes in the exact octaves the player picked. Rejected — collapses to ~7 cells across the whole neck, defeating the point of the visualisation.
- **Pre-compute on the server**: would require a new endpoint (`/scales/{id}/cells?instrument=...`) for ~150 lines of math the client can do in a millisecond. Violates constitution V.

## 8. Animations (unchanged from v1)

Lateral lane change: 120 ms ease-out tween on X, character hop `peak +0.3`. Row jump: 220 ms tween on Z (and X if the fret also changed), `peak +0.9` arc. Tween interrupt snaps to the previous target and starts the next tween from there.

## 9. Cart fall / forward motion (REVISED v2)

**Decision**: Carts are now stationary in world space — they mark fixed (string, fret) cells, not falling scenery. The "subway runner" motion is conveyed by:

- The character moving between carts (lateral hops, row jumps).
- An optional slow drift of the entire scene along `-Z` between expected notes (camera-relative parallax) to keep the runner feel without disturbing cart positions.

For v2 we ship without the camera drift (carts strictly stationary) and add it as a stretch task only if quickstart §2 reads as too static.

**Rationale**: With "scale-only carts" the carts are gameplay objects (a queue of valid positions), not scenery. Falling carts would suggest you must hit them in falling order, which is not the mechanic (the mechanic is "hit the next note in the scale sequence"). Static carts plus moving character is the conventional rhythm-game layout.

**Alternatives considered**: keep falling carts, fade in/out as they enter the window — added animation cost with no readability benefit at the 45° angle.

## 10. Chord / out-of-range / fast sequences (unchanged from v1)

- Drive visual from the single most-recent stable YIN detection.
- Out-of-range MIDI → resolver returns null; HUD shows the note name; no cart highlight changes.
- Fast sequences → tween interrupt snaps to previous target.

## 11. Visible-window invariants

Two invariants the v2 implementation must enforce:

1. **Camera angle**: pitch = 45°, locked. No mouse/UI rotation in v2.
2. **No cart overlap within a row**: the longitudinal offset rule from §6 makes this geometrical, not animation-dependent.

These invariants are checked at unit-test level (geometry asserts) and visually via the quickstart.
