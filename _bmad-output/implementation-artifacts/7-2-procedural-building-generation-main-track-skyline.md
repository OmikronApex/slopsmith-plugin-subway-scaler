# Story 7.2: Procedural Building Generation — Main Track Skyline

Status: review

## Story

As a **player**,
I want procedurally generated buildings of varied heights flanking both sides of the main track,
so the environment feels like a city and Z-movement reads convincingly.

## Acceptance Criteria

**AC-1 — Buildings visible on both sides of the main track:**
Given the game scene loads,
When the main track geometry is rendered,
Then procedurally generated box buildings are visible on the left and right of the track,
And buildings appear before the first wave arrives.

**AC-2 — Buildings positioned clear of track geometry:**
Then buildings are positioned such that their inner edge is at least 3× `LANE_W` (4.2 units) beyond the outermost lane edge for any instrument up to 8 strings,
And the inner building edge X is defined by constant `BLDG_X_INNER = 12` (covers 8-string outermost lane at X = ±5.6 + 0.7 half-width + 4.2 clearance ≈ ±10.5; 12 gives margin),
And no building mesh overlaps any track or cart geometry at any camera angle.

**AC-3 — Randomised building dimensions:**
Then each building has a height randomly chosen in `[BLDG_MIN_H, BLDG_MAX_H]` (default 2.0–8.0),
And each building has a width randomly chosen in `[BLDG_W_MIN, BLDG_W_MAX]` (default 1.5–4.0),
And each building has a depth randomly chosen in `[BLDG_D_MIN, BLDG_D_MAX]` (default 2.0–5.0),
And dimensions are re-randomised each time a building is recycled to the horizon.

**AC-4 — Night City palette, flat-shaded silhouette with window accents:**
Then building body material uses `color: COLORS.BG_NEAR` (`0x252538`) with `flatShading: true` and `dithering: true`,
And no colour literals appear in any material constructor,
And 50–60% of buildings display a window-light accent (`Math.random() < 0.55`): a small emissive `BoxGeometry` strip on the building's front face using `color: COLORS.TEXT_PRIMARY` (`0xE8E8F0`) with `emissiveIntensity: 0.6` — density creates a bustling night-city feel that pulses with the rhythmic cart waves,
And window accent boxes are part of the same recycled `Group` as the building body,
And window geometry is disposed on every recycle regardless of whether the new state is lit or dark (symmetric disposal — no mid-game VRAM accumulation).

**AC-5 — Side-street gap near camera:**
Then no building is positioned within `BLDG_NEAR_CUTOFF = -15` world Z units of the player (i.e. buildings only exist at z ≤ `BLDG_NEAR_CUTOFF`),
And this gap creates the visual impression of a side-street junction where the variant track peels off.

**AC-6 — Buildings scroll with the world:**
Then buildings translate in +Z each frame by `lastWaveSpeed * 0.5 * (dt * 1000)` — the same formula used by floor tiles and pending tracks,
And building Z-motion is visually continuous with the floor plane and track geometry.

**AC-7 — Pool-and-recycle, no unbounded memory growth:**
Then `BLDG_POOL_SIZE = 12` building Groups exist per side (24 total),
And when a building's `position.z > BLDG_CULL_Z` (default 20), it is repositioned to `BLDG_SPAWN_Z` (default -115) and re-randomised,
And buildings are initially spread across `[BLDG_SPAWN_Z, BLDG_NEAR_CUTOFF]` with even Z spacing so the skyline is populated from game start with no visible pop-in,
And no new Three.js objects are created after `createScene()` (only geometry/material properties are mutated on recycle).

**AC-8 — 60 fps not impacted:**
Then the total triangle count added by buildings does not cause frame time to exceed the pre-story baseline by more than 1 ms on the reference device,
And `flatShading: true` keeps per-building draw cost minimal (no normal interpolation).

**AC-9 — Buildings disposed correctly on reset():**
Given `reset()` is called,
Then all 24 building Groups are removed from the scene,
And all building geometries and materials are disposed,
And new building Groups are created and positioned as per initial spawn logic.

**AC-10 — Zero Three.js console warnings:**
When buildings are visible,
Then no Three.js deprecation or material warnings are emitted.

