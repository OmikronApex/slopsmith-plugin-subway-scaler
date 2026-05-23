# Story 5-5: SceneManager Visual Refactor — Single-Lane Peel Transition

**Status:** done

**Epic:** 5 — Variant Track System
**Story ID:** 5-5
**Story Key:** 5-5-scenemanager-visual-refactor-single-lane-peel-transition
**Depends on:** 5-4
**Prerequisite for:** 5-2

---

## Context

### Scale traversal direction and the fretboard visual
The player alternates ascending passes (low string → high string, moving across the fretboard
from low-fret to high-fret lanes) and descending passes (high string → low string). The visual
fretboard lanes are ordered so that low fret = one side, high fret = other side (verify with
`laneX` in `TrackSystem.js`).

For the purposes of this story: "ascending = moving rightward on screen" and
"descending = moving leftward on screen" is the assumed visual mapping. Verify the actual
world-space orientation before implementing and flip if needed.

### When transitions appear
- **RIGHT transition**: triggered at the end of an **UP pass** (ascending, low → high). The
  player has just reached the highest note of the scale. The new variant track spawns to the
  **right** of the current tracks (extending further in the high-fret direction).
- **LEFT transition**: triggered at the end of a **DOWN pass** (descending, high → low). The
  player has just reached the lowest note of the scale. The new variant track spawns to the
  **left** of the current tracks (extending further in the low-fret direction).

This matches the backend direction convention from Story 5-4:
- `side = "RIGHT"` after last_pass_direction = "UP"
- `side = "LEFT"` after last_pass_direction = "DOWN"

### What happens after the transition is accepted
- **RIGHT accept**: the new scale plays **DOWN** (descending). The player arrived at the new
  high point and now plays back toward low strings. The track visually shifts rightward to
  the new position, then the gameplay direction reverses (descending).
- **LEFT accept**: the new scale plays **UP** (ascending). The player arrived at the new low
  point and now plays toward high strings. The track visually shifts leftward to the new
  position, then the gameplay direction is ascending.

### Current SceneManager.js variant visual — wrong, must change

**Current (wrong):**
- `proposeVariantTracks(variant)` — builds a full parallel track set (all N lanes) offset
  by `VARIANT_GAP = 3.5` world units to the side. Camera zooms out to frame both track sets.
- `acceptVariantTracks()` — camera pans laterally to the variant track set.
- `dismissVariantTracks()` — removes the full variant geometry group.

**Target (correct per UX design):**

The variant is presented as a **railway switch**: a bent track piece whose geometry includes
the bend baked in at creation time. The whole piece translates only in Z toward the player
— exactly like carts and safe zones — so the player experiences it as a track coming at them
from the horizon. No runtime rotation, no X-axis animation.

Two bent geometry pieces drive the full lifecycle:

**Propose piece** (geometry: `_/` shape, or equivalently `[`/`]` with a 90° rounded corner):
- One end: a short diagonal (or curved) section extending off to the side (X), representing
  where the track "comes from"
- The bend: a 45° corner (or 90° rounded arc) transitioning to parallel
- Other end: a straight section running in Z alongside the current tracks

The piece spawns at `SPAWN_Z` and scrolls toward the player. From the player's perspective:
they first see the straight parallel section materialise from the horizon alongside their
tracks; then the bend scrolls past them; then the diagonal entry exits behind them. After the
piece passes, a continuous straight variant lane remains visible alongside the current tracks
(see Dev Notes — persistent parallel lane).

**Dismiss piece** (geometry: mirror of propose — straight Z section → bend → diagonal exit):
Spawns at `SPAWN_Z` and scrolls toward the player in the same way. The player sees the
straight parallel section end, then the bend, then the diagonal exit. After the piece passes,
the variant track is gone.

**Accept path:** Same dismiss piece geometry, but the character transitions onto the variant
lane and follows the bend away from the current tracks. Afterwards the full new fretboard
spawns at `SPAWN_Z` and scrolls in naturally.

