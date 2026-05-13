# Feature Specification: Guitar Subway Scaler

**Feature Branch**: `003-plugin-meant-players`  
**Created**: 2026-05-13  
**Last Updated**: 2026-05-13 (v4 — note-queue Subway-Surfer + row-grouping by string)  
**Status**: Draft  
**Input**: User description: "The Plugin is meant for players that use either regular or a bass guitar. The position of the subway carts should correspond to the fret and string the note is played on."

## Visual model (v4)

Classic Subway-Surfer layout viewed from a **fixed 45° top-down camera**:

- **Lanes (columns)** = frets along the X axis. Logarithmic spacing matches a real fretboard. Only the frets actually used by the visible queue are rendered as track planks — irrelevant lanes are hidden.
- **Rows (z-axis)** = the **playing-order queue** of upcoming notes, grouped by consecutive same-string runs. Each row holds the carts for one run of consecutive notes on the same string. The first remaining row sits at the front (Z = 0, closest to the camera). Subsequent rows recede in `-Z`.
- **Carts within a row** are placed at `(laneX(fret), 0, queueZ(rowIndex))`. A row may contain several carts side-by-side (different frets on the same string, played in sequence).
- **Player character** sits at the front row on the lane of the next-due note. The camera does not move vertically; the character slides flat (no Y arc).

Transitions:

- **Same string, different fret** → character slides **lateral** (X-only tween) inside the current front row to the next cart.
- **Different string** → the front row is exhausted; remaining rows shift forward by one slot and the character performs a **row jump** (X + Z tween, slightly longer) onto the new front row's first cart.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same-String Fret Navigation (Priority: P1)

As a player playing consecutive notes on the same string, I want all those notes to appear as carts in **one row** so I can see at a glance that they belong to a single fretting-hand sweep.

**Independent Test**: Pick a scale segment that contains two same-string notes (e.g. E2 → G2 on the low E string). Verify both carts share one row (same Z) and sit on different X lanes; the character slides laterally between them as each is played.

**Acceptance Scenarios**:

1. **Given** the next two upcoming notes are on the same string at frets 5 and 7, **When** the scene is rendered, **Then** both carts are at the front row (Z = 0) on lanes for frets 5 and 7.
2. **Given** the player plays the first of two same-string notes, **When** the run accepts it, **Then** the character slides laterally inside the same row to the next cart (no row shift, no Z change).

### User Story 2 - String-Switching Row Jump (Priority: P2)

As a player switching to a different string, I want the next note to live in its **own row** so that string changes are visually distinct from same-string fret changes.

**Independent Test**: Pick a scale segment whose 2nd note is on a different string than the 1st (e.g. E2 → A2). Verify the second cart sits in the next row behind the first. After playing the first note, the queue shifts and the character jumps forward+lateral onto the new front row's cart.

**Acceptance Scenarios**:

1. **Given** consecutive upcoming notes are on different strings, **When** the scene is rendered, **Then** the second note's cart is in a row behind the first (Z = `queueZ(1)`), not in the first's row.
2. **Given** the front row has exactly one cart and the player plays it, **When** the run accepts the note, **Then** the next row shifts forward to become the new front row and the character row-jumps onto its first cart.

### User Story 3 - Instrument Configuration (Priority: P3)

As a bass player I want the resolver to use the 4-string bass tuning so the same scale sequence yields different (string, fret) positions vs guitar.

**Independent Test**: Switch instrument to bass between runs. Same scale yields a different group structure (different string boundaries → different row count).

**Acceptance Scenarios**:

1. **Given** instrument is bass, **When** a run starts, **Then** the resolver uses the 4-string bass tuning and the row grouping reflects bass fingerings.
2. **Given** the player switches instruments between runs, **When** the new run starts, **Then** the scene rebuilds from scratch using the new instrument's tuning.

### User Story 4 - Relevant Lanes Only (Priority: P1)

As a player I want to see only the fret lanes that the upcoming queue actually uses, so the scene is uncluttered.

