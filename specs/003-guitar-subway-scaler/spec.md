# Feature Specification: Guitar Subway Scaler

**Feature Branch**: `003-plugin-meant-players`  
**Created**: 2026-05-13  
**Last Updated**: 2026-05-13 (v5 — one cart per row + Rocksmith string colours)  
**Status**: Draft  
**Input**: User description: "The Plugin is meant for players that use either regular or a bass guitar. The position of the subway carts should correspond to the fret and string the note is played on."

## Visual model (v5)

Classic Subway-Surfer layout viewed from a fixed 45° top-down camera. The camera does not move vertically; the character slides flat.

- **Tracks (lanes)**: each distinct fret used by the visible queue is rendered as one track plank along the X axis. Lowest fret leftmost, highest rightmost. Lanes for frets not in the visible queue are hidden.
- **Cart queue (Z axis)**: every upcoming note gets **its own row**. Cart `i` (0-indexed from the front) sits at `queueZ(i)`. **At most one cart per row.** No row holds two carts even when consecutive notes share a string.
- **Cart X**: the cart for each upcoming note sits on the track of that note's fret.
- **Cart colour**: the cart **body** is coloured according to the note's intended **string**, using the Slopsmith / Rocksmith standard palette (low pitch → high pitch):
  - String 0 (lowest)   → **Red**
  - String 1            → **Yellow**
  - String 2            → **Blue**
  - String 3            → **Orange**
  - String 4            → **Green**
  - String 5 (highest)  → **Purple**
  For bass (4 strings) only the first four colours are used (Red, Yellow, Blue, Orange).
- **Cart roof**: a standard **dark gray**, identical for all carts regardless of string.
- **Character**: sits at the front row on the cart's lane. On accept, slides laterally if the next cart is on a different fret-lane (X tween); otherwise stays put as the queue advances.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One Cart Per Note (Priority: P1)

As a player I want each upcoming note to have its own dedicated cart in its own row so I can read the sequence one note at a time without crowding.

**Independent Test**: Pick a scale segment with two same-string notes followed by a string change. Verify there are three rows visible, each containing exactly one cart (no merging of same-string consecutive notes into one row).

**Acceptance Scenarios**:

1. **Given** the next three upcoming notes are at positions `(s0,f1)`, `(s0,f3)`, `(s1,f0)`, **When** the scene is rendered, **Then** there are three rows, each with exactly one cart, at `queueZ(0)`, `queueZ(1)`, `queueZ(2)` respectively.
2. **Given** the player plays the front note, **When** the run accepts it, **Then** the second row shifts forward to `queueZ(0)` and the character moves to that cart's lane.

### User Story 2 - String-Coded Cart Body (Priority: P1)

As a player I want each cart's body colour to tell me which string the note must be played on, using the familiar Rocksmith palette.

**Independent Test**: Inspect a queue spanning all 6 guitar strings (or all 4 bass strings). Verify the cart body colours match the documented palette (Red, Yellow, Blue, Orange, Green, Purple for strings 0..5).

**Acceptance Scenarios**:

1. **Given** an upcoming note resolves to string `s`, **When** its cart is rendered, **Then** the cart body uses the palette colour for index `s`.
2. **Given** bass mode is active, **When** notes are rendered, **Then** only the first 4 palette colours appear (no Green or Purple).

### User Story 3 - Fret Lane Layout (Priority: P1)

As a player I want each cart to sit on the lane of the fret I need to play, with lanes laid out left-to-right by fret number.

**Independent Test**: Pick a queue whose distinct frets are {3, 5, 7}. Verify exactly three planks are rendered, ordered left-to-right as 3, 5, 7, and each cart sits on the plank for its note's fret.

**Acceptance Scenarios**:

1. **Given** the visible queue uses distinct frets `F`, **When** the scene is rendered, **Then** exactly `|F|` track planks are rendered, ordered ascending by fret from left to right.
2. **Given** a cart for fret `f`, **When** it is rendered, **Then** its X position equals the plank position for `f`.

### User Story 4 - Dark Gray Roof (Priority: P2)

As a player I want a consistent roof colour across all carts so that only the body colour carries the string information.