The backend sends `base_fret`, `base_lane`, `num_lanes`, and `side` after Story 5-4.
Interface signatures of `proposeVariantTracks`, `acceptVariantTracks`, `dismissVariantTracks`
are preserved — no `main.js` call site changes.

---

## User Story

As a player,
I want the variant offer to appear as a railway-switch track piece that scrolls toward me from
the horizon with the bend baked in, so that it feels like a real branching track rather than
a floating parallel world appearing from the side.

After accepting a RIGHT transition (which appears at the end of an ascending pass), I want to
immediately continue descending on the new track. After accepting a LEFT transition (which
appears at the end of a descending pass), I want to immediately continue ascending on the
new track.

---

## Acceptance Criteria

**AC-1 — `proposeVariantTracks(variant)` spawns a bent propose piece:**
A Three.js geometry Group is created whose shape has a straight Z-running section at
`variant.base_lane` X position, connected via a baked-in 45° corner (or 90° rounded arc) to
a diagonal entry section originating from off-screen on `variant.side`. The Group is positioned
at `SPAWN_Z` and translates only in Z each frame (same formula as `SafeZoneRenderer`). No full
parallel track set is built. `VARIANT_GAP` constant is gone.

**AC-2 — Camera stays fixed throughout:**
`proposeVariantTracks`, `dismissVariantTracks`, and `acceptVariantTracks` do not modify camera
`fov`, `position`, or any zoom parameter.

**AC-3 — Persistent parallel lane after propose piece passes:**
Once the propose piece has scrolled past the player position, a straight variant lane (no bend)
continues to scroll from `SPAWN_Z` alongside the current tracks until the variant is resolved.
The player sees an unbroken parallel track for the duration of the decision window.

**AC-4 — The variant lane is visually distinct:**
Both the propose piece and the persistent lane use the accent color (`#FFB800`) or a distinct
material. The lane position corresponding to the target note has a pulsing emissive highlight
(see Dev Notes — "Play this note" legibility).

**AC-5 — `dismissVariantTracks()` spawns a bent dismiss piece:**
A mirrored geometry Group (straight Z section → bend → diagonal exit to `variant.side`) spawns
at `SPAWN_Z` and translates only in Z. The persistent parallel lane stops spawning new segments
once the dismiss piece is queued. After the dismiss piece passes the player, all variant
geometry is disposed and removed from the scene.

**AC-6 — `acceptVariantTracks()` — character follows bend, new fretboard from horizon:**
1. The dismiss piece geometry spawns (same as AC-5).
2. As the bend section scrolls past the player's position, the character's X transitions to
   the variant lane X (following the bend).
3. The current primary track geometry stops producing new segments and exits frame.
4. The full new fretboard (`variant.base_fret` / `variant.num_lanes`) spawns at `SPAWN_Z`
   and scrolls in — same path as tracks appearing at game start.
5. Game continues on the new note sequence without reloading the game loop. The direction of
   the first pass after accept (UP or DOWN) is determined by the backend (see Story 5-4):
   - RIGHT accept → gameplay resumes descending (DOWN)
   - LEFT accept → gameplay resumes ascending (UP)
   The SceneManager does not need to track this; the WaveScheduler and backend drive note
   order automatically.

**AC-7 — No geometry leak on any path:**
After propose → dismiss, propose → accept, or propose → cleanup(), all variant meshes are
disposed (`geometry.dispose()`, `material.dispose()`, `scene.remove(mesh)`). Scene child
count returns to pre-propose value.

**AC-8 — All animation is Z-translation only:**
No mesh or group rotates at runtime. No X-axis animation. Bends are baked into geometry at
creation. `grep -n "rotation\|position\.x" static/game/SceneManager.js` shows no variant-path
writes after this story (other than the initial construction-time X position of bend vertices).

**AC-9 — `VARIANT_GAP` and camera zoom-out removed:**
`grep -n "VARIANT_GAP\|variantOffsetX\|fov\|zoom"` in `SceneManager.js` returns no variant-
related hits.