**Independent Test**: Pick a scale whose visible queue uses frets {0, 3, 5, 7}. Verify exactly four track planks are rendered (one per distinct fret), not the full 25-fret neck.

**Acceptance Scenarios**:

1. **Given** the visible queue uses a set `F` of distinct frets, **When** the scene is rendered, **Then** exactly `|F|` track planks are rendered, one per fret in `F`.
2. **Given** the queue advances and the set of upcoming frets changes, **When** the next note is accepted, **Then** track planks are added/removed so the rendered set matches the new `F`.

### Edge Cases

- **Open Strings**: fret 0 is treated like any other fret; its lane is rendered if used by the queue.
- **Chord/Simultaneous Notes**: the run is monophonic; YIN delivers a single fundamental.
- **Fast Sequences**: in-flight character tween snaps to its target before the next tween starts.
- **Out-of-Range Note**: resolver returns `null`. The corresponding slot in the queue is rendered as empty (no cart) but still counted as a note in its row.
- **Empty Tail**: when fewer than `VISIBLE_ROWS` rows remain in the run, the scene renders only what's left.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Support 4-string bass and 6-string standard guitar tunings.
- **FR-002**: 3D subway scene observed from a fixed 45° top-down camera; camera does not move during play.
- **FR-003**: Each fret used by the visible queue MUST be rendered as exactly one track plank (lane) along the X axis.
- **FR-004**: Lane order MUST be lowest fret leftmost, highest fret rightmost; spacing MUST be logarithmic (matches physical fret spacing).
- **FR-005**: Lanes for frets NOT used by the visible queue MUST NOT be rendered.
- **FR-006**: Subway carts MUST be grouped into rows along the Z axis, where each row holds the carts for one run of consecutive same-string notes from the upcoming sequence.
- **FR-007**: Within a row, carts MUST be placed at their fret's lane X; carts in the same row share the same Z (no longitudinal pile-up within a row beyond the lane separation).
- **FR-008**: Front row (Z = 0) MUST contain the currently-active note's cart; subsequent rows recede in `-Z`.
- **FR-009**: When the player plays a note correctly AND the next upcoming note is on the same string, the character MUST slide laterally (X-only tween) inside the front row.
- **FR-010**: When the player plays the last note in the front row, the queue MUST shift forward by one row and the character MUST perform a row jump (X + Z tween) onto the new front row's first cart.
- **FR-011**: The character MUST NOT translate vertically (Y constant) during normal play; vertical motion is reserved for the `falling` state on failure.

### Key Entities

- **Instrument Configuration**: tuning + string count (4 or 6).
- **Resolved Position**: `(stringIdx, fret)` for each note in the run's sequence, deterministic from MIDI + previous position.
- **Row Group**: a run of consecutive resolved positions sharing `stringIdx`. Forms one Z-row in the scene.
- **Scene Cart**: one per non-null position in a row; placed at `(laneX(fret), 0, queueZ(rowIndex))`.
- **Lane (Track Plank)**: one per distinct fret across visible rows; placed at `laneX(fret, anchorFret)` where `anchorFret` = lowest visible fret.

## Success Criteria *(mandatory)*

- **SC-001**: Player position updates for 100% of accepted notes.
- **SC-002**: Lateral and row-jump tweens begin within 50 ms of acceptance.
- **SC-003**: Bass mode and guitar mode produce different row structures for the same scale.
- **SC-004**: 100% of consecutive same-string note pairs share a row; 100% of consecutive different-string note pairs span two rows.
- **SC-005**: Camera Y position is constant throughout a run (no vertical motion).
- **SC-006**: Number of rendered track planks equals the number of distinct frets in the visible queue.
- **SC-007**: No two carts in the same row share a lane (X); within a row, all carts are at distinct fret-lanes.

## Assumptions

- **Standard Tuning**: standard tuning per instrument.
- **Monophonic**: one detected pitch at a time.
- **Visible Queue Length**: default 4 rows ahead of the player.
- **Input Source**: MIDI from YIN pitch detection.