**AC-11 — No regressions:**
All existing E2E tests pass with no new console errors.

**AC-12 — Variant-transition building gaps (reservation system):**
Given a variant track is proposed,
When the propose / dismiss piece scrolls toward and past the player,
Then no main-pool building clips through the propose piece on the variant side,
And no main-pool building clips through the dismiss piece on the opposite (inner) side after adoption,
And no variant-pool building clips through the propose piece's outgoing diagonal on the inner side,
And gap behaviour is implemented via a **reservation system** — a Z range registered with `setBuildingGap(id, { poolSide, poolKind, zRangeAt })` is enforced as a hard invariant at placement time (initial + recycle), not as an emergent drain,
And `placeBuildingBehindPool()` jumps the candidate Z behind any reservation it would overlap, so respawned buildings never land inside a gap,
And the recycle test re-respawns any building whose `[z − d/2, z + d/2]` overlaps an active reservation,
And the gap geometry for each reservation lives in a single `zRangeAt()` closure — modifying width, anchor, or side is a one-line edit,
And reservations are cleared automatically when their anchor piece despawns or `clearVariantGeom()` runs.

**AC-13 — Variant-pool adoption preserves gap intent:**
Given the player accepts a variant and `_worldOffsetX` changes,
When the pre-transition variant pool is adopted as the new main pool,
Then reservations tagged `poolKind: 'variant'` are re-tagged to `'main'` so the same Z constraint keeps applying to the same buildings (now in main arrays),
And the stale `main-propose` reservation (which targeted the retired OLD main pool's outer side) is cleared on adoption to avoid spurious drains on the new main pool's outer side.

**AC-14 — Reservation debug visualiser (testMode):**
Given the page is opened with `?testMode=1` (or any `?testMode` query param),
When a reservation is active,
Then a translucent ground plane is rendered at the reservation's Z range — cyan for `poolKind: 'main'`, magenta for `poolKind: 'variant'`,
And the plane resizes/repositions each frame to match the live `zRangeAt()` return,
And the plane is removed when the reservation is cleared.

---

## Tasks / Subtasks

- [x] Task 1: Add building constants to `SceneManager.js`
  - [x] 1.1 Declare constants inside `createScene()` alongside floor constants:
    ```js
    const BLDG_POOL_SIZE  = 12;     // groups per side
    const BLDG_MIN_H      = 2.0;    // min height
    const BLDG_MAX_H      = 8.0;    // max height
    const BLDG_W_MIN      = 1.5;    // min width (X)
    const BLDG_W_MAX      = 4.0;    // max width
    const BLDG_D_MIN      = 2.0;    // min depth (Z)
    const BLDG_D_MAX      = 5.0;    // max depth
    const BLDG_X_INNER    = 12;     // inner edge X offset from centre (per side)
    const BLDG_X_SPREAD   = 6;      // buildings scatter up to this far outward of BLDG_X_INNER
    const BLDG_SPAWN_Z    = -115;   // Z at which buildings are (re)spawned
    const BLDG_CULL_Z     = 20;     // Z threshold — recycle when building.position.z > this
    const BLDG_NEAR_CUTOFF = -15;   // buildings only at z ≤ this (side-street gap)
    ```
  - [x] 1.2 Create shared materials (declared once, reused by all buildings):
    ```js
    const bldgBodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.BG_NEAR,
      flatShading: true,
      dithering: true,
    });
    const bldgWindowMat = new THREE.MeshStandardMaterial({
      color: COLORS.TEXT_PRIMARY,
      emissive: COLORS.TEXT_PRIMARY,
      emissiveIntensity: 0.6,
      flatShading: true,
      dithering: true,
    });
    ```

- [x] Task 2: Implement building factory and pool
  - [x] 2.1 Implement `randomiseBuildingGroup(group, side)` — mutates existing Group in-place:
    ```js
    function randomiseBuildingGroup(group, side) {
      const h = BLDG_MIN_H + Math.random() * (BLDG_MAX_H - BLDG_MIN_H);
      const w = BLDG_W_MIN + Math.random() * (BLDG_W_MAX - BLDG_W_MIN);
      const d = BLDG_D_MIN + Math.random() * (BLDG_D_MAX - BLDG_D_MIN);
      // body
      const body = group.children[0];
      body.geometry.dispose();
      body.geometry = new THREE.BoxGeometry(w, h, d);
      body.position.set(0, h / 2, 0); // base sits at y=0 (floor level)
      // window (second child) — always dispose before reassigning (symmetric disposal)
      const win = group.children[1];
      const hasWindow = Math.random() < 0.55; // 50-60% density — bustling night city
      win.geometry.dispose(); // dispose regardless of new state — no mid-game VRAM accumulation
      if (hasWindow) {
        win.geometry = new THREE.BoxGeometry(w * 0.5, h * 0.25, 0.05);
        win.position.set(0, h * 0.6, d / 2 + 0.01); // front face
        win.visible = true;
      } else {
        win.geometry = new THREE.BufferGeometry(); // cheap empty geometry placeholder
        win.visible = false;
      }
      // X position — inner edge at BLDG_X_INNER, scatter outward
      const xOffset = BLDG_X_INNER + w / 2 + Math.random() * BLDG_X_SPREAD;
      group.position.x = side === 'left' ? -xOffset : xOffset;
    }
    ```
  - [x] 2.2 Implement `makeBuildingGroup()` factory — creates initial Group with placeholder geometry:
    ```js
    function makeBuildingGroup() {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bldgBodyMat);
      const win  = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.05), bldgWindowMat);
      win.visible = false;
      group.add(body, win);
      return group;
    }
    ```
  - [x] 2.3 Create pool arrays and initial placement:
    ```js
    const bldgZRange = Math.abs(BLDG_NEAR_CUTOFF - BLDG_SPAWN_Z); // total Z spread
    let leftBuildings  = [];
    let rightBuildings = [];
    for (let i = 0; i < BLDG_POOL_SIZE; i++) {
      for (const [arr, side] of [[leftBuildings, 'left'], [rightBuildings, 'right']]) {
        const g = makeBuildingGroup();
        randomiseBuildingGroup(g, side);
        // spread evenly across Z range from SPAWN_Z to NEAR_CUTOFF
        g.position.z = BLDG_SPAWN_Z + (i / BLDG_POOL_SIZE) * bldgZRange;
        scene.add(g);
        arr.push(g);
      }
    }
    ```

- [x] Task 3: Scroll buildings in render loop
  - [x] 3.1 In `render()`, immediately after the floor tile scroll block (line ~840):
    ```js
    // Building scroll (story 7-2) — same speed formula as floor and pending tracks.
    {
      const bldgDelta = lastWaveSpeed * 0.5 * (dt * 1000);
      for (const g of leftBuildings) {
        g.position.z += bldgDelta;
        if (g.position.z > BLDG_CULL_Z) {
          randomiseBuildingGroup(g, 'left');
          g.position.z = BLDG_SPAWN_Z;
        }
      }
      for (const g of rightBuildings) {
        g.position.z += bldgDelta;
        if (g.position.z > BLDG_CULL_Z) {
          randomiseBuildingGroup(g, 'right');
          g.position.z = BLDG_SPAWN_Z;
        }
      }
    }
    ```
  - [x] 3.2 Verify no buildings appear within `BLDG_NEAR_CUTOFF` at any point — initial placement covers `[BLDG_SPAWN_Z, BLDG_NEAR_CUTOFF]`; after recycle they go to `BLDG_SPAWN_Z` which is well past `BLDG_NEAR_CUTOFF`.

- [x] Task 4: Dispose buildings on reset()
  - [x] 4.1 In `reset()`, after floor tile disposal:
    ```js
    // Dispose buildings (story 7-2)
    const allBldgs = [...leftBuildings, ...rightBuildings];
    for (const g of allBldgs) {
      scene.remove(g);
      for (const child of g.children) child.geometry.dispose();
    }
    bldgBodyMat.dispose();
    bldgWindowMat.dispose();
    // Recreate
    bldgBodyMat = new THREE.MeshStandardMaterial({ color: COLORS.BG_NEAR, flatShading: true, dithering: true });
    bldgWindowMat = new THREE.MeshStandardMaterial({ color: COLORS.TEXT_PRIMARY, emissive: COLORS.TEXT_PRIMARY, emissiveIntensity: 0.6, flatShading: true, dithering: true });
    leftBuildings = [];
    rightBuildings = [];
    // ... same init loop as Task 2.3
    ```
  - [x] 4.2 Extract shared init into a `createBuildingPool()` helper to avoid duplication between `createScene()` and `reset()`.

- [x] Task 5: E2E regression check
  - [x] 5.1 `pytest tests/ -x -q` — all existing specs pass, no new console errors.
  - [x] 5.2 Manual visual check: buildings visible on both sides, scroll smoothly, recycle seamlessly, no pop-in at camera.

---

## Dev Notes

### Scroll-World Architecture (Critical)

Same convention as all other scene geometry — **geometry moves toward the player**; player is stationary at Z=0. Building `position.z` increments each frame:

```js
const bldgDelta = lastWaveSpeed * 0.5 * (dt * 1000);
```

This exactly matches the floor tile formula and `_pendingTracks` formula (`pt.speedPxMs * 0.5 * (dt * 1000)`). `lastWaveSpeed` is module-level, initialized to `0.05`, updated by `setWaves()`.

`dt` is in seconds (`Math.min(0.05, (nowMs - lastTime) / 1000)`). `lastWaveSpeed` is units/ms. The `* 1000` converts to units/frame-second. The `* 0.5` is the existing scene scale factor (present in all moving geometry).

### Scene Structure

All code lives inside the `createScene()` closure in `static/game/SceneManager.js`. There is no separate module for buildings. Add after the floor plane block (line ~80) and mirroring the same patterns.

```
createScene()
  ├── renderer setup
  ├── scene, fog, camera
  ├── AmbientLight + DirectionalLight
  ├── trackMat, roofMat
  ├── ─── Floor plane (7-1) ─────
  ├── ─── Buildings (7-2) ───────   ← ADD HERE
  ├── bodyMatByColour map (carts)
  ├── character mesh
  └── render(), reset(), etc.
```

### Track Geometry Reference (for Building Placement)

| Instrument | Outermost lane X | Outermost edge X | BLDG_X_INNER | Clearance |
|---|---|---|---|---|
| 4-string | ±2.4 | ±3.1 | ±12 | 8.9 units ✓ |
| 6-string | ±4.0 | ±4.7 | ±12 | 7.3 units ✓ |
| 8-string | ±5.6 | ±6.3 | ±12 | 5.7 units ✓ (>4.2 req) |

`BLDG_X_INNER = 12` satisfies AC-2 (≥3×LANE_W = 4.2 units clearance) for all instruments.

`laneX(i, n) = 1.6 * (i - (n-1)/2)` — imported from `TrackSystem.js`.

### Materials

Buildings are on **layer 0** (default) — they receive both `AmbientLight` and `DirectionalLight` (the `sun`). This is intentional and different from the floor (layer 1, ambient-only). Add this comment block near the constants to document the split:

```js
// ── Lighting layer split ──────────────────────────────────────────────────
// FLOOR_LAYER = 1: floor tiles receive ambient-only via a dedicated AmbientLight.
//   Reason: DirectionalLight on a large flat plane creates circular brightness
//   banding due to per-vertex lighting interpolation across huge triangles.
// Buildings stay on layer 0: they receive DirectionalLight (sun) as well as
//   ambient. This gives them bright tops and dark sides — the depth cue that
//   makes box silhouettes read as solid 3D forms rather than flat sprites.
//   Different surface, different problem, different solution.
// ─────────────────────────────────────────────────────────────────────────
```

`flatShading: true` gives faceted, low-poly look consistent with the PS1 demake aesthetic. **Do not** use `FLOOR_LAYER = 1` for buildings.

```js
const bldgBodyMat = new THREE.MeshStandardMaterial({
  color: COLORS.BG_NEAR,   // 0x252538 — dark blue-grey, slightly lighter than BG_VOID floor
  flatShading: true,
  dithering: true,          // consistent with all other scene materials added in 7-1
});
const bldgWindowMat = new THREE.MeshStandardMaterial({
  color: COLORS.TEXT_PRIMARY,    // 0xE8E8F0 — soft white
  emissive: COLORS.TEXT_PRIMARY,
  emissiveIntensity: 0.6,
  flatShading: true,
  dithering: true,
});
```

**Do NOT use `COLORS.ACCENT` (0xFFB800) for windows** — it is explicitly reserved for lamppost world lighting (story 7-3). Window lights use `COLORS.TEXT_PRIMARY` instead.

**Do NOT add hex literals** — use only tokens from `COLORS` and `STRING_COLORS` in `tokens.js`.

### Pool Design

Buildings reuse the same Group objects. On recycle, `randomiseBuildingGroup()` mutates geometry dimensions using `.dispose()` + reassignment. Key rules:
1. **Body geometry**: always disposed and reassigned on every recycle.
2. **Window geometry**: always disposed on every recycle regardless of `hasWindow` — symmetric disposal prevents mid-game VRAM accumulation. Use `new THREE.BufferGeometry()` as a cheap placeholder when the window is hidden.
3. The material is shared across all buildings — never disposed per-building, only on `reset()`.

Window density is `Math.random() < 0.55` (~55%) — bustling night city feel. This was chosen over the initial 1/3 spec to match the rhythmic energy of the cart waves and improve visual readability in motion (per UX review).

The `let bldgBodyMat` and `let bldgWindowMat` must be `let` (not `const`) so `reset()` can dispose and recreate them cleanly.

### Side-Street Gap (AC-5)

The gap is created by initial placement: buildings are spread across `[BLDG_SPAWN_Z, BLDG_NEAR_CUTOFF]` = `[-115, -15]`. After recycle they return to `BLDG_SPAWN_Z = -115`. The near-camera zone `(-15, 20)` is permanently empty, giving the side-street / junction look without any dynamic variant-state tracking.

The fog (`THREE.Fog(COLORS.BG_VOID, 35, 100)`) hides the far end — buildings beyond z=-35 are fog-blended, so the effective visible range is only from z=-35 to z=-15 (~20 units), which shows 2-3 buildings per side at any given moment.

### Reset Pattern

`bldgBodyMat` and `bldgWindowMat` must be declared as `let` (reassignable) at the same scope level as `floorMat`. The `reset()` block disposes old materials and recreates them — extract a `createBuildingPool()` helper:

```js
function createBuildingPool() {
  const bldgZRange = Math.abs(BLDG_NEAR_CUTOFF - BLDG_SPAWN_Z);
  leftBuildings = [];
  rightBuildings = [];
  for (let i = 0; i < BLDG_POOL_SIZE; i++) {
    for (const [arr, side] of [[leftBuildings, 'left'], [rightBuildings, 'right']]) {
      const g = makeBuildingGroup();
      randomiseBuildingGroup(g, side);
      g.position.z = BLDG_SPAWN_Z + (i / BLDG_POOL_SIZE) * bldgZRange;
      scene.add(g);
      arr.push(g);
    }
  }
}
```

Called once in `createScene()` and once in `reset()` after material disposal.

### Performance Notes

24 buildings × 2 meshes each = 48 draw calls maximum. Each building body is a `BoxGeometry` (12 triangles). Total added triangles: ~576. This is negligible at 60fps. No instancing needed.

`flatShading: true` disables normal interpolation — cheaper per-fragment shading.

Buildings are on layer 0 so the existing `sun` DirectionalLight illuminates them without any additional light sources.

### Geometry Note on `randomiseBuildingGroup`

`body.geometry.dispose()` must be called before `body.geometry = new THREE.BoxGeometry(...)`. This prevents GPU memory leaks on each recycle. The window mesh follows the same pattern when `hasWindow` is true.

When `hasWindow` is false and `win.visible = false`, the window geometry is not rendered — but it still exists in memory. It is disposed in the `reset()` cleanup loop. This is acceptable for 12 window meshes.

### clearScene() — Buildings Are Permanent

Like floor tiles and the character, buildings are permanent scene elements that do NOT get removed by `clearScene()`. `clearScene()` only removes tracks and waves. Buildings persist across `clearScene()` calls (instrument changes, lane rebuilds) because their X positions are independent of lane count.

This mirrors the decision made for floor tiles in story 7-1.

### Building Gap Reservation System (Story 7-2 follow-up)

The variant-track transition needs the propose / dismiss pieces to pass through the building skyline without clipping. The original implementation tried to manage this with three coupled mechanisms (gap-window function + spawn cap + per-frame "drain frontmost building" loop), which proved fragile — gap math was split across a constants block, a window-computation function, and the drain loop, and the drain was racy under fast scroll.

This was replaced with a **reservation system** — a single first-class concept where each gap is a Z range registered against one pool side, enforced as a hard invariant at placement time.

**Core API (all inside `createScene()` closure):**

```js
setBuildingGap(id, {
  poolSide,  // 'left' | 'right'
  poolKind,  // 'main' | 'variant'
  zRangeAt,  // () => { z0, z1 } in world Z, called each placement check
});
clearBuildingGap(id);
```

`zRangeAt` is the single source of truth for the gap's shape — edit there to change width, anchor, side. Returning `{ z0: -Infinity, z1: -Infinity }` disables the reservation without removing it (used when the anchor piece is briefly null).

**Enforcement points:**

1. `placeBuildingBehindPool(g, side, arr, cursorZ, kind)` — when a building is placed (initial pool creation OR recycle), the candidate front-face Z is jumped behind any reservation it would overlap. Sort by `z1 desc` so cascading jumps land behind the rear-most reservation first.
2. `recyclePool(arr, side, kind, offsetX)` — each frame, each building's `[z − d/2, z + d/2]` is tested against active reservations on its side. Overlap forces an immediate respawn behind the pool (via `placeBuildingBehindPool`, which then enforces invariant (1)).

There is no separate drain mechanism. The invariant is: **after every placement and recycle pass, no building overlaps any active reservation**.

**Pool kind tagging.** Reservations distinguish between the current main pool and the pre-transition variant pool. The variant pool is created at proposal time (`createVariantBuildingPool`) at the eventual world-offset of the new main, and is adopted into `leftBuildings`/`rightBuildings` when `_worldOffsetX` changes. On adoption, `_adoptVariantReservations()` re-tags any `poolKind: 'variant'` reservation to `'main'` so the same Z constraint keeps applying to the same buildings.

**Registered reservations during a variant transition:**

| ID | poolSide | poolKind | zRangeAt | Lifecycle |
|---|---|---|---|---|
| `main-propose` | vSide of variant | `main` | `pz − 65` → `pz − 40` (anchored to propose piece) | Registered in `proposeVariantTracks`; cleared on propose-piece despawn, on adoption, or in `clearVariantGeom`. |
| `variant-outgoing` | inner side (opposite vSide) | `variant` | `pz − 75` → `pz − 50` (anchored to propose piece) | Registered in `proposeVariantTracks`; re-tagged to `main` on adoption; cleared on propose-piece despawn or in `clearVariantGeom`. |
| `main-dismiss` | inner side of new main | `main` | `pz − 65` → `pz − 40` (anchored to dismiss piece) | Registered when dismiss piece spawns (`dismissVariantTracks` or `acceptVariantTracks` via `_registerDismissGap`); cleared in `clearVariantGeom`. |

All three reservations are width 25 in Z, anchored relative to their piece's Z. The variant gap is centred 10 units further behind the piece than the main gap to track the outgoing diagonal more precisely. Tuning width / centre is a one-line edit inside the relevant closure.

**Debug visualiser.** When `window.__TEST_MODE` is true (set by `?testMode` URL param in `main.js`), each active reservation is rendered as a translucent ground plane in `_updateGapDebug()` — cyan for main-pool, magenta for variant-pool. Plane position and scale update every frame from `zRangeAt()`. Disposed when the reservation is cleared.

**To add a new gap:** one `setBuildingGap('your-id', { poolSide, poolKind, zRangeAt })` call. Nothing else to touch.

### Previous Story (7-1) Learnings

- All materials need `dithering: true` (added globally in 7-1 — maintain consistency)
- `flatShading: true` gives PS1 demake faceted look — use for buildings
- Buildings go on layer 0 (NOT `FLOOR_LAYER = 1`) — they benefit from directional shading
- `let` not `const` for any material that gets disposed and recreated in `reset()`
- Renderer already configured: `SRGBColorSpace`, `ACESFilmicToneMapping`, `toneMappingExposure: 1.8` — no changes needed
- `clearScene()` does not touch permanent geometry — document this in code comments
- The `makeFloorTile` closure-over-let pattern works but is fragile to reordering — extract named helpers (`createBuildingPool()`) to make reset() intent explicit

### Files to Modify

**Only `static/game/SceneManager.js`** — no other files need changes.

- `tokens.js`: no changes needed (`COLORS.BG_NEAR` and `COLORS.TEXT_PRIMARY` already exist)
- `TrackSystem.js`: no changes
- `SafeZoneRenderer.js`: no changes

### Testing Strategy

Purely visual — no unit tests for procedural geometry.

1. **`pytest tests/ -x -q`** — regression-green (82/82 passing)
2. **Manual visual check:**
   - Buildings visible on both sides at game start
   - No buildings within ~15 units of player (gap visible)
   - Buildings scroll smoothly, no Z-pop on recycle
   - ~1/3 of buildings have subtle window glow
   - No console warnings

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Implemented all building constants (BLDG_POOL_SIZE=12, BLDG_X_INNER=12, BLDG_NEAR_CUTOFF=-15, BLDG_SPAWN_Z=-115, BLDG_CULL_Z=20, dimension ranges) inside `createScene()` closure alongside floor constants.
- Created shared `bldgBodyMat` (BG_NEAR, flatShading, dithering) and `bldgWindowMat` (TEXT_PRIMARY, emissive, emissiveIntensity 0.6) as `let` for reset() mutability.
- Implemented `randomiseBuildingGroup(group, side)`: mutates geometry in-place, symmetric window disposal (BufferGeometry placeholder when hidden), ~55% window density.
- Implemented `makeBuildingGroup()` factory: Group with body Mesh + window Mesh (hidden initially).
- Extracted `createBuildingPool()` helper: 12 groups per side, evenly spread across [BLDG_SPAWN_Z, BLDG_NEAR_CUTOFF], avoids pop-in at start.
- Building scroll added in render() after floor tile scroll block: same `lastWaveSpeed * 0.5 * (dt * 1000)` formula, recycle to BLDG_SPAWN_Z when z > BLDG_CULL_Z.
- reset() disposes all 24 building geometries + both shared materials, recreates via createBuildingPool().
- Layer 0 (default) for buildings — receive DirectionalLight for depth cues; lighting layer split documented in code comment block.
- 82/82 E2E tests pass, no regressions. No syntax errors.
- Follow-up (2026-05-28): replaced the original gap-window + drain + spawn-cap mechanism with a reservation-based system. Gap geometry is now defined in a single `zRangeAt()` closure per reservation; placement enforces a hard invariant so respawned buildings can never land in a gap, and there is no per-frame drain race. Three reservations register during a variant transition: `main-propose` (main pool, vSide), `variant-outgoing` (variant pool, inner side; re-tagged to `main` on adoption), and `main-dismiss` (main pool, inner side, dismiss piece). All width 25 in Z. Debug visualiser gated on `?testMode` URL param renders each active reservation as a translucent ground plane (cyan = main, magenta = variant). `BLDG_POOL_SIZE` raised from 12 to 26 to fill the visible depth range after reservations claim contiguous Z slices.

### File List

- `static/game/SceneManager.js`

## Change Log

- 2026-05-27: Story 7-2 created
- 2026-05-27: Party mode review — window disposal fix (symmetric), density 1/3→55%, layer 0 confirmed with comment block
- 2026-05-27: Story 7-2 implemented — procedural building pool, scroll, recycle, reset disposal
- 2026-05-28: Variant-transition gap support added — gap-window/drain/spawn-cap mechanism replaced with reservation system (`setBuildingGap`/`clearBuildingGap`, hard-invariant placement, ground-plane debug visualiser via `?testMode`). Added AC-12 (reservation system), AC-13 (adoption re-tag), AC-14 (debug visualiser).