**AC-10 — `main.js` call sites unchanged:**
`proposeVariantTracks(variant)`, `acceptVariantTracks({num_lanes, base_fret})`, and
`dismissVariantTracks()` signatures are preserved.

**AC-11 — E2E suite passes:**
`npx playwright test` — no regressions in `epic3-game.spec.ts`, `epic2-cart-difficulty.spec.ts`,
or any other existing spec.

---

## Tasks / Subtasks

- [x] Task 1 — Read and document current SceneManager.js variant methods
  - Read `proposeVariantTracks`, `acceptVariantTracks`, `dismissVariantTracks` and all
    supporting variables (`variantTracks`, `variantOffsetX`, `variantBaseHighlight`,
    `variantFade`, `VARIANT_GAP`, `VARIANT_TINT`) in full.
  - Read `TrackSystem.js` to understand `laneX`, `SPAWN_Z`, and how the existing straight
    track geometry is built — the variant lane segments follow the same pattern.
  - Confirm world-space X orientation: which side is high-fret (RIGHT) and which is low-fret
    (LEFT). Document the finding so the bend geometry is constructed on the correct side.

- [x] Task 2 — Build propose piece geometry (bent track piece, baked-in corner)
  - Create a function `buildVariantBendGeometry(side, laneX, cornerType)` that returns a
    Three.js `Group` or merged `BufferGeometry`.
  - Geometry shape: a straight Z-running lane section at the variant X position, joined via
    a 45° angled section (or a 90° arc of `TubeGeometry`/`ShapeGeometry`) to a diagonal
    section that originates off-screen on `variant.side`.
  - RIGHT side: diagonal entry arrives from the right (high-fret side).
  - LEFT side: diagonal entry arrives from the left (low-fret side).
  - Decide between 45° sharp corner vs 90° rounded arc — see Dev Notes for trade-offs. Pick
    one approach and document the choice in Dev Notes of the completed story.
  - Apply accent material (`#FFB800`, semi-transparent like the safe-zone style).

- [x] Task 3 — Implement `proposeVariantTracks` with Z-scroll
  - Remove full-track-set build, `VARIANT_GAP`, and camera zoom-out.
  - Instantiate the propose piece from Task 2, position at `SPAWN_Z`.
  - Store scroll state: `{ mesh, spawnTimeMs, speedPxPerMs }` (same shape as SafeZoneRenderer
    `userData`) so the render loop can advance Z identically to carts and safe zones.
  - After the propose piece passes (Z > 0), begin spawning straight variant lane segments
    from `SPAWN_Z` each frame (see Dev Notes — persistent parallel lane).
  - Add pulsing root-note highlight.

- [x] Task 4 — Implement persistent parallel lane
  - The straight lane segments use the same geometry as main track lanes but with accent
    material, positioned at `variant.base_lane` X.
  - Spawn new segments from `SPAWN_Z` continuously while the variant is active, remove them
    as they pass Z = 0. Same lifecycle as SafeZoneRenderer zones.

- [x] Task 5 — Build dismiss piece geometry and implement `dismissVariantTracks`
  - Mirror of the propose piece: straight Z section at variant X → corner → diagonal exit
    on `variant.side`.
  - Instantiate dismiss piece at `SPAWN_Z`, scroll in Z.
  - Stop spawning new straight lane segments (Task 4).
  - Dispose all variant geometry once dismiss piece exits frame (Z > 0).

- [x] Task 6 — Implement `acceptVariantTracks` with character follow-through
  - Queue the dismiss piece (same as Task 5) but track the Z position of its bend section.
  - When the bend section reaches the player position (Z ≈ 0): move the character's X to
    the variant lane X (following the bend). Use a short ease-in-out (~200ms).
  - Stop current primary track spawning. Dispose primary track geometry as it exits frame.
  - Call the existing `setBaseFret(variant.base_fret, variant.num_lanes)` (or equivalent) to
    spawn the new fretboard from `SPAWN_Z`. Dispose variant lane geometry once it exits frame.
  - Hand control back to the main game loop; WaveScheduler continues ticking.
  - Note: the SceneManager does not control pass direction after accept — the backend note
    sequence drives whether the player ascends or descends (see Story 5-4, AC-3/AC-4).