**Acceptance Scenarios**:

1. **Given** any cart, **When** it is rendered, **Then** its roof is a standard dark gray independent of string or fret.

### User Story 5 - Instrument Configuration (Priority: P3)

Switching between guitar and bass between runs uses the correct tuning and palette truncation (bass uses 4 colours).

**Acceptance Scenarios**:

1. **Given** instrument is bass, **When** a run starts, **Then** the resolver uses 4-string bass tuning and cart colours are drawn from the first 4 palette entries.
2. **Given** the player switches instruments between runs, **When** the new run starts, **Then** the scene rebuilds with the new tuning.

### Edge Cases

- **Open Strings**: fret 0 is its own lane if present in the queue.
- **Out-of-Range Note**: resolver returns `null`. Its slot in the queue is rendered as an empty row (no cart), still occupying a Z slot so subsequent rows don't shift forward.
- **Empty Tail**: when fewer than `VISIBLE_ROWS` upcoming notes remain, only the remaining rows render.
- **Chord/Simultaneous Notes**: monophonic — YIN delivers one fundamental.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Support 4-string bass and 6-string standard guitar tunings.
- **FR-002**: 3D subway scene viewed from a fixed 45° top-down camera. Camera does not move during play.
- **FR-003**: Each upcoming note MUST be rendered as exactly **one** cart in exactly **one** row of the Z queue.
- **FR-004**: No two carts MAY share the same Z row.
- **FR-005**: For each upcoming note, its cart's X position MUST equal the X of the track plank for that note's fret.
- **FR-006**: For each distinct fret used by the visible queue, exactly one track plank MUST be rendered. Track planks MUST be ordered left-to-right by fret number ascending (lowest fret leftmost).
- **FR-007**: A track plank MUST NOT be rendered for any fret not used by the visible queue.
- **FR-008**: Each cart's **body** colour MUST be the Slopsmith / Rocksmith standard palette colour for the note's resolved string index:
  - 0 → Red, 1 → Yellow, 2 → Blue, 3 → Orange, 4 → Green, 5 → Purple.
- **FR-009**: Each cart's **roof** MUST be a standard dark gray, identical across all carts.
- **FR-010**: The character MUST sit at the front row (Z = 0) on the cart's fret lane, except briefly mid-tween.
- **FR-011**: On accept, the queue MUST shift forward by exactly one row; the character MUST tween laterally (X-only) to the new front cart's lane.
- **FR-012**: The character MUST NOT translate vertically (Y constant) during normal play.

### Key Entities

- **Instrument Configuration**: tuning + string count (4 or 6) + palette length.
- **Resolved Position**: `(stringIdx, fret)` per note in the run sequence, deterministic from MIDI + previous position.
- **String Colour Palette**: ordered list `[Red, Yellow, Blue, Orange, Green, Purple]`; bass uses the first 4 entries.
- **Scene Cart**: one per non-null position in the visible queue; placed at `(laneX(fret), 0, queueZ(rowIndex))`; body = palette[stringIdx], roof = dark gray.
- **Lane (Track Plank)**: one per distinct fret across visible rows.

## Success Criteria *(mandatory)*

- **SC-001**: For any accepted note, the corresponding cart's row shifts to the new front within 50 ms.
- **SC-002**: Number of visible rows equals number of remaining upcoming notes in the window (≤ `VISIBLE_ROWS`).
- **SC-003**: No two visible carts share a row (1 cart per row, always).
- **SC-004**: Each cart's body colour matches the palette entry for its string index, verified for every visible cart.
- **SC-005**: Each cart's roof colour is identical (dark gray) across the entire scene.
- **SC-006**: Number of rendered track planks equals the number of distinct frets across visible carts.
- **SC-007**: Camera Y position is constant throughout a run.

## Assumptions

- **Standard Tuning** per instrument.
- **Monophonic** pitch detection.
- **Visible Queue Length**: default 6 rows.
- **Palette** is fixed (Rocksmith standard) and not user-configurable in this iteration.
- **Roof Colour**: a single dark gray hex, not user-configurable in this iteration.