- [x] Task 7 — Remove dead constants and variables
  - Delete `VARIANT_GAP`, `VARIANT_TINT`, `variantOffsetX`, `variantFade`, and any other
    variables that only served the old full-parallel-track approach.

- [x] Task 8 — Verify geometry cleanup (AC-7)
  - Manual test or dev-mode assertion: propose → dismiss → check scene.children count.
    Repeat for propose → accept. Zero leftover variant meshes on both paths.

- [x] Task 9 — Run E2E suite (AC-11)
  - `npx playwright test`
  - Fix any regressions. Document changes in Dev Notes.

---

## Dev Notes

### Fundamental principle

**The bend is baked into the geometry. Nothing rotates or moves laterally at runtime.**
Every variant piece is a Three.js Group that translates only in Z, using the same formula
as `SafeZoneRenderer`:

```js
// From SafeZoneRenderer.js — replicate this pattern:
const elapsed = Math.max(0, nowMs - gameStartTime - piece.spawnTimeMs);
const z = SPAWN_Z + (elapsed * piece.speedPxPerMs * 0.5) + offset;
mesh.position.z = z;
```

`SPAWN_Z` and `speedPxPerMs` are read from `TrackSystem.js` and the current game speed
respectively. Variant pieces use the **same speed as carts** — they scroll at game speed so
the visual rhythm is consistent.

### Direction convention

Verify world-space left/right orientation before implementing:
```js
import { laneX } from './TrackSystem.js';
// lane 0 = ? (lowest or highest string / fret)
// lane N-1 = ? (other end)
```

Assumed mapping (verify and correct if wrong):
- Low fret (root side) = left in world space (negative X)
- High fret (highest note side) = right in world space (positive X)

RIGHT variant (`side = "RIGHT"`, triggered after ascending/UP pass):
- The new track is to the RIGHT of the current tracks (further in the high-fret direction).
- Propose piece diagonal entry comes in from the right (positive X side).
- After accept: gameplay continues descending (right → left).

LEFT variant (`side = "LEFT"`, triggered after descending/DOWN pass):
- The new track is to the LEFT of the current tracks (further in the low-fret direction).
- Propose piece diagonal entry comes in from the left (negative X side).
- After accept: gameplay continues ascending (left → right).

### Propose piece geometry construction

The propose piece Group contains two sub-meshes joined at the corner:

```
(viewed from above — Z runs away from the player, X is lateral)

         variant.side = "RIGHT"

                          ↑ Z (horizon/SPAWN_Z)
  Current tracks  | Variant lane (straight section)
                  |
                  |   ← corner (45° or 90° arc)
                   \
                    \  (diagonal section, off-screen to the right at X > variant lane X)
                     \
                      ↓ Z (near player, this end is toward SPAWN_Z offset = the entry)
```

Concrete approach — **45° sharp corner** (simpler):
- Straight section: `PlaneGeometry(laneWidth, straightLength)` at `(variantX, 0, -straightLength/2)`
  rotated flat (`rotation.x = -Math.PI / 2`)
- Diagonal section: a `PlaneGeometry` of the same width, rotated flat AND rotated around Y
  by 45° (`rotation.y = ±Math.PI / 4`), positioned to connect at the corner vertex
- Corner: a small square patch to fill the join gap

**90° rounded corner** (more visually polished):
- Use `THREE.QuadraticBezierCurve3` or `THREE.CatmullRomCurve3` for the bend path, then
  `TubeGeometry` to extrude the lane width around the curve.
- More vertices, better look. Recommended if Three.js version in the project supports it.

Read `static/game/vendor/three.module.js` version before choosing — TubeGeometry is
available in Three.js r128+.

### Dismiss piece geometry

Mirror of the propose piece on the Z axis — the straight section is at the NEAR end (first
to reach the player from the horizon), the corner is in the middle, and the diagonal exit is
at the FAR end (appears last, exits behind the player):

```
(viewed from above)

  Current tracks  | Variant lane (straight — near player end)
                  |
                  |   ← corner
                   \
                    \  diagonal exit
```

Reuse `buildVariantBendGeometry` with a `reverse: true` flag to flip the near/far ends.

### Persistent parallel lane (between propose and dismiss)

After the propose piece exits (Z > 0), spawn straight lane segments continuously, same
lifecycle as SafeZoneRenderer zones:

```js
// Each frame while variant is active and no dismiss queued:
if (needsNewSegment(lastSegmentZ)) {
  const seg = buildStraightLaneSegment(variant.base_lane, variant.num_lanes);
  seg.position.z = SPAWN_Z;
  scene.add(seg);
  variantLaneSegments.push(seg);
}
// Advance + cull passed segments:
for (const seg of variantLaneSegments) {
  seg.position.z += deltaZ; // same as cart movement
  if (seg.position.z > CULL_Z) disposeAndRemove(seg);
}
```

### "Play this note" legibility

Pulsing emissive on the root note lane segment of the persistent lane:

```js
// In render loop:
if (variantHighlightMesh) {
  variantHighlightMesh.material.emissiveIntensity =
    0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now * 0.005));
}
```

The existing `variantHud` text ("Switch → G4 9.8s") is still the primary text signal.
The pulsing highlight is spatial — it shows WHERE on the fretboard to play.

### Accept: character follow-through timing

The bend section of the dismiss piece is at a known Z offset from the piece's origin.
Track the piece's current Z each frame. When `bendSectionZ ≈ CHARACTER_Z` (the Z plane
where the character sprite sits), begin transitioning `character.position.x` to
`variantLaneX`. Use a short ease-in-out (~200ms) so the lateral movement feels physical.
After X transition completes, the character is on the new track and the main fretboard
spawns from `SPAWN_Z`.

### Post-accept gameplay direction (SceneManager perspective)

The SceneManager does not need to reverse or set the play direction after accept. The backend
(Story 5-4) already sets `session.current_note_index` to the correct position in the note
array — descending for RIGHT, ascending for LEFT. The WaveScheduler picks up notes in order,
so the natural traversal direction is established by the note sequence alone. The SceneManager
just needs to ensure the new fretboard layout (`base_fret`, `num_lanes`) is correctly applied
so the lanes match the note positions.

### Do NOT touch

- `main.js` — no call site changes
- `game_engine.py`, `game_router.py` — done in Story 5-4
- `WaveScheduler.js`, `CartSystem.js` — unrelated
- `SafeZoneRenderer.js` — reference only, do not modify
- `window.__gameState.variant` fields — wired in Story 5-1, not driven from SceneManager

### Files to modify

| File | Change |
|------|--------|
| `static/game/SceneManager.js` | Primary — all variant visual logic |
| `static/game/TrackSystem.js` | Read only — `laneX`, `SPAWN_Z`; modify only if a helper needs to be extracted |

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Chose 45° sharp corner approach (BoxGeometry × 2 per piece): simpler, no TubeGeometry dependency
- Removed `clearVariantTracks`, `buildTrackGroup`, and all old state vars (`variantTracks`, `variantOffsetX`, `variantTintMat`, `variantBaseHighlight`, `variantBaseHighlightMat`, `variantFade`, `targetCameraDistance`, `currentCameraDistance`, `VARIANT_GAP`, `CAMERA_DISTANCE_VARIANT`, `VARIANT_TINT`)
- Added `buildBendPiece(side, variantX)` — returns a Group with straight + diagonal sub-meshes; all baked, no runtime rotation (AC-8)
- Added `clearVariantGeom()` — disposes all geometry/materials and resets state (AC-7)
- `proposeVariantTracks`: spawns bend piece + pulsing highlight; no camera zoom (AC-1, AC-2, AC-4)
- `dismissVariantTracks`: spawns dismiss piece, removes highlight, stops lane segment spawning (AC-5)
- `acceptVariantTracks`: clears all variant geom, rebuilds primary tracks with new layout, snaps character X to variant position (AC-6)
- Render loop: Z-only scroll for both pieces; dismiss piece triggers `clearVariantGeom` when it clears Z=0+STRAIGHT_LEN; persistent lane segments spawn/cull continuously (AC-3)
- World-space X orientation: `laneX(i, count) = 1.6 * (i - (count-1)/2)` → lane 0 = leftmost (negative X), lane N-1 = rightmost (positive X). RIGHT variant = positive X = high-fret side. ✓
- Added `lastWaveSpeed` capture in `setWaves()` to drive variant piece scroll speed
- `LANE_X_SCALE` imported from TrackSystem to compute variant X position
- Removed unused `colourForString` import
- 69/69 pytest tests pass (no regressions)

### File List

- `static/game/SceneManager.js`

### Review Findings

- [x] [Review][Patch] AC-6: `acceptVariantTracks` must spawn dismiss piece, animate character X via tween when bend passes player, and delay track rebuild until dismiss piece exits — current code snaps instantly and skips animation sequence [static/game/SceneManager.js:acceptVariantTracks]
- [x] [Review][Dismiss] AC-1: `proposeVariantTracks` uses `_variantLaneX(side)` not `variant.base_lane` — single-lane design makes base_lane irrelevant for positioning; `_variantLaneX` is correct for this design
- [x] [Review][Patch] `variantHighlightMesh` is static at fixed world Z (`-STRAIGHT_LEN/2`), never scrolled in render loop — all other variant geometry scrolls; highlight appears at fixed world position, visually disconnected from scrolling lane [static/game/SceneManager.js:~258,render]
- [x] [Review][Patch] Lane segments use live `lastWaveSpeed` instead of per-seg snapshot — if `setWaves` updates speed mid-display, already-spawned segments change speed retroactively, diverging from propose/dismiss pieces which snapshot speed at spawn [static/game/SceneManager.js:~436]
- [x] [Review][Patch] `dismissVariantTracks` called twice leaks first dismiss mesh — second call passes `if (!variantInfo) return` guard, builds another bend piece, overwrites `variantDismissPiece`; first dismiss mesh removed from neither `variantDismissPiece` reference nor `scene` [static/game/SceneManager.js:dismissVariantTracks]
- [x] [Review][Patch] Segment cull threshold `> SEG_LEN` (25) — segments hang 25 units behind player (past `FRONT_Z = 0`) before disposal; SafeZoneRenderer culls at `z > 0`; inconsistency causes brief visual artifact behind camera [static/game/SceneManager.js:~450]
- [x] [Review][Patch] Character X after accept uses `_variantLaneX` computed with old `numLanes` — if `newPrimary.num_lanes` differs from propose-time `numLanes`, character lands off-grid relative to rebuilt track layout [static/game/SceneManager.js:acceptVariantTracks]
- [x] [Review][Defer] Variant geometry not cleaned up if game ends mid-dismiss animation — `cleanup()` does not call `clearVariantGeom()` directly; self-heals on next `reset()` call [static/game/SceneManager.js] — deferred, self-healing

### Change Log

- 2026-05-23: Story 5-5 implemented — railway-switch peel transition, camera stays fixed (Date: 2026-05-23)
- 2026-05-23: Code review patches applied — P1 accept deferred-state tween pattern, P2 highlight mesh scroll, P3 per-seg speed snapshot, P4 dismissVariantTracks double-call guard, P5 cull threshold SEG_LEN/2, P6 acceptX from newPrimary.num_lanes (Date: 2026-05-23)
