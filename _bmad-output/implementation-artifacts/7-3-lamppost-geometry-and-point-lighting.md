# Story 7.3: Lamppost Geometry & Point Lighting

Status: review

## Story

As a **player**,
I want lampposts in front of the buildings emitting warm `color-accent` light,
so the Night City atmosphere is reinforced and the scene has a grounded lighting source.

## Acceptance Criteria

**AC-1 — Lampposts placed along street edge:**
Given the game scene loads,
When buildings are rendered on both sides of the track,
Then lamppost geometry is visible along the street edge between the outermost track lane and the building line,
And lampposts are positioned at X = ±(BLDG_X_INNER − 1.5) from centre (1.5 units in front of the building line, clear of track geometry),
And lamppost bases sit at y = 0 (floor level).

**AC-2 — Warm accent light colour with PS1 flicker:**
Then each lamppost emits light using `COLORS.ACCENT` (0xFFB800),
And no colour literals appear in any lamppost material constructor,
And the lamppost pole material uses `COLORS.EDGE` (0x08080F) — a dark silhouette consistent with the Night City palette,
And roughly 40-60% of lampposts (randomly assigned at pool creation) exhibit a subtle intensity wobble driven by a per-lamp phase-shifted sine wave at 2-3 Hz, creating a PS1-era fluorescent flicker that sells the "lived-in infrastructure" feel,
And the flicker modulates the SpotLight intensity between 0.4 and 0.8 (peak-to-peak swing of ±0.2 around the base 0.6), so the effect reads as "slightly unstable" rather than "strobing",
And the lamp head emissiveIntensity does NOT flicker — only the SpotLight intensity oscillates — keeping the bulb mesh itself stable while the cast light shimmers.

**AC-3 — Light reaches track surface:**
Then a SpotLight with `distance: 15`, `angle: Math.PI / 4`, `penumbra: 0.5`, `intensity: 0.6` is attached to each lamppost,
And the spotLight target is positioned at the lamp's X offset, y = 0, z = lamp Z — casting downward onto the street and track surface,
And the light cone visibly illuminates the ground plane and track surface within its radius.

**AC-4 — Lampposts spaced at building density intervals:**
Then `LAMP_POST_SPACING = 12` world Z units between consecutive lampposts (matching average building depth + gap, so every 2-3 buildings have one lamp),
And `LAMP_POOL_SIZE = 12` lampposts per side (24 total) — sufficient to cover the visible Z range with headroom each side of the camera, with room for other light sources without saturating the shader uniform budget.

**AC-5 — Lampposts scroll with the building environment:**
Then lampposts translate in +Z each frame using the same `lastWaveSpeed * 0.5 * (dt * 1000)` formula as buildings and floor tiles,
And when a lamppost's `position.z > BLDG_CULL_Z` (20), it is repositioned to `BLDG_SPAWN_Z` (-115) and its `position.z` is randomised within `[BLDG_SPAWN_Z, BLDG_SPAWN_Z + LAMP_POST_SPACING]`,
And lampposts are part of the same scene layer 0 as buildings — no separate layer.

**AC-6 — Light count limited within WebGL budget:**
Then at most 24 SpotLights exist simultaneously (LAMP_POOL_SIZE × 2 sides),
And each SpotLight has `distance: 15` so lights beyond the fog distance (~100 units at most, effective already at z < -35 due to fog) do not contribute,
And Three.js `WebGLRenderer` `renderer.physicallyCorrectLights` is NOT enabled — existing renderer config uses ACESFilmicToneMapping with default light falloff (no change needed),
And no PointLights are used — SpotLights with distance cutoff provide directional pooling onto the street surface without global over-illumination.

**AC-7 — Pool-and-recycle, no unbounded memory growth:**
Then lampposts are created in `createScene()` and recycled in the render loop — no new SpotLight or Mesh objects are created after `createScene()` (only position changes on recycle),
And on `reset()`, all 24 lamppost Groups are removed, all geometries and materials disposed, all SpotLights removed from scene, and fresh lampposts created.

**AC-8 — 60 fps not impacted:**
Then each lamppost consists of 2 meshes (pole + lamp head) + 1 SpotLight — total 48 meshes + 24 SpotLights at peak,
And the SpotLight distance cutoff (15 units) ensures culling per frame is minimal,
And frame time increase over pre-7-3 baseline does not exceed 0.5 ms on the reference device.

**AC-9 — No Three.js console warnings:**
When lampposts are visible,
Then no Three.js deprecation, material, or WebGL warnings are emitted for SpotLight or lamppost geometry.

**AC-10 — Zero regressions:**
All existing E2E tests pass with no new console errors.

---

## Tasks / Subtasks

- [x] Task 1: Add lamppost constants inside `createScene()` in `SceneManager.js`, after building constants block:
  ```js
  // ─── Lampposts (story 7-3) ──────────────────────────────────────────────
  const LAMP_POST_SPACING = 12;     // Z spacing between consecutive lampposts
  const LAMP_POOL_SIZE     = 12;     // lampposts per side (24 total — 12 visible + buffer each side)
  const LAMP_X_OFFSET      = 10.5;   // X = ±(BLDG_X_INNER - 1.5) — between track edge and building line
  const LAMP_POLE_H        = 3.0;    // pole height
  const LAMP_POLE_R        = 0.08;   // pole radius (thin — reads as distant)
  const LAMP_HEAD_W        = 0.4;    // lamp head width
  const LAMP_HEAD_H        = 0.15;   // lamp head height
  const LAMP_HEAD_D        = 0.4;    // lamp head depth
  ```
  And shared materials (declared once, reused):
  ```js
  let lampPoleMat = new THREE.MeshStandardMaterial({
    color: COLORS.EDGE,
    flatShading: true,
    dithering: true,
  });
  let lampHeadMat = new THREE.MeshStandardMaterial({
    color: COLORS.ACCENT,
    emissive: COLORS.ACCENT,
    emissiveIntensity: 0.8,
    flatShading: true,
    dithering: true,
  });
  ```

- [x] Task 2: Implement lamppost factory and pool
  - [x] 2.1 Implement `makeLamppostGroup(side)` — creates a Group with pole Mesh + lamp head Mesh + SpotLight + per-lamp flicker phase seed:
    ```js
    function makeLamppostGroup(side) {
      const group = new THREE.Group();
      // Pole — thin cylinder
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(LAMP_POLE_R, LAMP_POLE_R * 1.5, LAMP_POLE_H, 6), lampPoleMat);
      pole.position.set(0, LAMP_POLE_H / 2, 0);
      group.add(pole);
      // Lamp head — small box
      const head = new THREE.Mesh(new THREE.BoxGeometry(LAMP_HEAD_W, LAMP_HEAD_H, LAMP_HEAD_D), lampHeadMat);
      head.position.set(0, LAMP_POLE_H, 0);
      group.add(head);
      // SpotLight — warm accent, distance-limited
      const spot = new THREE.SpotLight(COLORS.ACCENT, 0.6, 15, Math.PI / 4, 0.5, 1);
      spot.position.set(0, LAMP_POLE_H, 0);
      spot.target.position.set(0, 0, 0);
      group.add(spot);
      group.add(spot.target);
      // Per-lamp flicker state: 40-60% of lamps flicker at a random phase offset
      const flickerPhase = Math.random() * Math.PI * 2;
      const flickerHz   = 2 + Math.random() * 1; // 2-3 Hz
      const hasFlicker  = Math.random() < 0.55;  // ~55% — PS1 fluorescent instability
      group.userData = { flickerPhase, flickerHz, hasFlicker, spot };
      // X position — street edge, between track and building line
      const xOffset = LAMP_X_OFFSET;
      group.userData.baseX = side === 'left' ? -xOffset : xOffset;
      group.position.x = group.userData.baseX;
      scene.add(group);
      return group;
    }
    ```
  - [x] 2.2 Implement `createLamppostPool()` — creates LAMP_POOL_SIZE lampposts per side, spread across Z range:
    ```js
    function createLamppostPool() {
      leftLampposts  = [];
      rightLampposts = [];
      const zRange = Math.abs(BLDG_NEAR_CUTOFF - BLDG_SPAWN_Z);
      for (let i = 0; i < LAMP_POOL_SIZE; i++) {
        for (const [arr, side] of [[leftLampposts, 'left'], [rightLampposts, 'right']]) {
          const g = makeLamppostGroup(side);
          // Spread evenly across Z range — slightly randomised per lamp so they
          // don't all land at exactly LAMP_POST_SPACING intervals on first spawn.
          const zBase = BLDG_SPAWN_Z + (i / LAMP_POOL_SIZE) * zRange;
          g.position.z = zBase + (Math.random() - 0.5) * LAMP_POST_SPACING * 0.5;
          arr.push(g);
        }
      }
    }
    ```
  - [x] 2.3 Declare pool arrays at module level inside `createScene()`:
    ```js
    let leftLampposts  = [];
    let rightLampposts = [];
    ```

- [x] Task 3: Scroll lampposts in render loop
  - [x] 3.1 In `render()`, after the building scroll block, add lamppost scroll with per-frame flicker update:
    ```js
    // Lamppost scroll + flicker (story 7-3) — same speed formula as buildings.
    {
      const lampDelta = lastWaveSpeed * 0.5 * (dt * 1000);
      const flickerNow = nowMs / 1000; // seconds for sine wave calculation
      for (const g of leftLampposts) {
        g.position.z += lampDelta;
        g.position.x = g.userData.baseX + _worldOffsetX;
        // Flicker: ~55% of lamps modulate SpotLight intensity with per-lamp phase/Hz
        if (g.userData.hasFlicker && g.userData.spot) {
          const s = 0.5 + 0.5 * Math.sin(g.userData.flickerHz * flickerNow * Math.PI * 2 + g.userData.flickerPhase);
          g.userData.spot.intensity = 0.4 + s * 0.4; // oscillate [0.4, 0.8]
        }
        if (g.position.z > BLDG_CULL_Z) {
          g.position.z = BLDG_SPAWN_Z + Math.random() * LAMP_POST_SPACING;
          g.position.x = g.userData.baseX + _worldOffsetX;
        }
      }
      for (const g of rightLampposts) {
        g.position.z += lampDelta;
        g.position.x = g.userData.baseX + _worldOffsetX;
        if (g.userData.hasFlicker && g.userData.spot) {
          const s = 0.5 + 0.5 * Math.sin(g.userData.flickerHz * flickerNow * Math.PI * 2 + g.userData.flickerPhase);
          g.userData.spot.intensity = 0.4 + s * 0.4;
        }
        if (g.position.z > BLDG_CULL_Z) {
          g.position.z = BLDG_SPAWN_Z + Math.random() * LAMP_POST_SPACING;
          g.position.x = g.userData.baseX + _worldOffsetX;
        }
      }
    }
    ```
  - [x] 3.2 Apply _worldOffsetX (variant track offset) to lamppost X positions same as buildings — `g.position.x = g.userData.baseX + _worldOffsetX` in the scroll block.

- [x] Task 4: Dispose lampposts on `reset()`
  - [x] 4.1 In `reset()`, after building disposal, add lamppost disposal. Unlike buildings where shared materials are reused across all instances, SpotLights hold GPU-side resources that must be disposed individually. The traverse must call `SpotLight.dispose()`, dispose mesh materials, and remove orphaned targets from the scene:
    ```js
    // Dispose lampposts (story 7-3)
    for (const g of [...leftLampposts, ...rightLampposts]) {
      scene.remove(g);
      g.traverse(c => {
        if (c.isMesh) {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material?.dispose();
        }
        if (c.isSpotLight) {
          c.dispose();                    // release GPU resources
          scene.remove(c.target);         // target is not auto-removed with light
        }
        if (c.isLight) scene.remove(c);   // lights not auto-removed by Group removal
      });
    }
    lampPoleMat.dispose();
    lampHeadMat.dispose();
    lampPoleMat = new THREE.MeshStandardMaterial({ color: COLORS.EDGE, flatShading: true, dithering: true });
    lampHeadMat = new THREE.MeshStandardMaterial({ color: COLORS.ACCENT, emissive: COLORS.ACCENT, emissiveIntensity: 0.8, flatShading: true, dithering: true });
    leftLampposts = [];
    rightLampposts = [];
    createLamppostPool();
    ```
  - [x] 4.2 **Important:** on `reset()`, SpotLight internal resources (shadow maps if any, target meshes) are cleaned by removing `g.children` from the scene. Since SpotLights are not using shadow maps (`shadow` not configured), this is a straightforward traverse-and-remove per group. The extra `scene.remove(spot.target)` handles the invisible target mesh SpotLight creates internally.

- [x] Task 5: Call `createLamppostPool()` immediately after `createBuildingPool()` in `createScene()` — lampposts are part of the permanent scene geometry:
  ```js
  createBuildingPool();
  createLamppostPool();  // story 7-3
  ```

- [x] Task 6: E2E regression check
  - [x] 6.1 `pytest tests/ -x -q` — all existing specs pass, no new console errors.
  - [x] 6.2 Manual visual check: lampposts visible on both sides, warm glow reaches track surface, scroll smoothly, recycle seamlessly.

---

## Dev Notes

### Scroll-World Architecture

Same convention as buildings, floor tiles, and all other scene geometry — **geometry moves toward the player**; player is stationary at Z=0. Lamppost `position.z` increments each frame:

```js
const lampDelta = lastWaveSpeed * 0.5 * (dt * 1000);
```

Identical to building scroll formula. `lastWaveSpeed` is module-level, initialised to `0.05`, updated by `setWaves()`. `dt` is in seconds (`Math.min(0.05, (nowMs - lastTime) / 1000)`).

### Scene Structure — Placement

All code lives inside the `createScene()` closure in `static/game/SceneManager.js`. Add after the buildings block.

```
createScene()
  ├── renderer setup
  ├── scene, fog, camera
  ├── AmbientLight + DirectionalLight
  ├── trackMat, roofMat
  ├── Floor plane (7-1)
  ├── Buildings (7-2)
  ├── ─── Lampposts (7-3) ──────   ← ADD HERE
  ├── bodyMatByColour map (carts)
  ├── character mesh
  └── render(), reset(), etc.
```

### Lamppost X Positioning

Buildings sit at `BLDG_X_INNER = 12` (inner edge). Lampposts go between the outermost track lane and the building line:

| Element | X position | Notes |
|---------|-----------|-------|
| Outermost track edge (8-string) | ±6.3 | Lane centre ±0.7 half-width |
| Lamppost | ±10.5 | ~4 units outside track edge |
| Building inner edge | ±12 | Building front face |

`LAMP_X_OFFSET = 10.5` puts lampposts at a visually balanced midpoint — far enough from the track to read as street furniture, not track clutter, but inside the building line so they cast light back onto the playing surface.

### SpotLight Parameters — Why These Values

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `color` | `COLORS.ACCENT` (0xFFB800) | Warm street-light yellow, reserved for world lighting |
| `intensity` | 0.6 base (flicker: 0.4–0.8) | Noticeable illumination on track surface without washing out the scene. Overhead sun is 0.9 + ambient 0.45; a lamp at 0.6 reads as a distinct warm source. Flickering lamps oscillate ±0.2 around this base |
| `distance` | 15 | Hard cutoff at 15 units. At scroll speed ~2-3 units/s, a lamp stays lit for ~5-7s before cutoff. Beyond that, fog handles fade-out |
| `angle` | π/4 (45°) | Wide enough cone to illuminate the street surface between the lamppost and track centreline |
| `penumbra` | 0.5 | Soft edge — avoids a hard circular beam boundary on the ground |
| `decay` | 1 (default) | Physical inverse-linear falloff. Renderer uses ACESFilmicToneMapping with default light falloff — no `physicallyCorrectLights` needed |

**Do NOT use PointLight.** PointLights illuminate in all directions — with 32 lamps that would over-illuminate the scene and waste GPU time on backfaces. SpotLight with distance cutoff is directional (downward onto street) and bounds the contribution per lamp.

**Do NOT enable shadow maps** on these SpotLights. Shadow maps per light are expensive (even at low resolution, 32 shadow maps would destroy 60fps). The lampposts provide atmospheric illumination only — no shadow-casting.

### Why Not No Light at All (Emissive-Only)

The UX specification and architecture require light that **reaches the track surface** (AC-3). Pure emissive geometry (glow quad) would not illuminate the ground plane — it would only be a self-illuminated mesh. Without actual SpotLights, the lampposts would be visual-only and fail AC-3.

The SpotLight count (24) is within WebGL budget:
- Reference: Three.js official examples run 16-64 SpotLights without issue on mid-range GPU
- Distance cutoff (15) means only lamps within ~35 units of the camera (about 3 per side) actively contribute each frame — the rest are culled by Three.js
- No shadow maps, no cookie textures — cheap per-light cost
- Reduced from 32 to 24 (per architectural review: 12/side = 6 visible + 6 buffer each side of camera)
- If profiling shows frame time impact >0.5ms, reduce `LAMP_POOL_SIZE` to 8 per side (still covers visible range)

### Pool Design

Lampposts reuse the same Group objects. On recycle (cull plane pass), the Group's `position.z` is reset to `BLDG_SPAWN_Z` + random offset within `[0, LAMP_POST_SPACING]` — this scatters recycled lampposts across the respawn band so they don't all arrive at the camera in lockstep.

Key rules:
1. **Pole + head geometry**: created once per Group in `makeLamppostGroup()`, never disposed on recycle — only position changes
2. **Materials**: shared (`lampPoleMat`, `lampHeadMat`) — disposed only on `reset()`
3. **SpotLights**: attached to the Group, never created or disposed on recycle. On `reset()`, Groups are removed from scene and recreated fresh to match the Three.js lifecycle — SpotLight targets are cleaned up via `scene.remove(spot.target)`.

The `let lampPoleMat` and `let lampHeadMat` must be `let` (not `const`) so `reset()` can dispose and recreate them cleanly — mirroring the `bldgBodyMat`/`bldgWindowMat` pattern from story 7-2.

### Variant Track Offset (`_worldOffsetX`)

Lampposts apply `_worldOffsetX` to their X position in the render loop (same as buildings):

```js
g.position.x = g.userData.baseX + _worldOffsetX;
```

On variant transition, `_worldOffsetX` changes. The lamppost scroll block applies the offset every frame — no special adoption logic needed (unlike variant building pools). Lampposts are part of the permanent scene (like buildings), not pre-populated at proposal time.

### Style: Approach Lighting as Visual Depth Cue

The warm SpotLight cones serve a dual purpose:
1. **Atmosphere**: warm `#FFB800` against `BG_VOID` (#0D0D1A) creates the Night City street-level feel
2. **Depth cue**: lamppost shafts sweeping past at consistent speed provide a primary motion-parallax signal. As a lamppost approaches the player, its light cone grows on the ground plane in peripheral vision — reinforcing Z-movement and speed perception

The `emissiveIntensity: 0.8` on the lamp head material gives a visible glow on the lamp geometry itself (the "bulb"), so even when the SpotLight cone is subtle on the ground, the lamp reads as lit from any angle.

### PS1 Flicker — Night City Atmosphere

To close the gap between "functional track lighting" and "Night City atmosphere", roughly 55% of lampposts exhibit a subtle intensity wobble:

- **Mechanism**: per-lamp phase-shifted sine wave at 2-3 Hz applied to `SpotLight.intensity`
- **Range**: `[0.4, 0.8]` — ±0.2 swing around the base 0.6. Reads as "slightly unstable fluorescent", not "strobing"
- **Only SpotLight flickers**: the lamp head `emissiveIntensity` stays fixed at 0.8, keeping the bulb mesh itself visually stable while the cast light shimmers
- **Same seed persisted**: `hasFlicker`, `flickerHz`, and `flickerPhase` are set once at pool creation and stored in `group.userData`. They survive recycle (Z-reposition) because the Group is never recreated — only its position changes

The flicker serves the PS1 era authenticity requirement (slightly unstable infrastructure reads as "real" and "lived-in") and compensates for the DirectionalLight potentially washing out the SpotLight cones. Even a washed-out cone is perceived as "warm light" when the bulb geometry itself flickers.

### SpotLight Disposal — Critical Pattern (Amelia Review)

On `reset()`, SpotLights require explicit cleanup that static mesh groups do not:

1. **`spot.dispose()`** — releases GPU-side resources held by the light (shadow maps if ever added). Without this, repeated `reset()` calls leak WebGL memory
2. **`scene.remove(spot.target)`** — SpotLight.target is NOT a child of the SpotLight. It is parented to the scene by default. `scene.remove(group)` does not cascade to the target. Orphaned targets accumulate in the scene and trigger matrix updates each render frame
3. **Material disposal** — mesh materials inside the Group are shared references, not instance-owned. The shared materials (`lampPoleMat`, `lampHeadMat`) are disposed separately outside the traversal. The traverse disposes `c.material` for safety (no-op on shared refs but correct if geometry-per-instance pattern is ever introduced)
4. **`scene.remove(c)` for lights** — unlike meshes, removing a Group does not automatically de-parent child Light objects from the scene. Explicit `scene.remove(c)` is required

The correct pattern (from Task 4.1):
```js
g.traverse(c => {
  if (c.isMesh) {
    c.geometry?.dispose();
    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
    else c.material?.dispose();
  }
  if (c.isSpotLight) { c.dispose(); scene.remove(c.target); }
  if (c.isLight) scene.remove(c);
});
```

### SpotLight.target Management in Recycling

After recycling (repositioning a lamppost Group to BLDG_SPAWN_Z), the SpotLight target's position must be reset. The target is part of the Group and moves with it, but its local position (`spot.target.position.set(0, 0, 0)`) points it at the Group's origin — not at the street surface. Since the SpotLight itself is at `(0, LAMP_POLE_H, 0)` within the Group's local frame, and the target is at `(0, 0, 0)` in the same frame, the light always points down at the Group's base. When the Group recycles Z, both light and target move together — no per-cycle adjustment needed. This is correct by design.

### Fog Interaction

Scene fog (`THREE.Fog(COLORS.BG_VOID, 35, 100)`) naturally blends lampposts at distance — lamps beyond z ≈ -35 are fog-blended toward BG_VOID. The SpotLight `distance: 15` and fog together ensure zero rendering cost for distant lamps, complementing the pool recycle pattern.

### Reset Pattern

The `reset()` block mirrors the building disposal pattern:
1. Traverse all lamppost Groups, remove from scene
2. Dispose per-mesh geometries via `traverse`
3. Dispose shared materials
4. Recreate shared materials with `new`
5. Clear pool arrays
6. Call `createLamppostPool()`

### Previous Story (7-2) Learnings

- `let` not `const` for any material that gets disposed and recreated in `reset()`
- `flatShading: true` gives PS1 demake faceted look — use for all environment geometry
- Layer 0 (default) for all environment — receives DirectionalLight for depth cues
- `dithering: true` on all materials for consistency
- Pool-and-recycle pattern avoids unbounded memory growth; no new objects after `createScene()`
- `clearScene()` does not touch permanent geometry — lampposts persist across `clearScene()` calls (instrument changes, lane rebuilds)
- Write `_worldOffsetX` in the per-frame scroll block so lampposts follow variant track transitions without special adoption logic
- Buildings documentation has a `userData.baseX` pattern — reuse for lampposts so variant offset is applied uniformly

### Files to Modify

**Only `static/game/SceneManager.js`** — no other files need changes.

- `tokens.js`: no changes needed (`COLORS.ACCENT` and `COLORS.EDGE` already exist)
- `TrackSystem.js`: no changes
- `SafeZoneRenderer.js`: no changes
- `main.js`: no changes

### Testing Strategy

Purely visual — no unit tests for procedural geometry.

1. **`pytest tests/ -x -q`** — regression-green
2. **Manual visual check:**
   - Lampposts visible on both sides at game start, positioned between track edge and building line
   - Warm light cones visible on track/ground surface
   - Lampposts scroll smoothly with buildings, no Z-pop on recycle
   - Lampposts follow variant track transition (offset shifts with _worldOffsetX)
   - No console warnings
   - Perf: no noticeable frame hitch with 24 SpotLights

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Implemented lamppost constants (LAMP_POST_SPACING=12, LAMP_POOL_SIZE=12, LAMP_X_OFFSET=10.5) and shared materials (lampPoleMat using COLORS.EDGE, lampHeadMat using COLORS.ACCENT) inside createScene() after building constants block.
- Implemented makeLamppostGroup(side): pole CylinderGeometry + head BoxGeometry + SpotLight(COLORS.ACCENT, 0.6, 15, π/4, 0.5, 1) + per-lamp flicker state (flickerPhase, flickerHz 2-3Hz, hasFlicker ~55%).
- Implemented createLamppostPool(): 12 groups per side spread evenly across BLDG_SPAWN_Z→BLDG_NEAR_CUTOFF Z range with ±LAMP_POST_SPACING/2 jitter.
- Added lamppost scroll in render() after building scroll: same speed formula (lastWaveSpeed * 0.5 * dt*1000), _worldOffsetX applied each frame, flicker modulates SpotLight.intensity [0.4,0.8] via sine wave, recycle to BLDG_SPAWN_Z on BLDG_CULL_Z pass.
- Added full disposal in reset(): traverse + spot.dispose() + scene.remove(spot.target) + scene.remove(c) for lights + shared material dispose/recreate + createLamppostPool().
- 82/82 E2E tests pass, no regressions.

### File List

- `static/game/SceneManager.js`

## Change Log

- 2026-05-28: Story 7-3 implemented — lamppost pool (24 SpotLights), PS1 flicker, scroll+recycle, full reset disposal. 82/82 E2E pass.
- 2026-05-28: Story 7-3 created
- 2026-05-28: Party mode review — Winston (SpotLight budget), Sally (flicker + atmosphere gap), Amelia (disposal leak + _worldOffsetX confirmation). Applied: PS1 flicker on ~55% of lamps ([0.4, 0.8] sine at 2-3 Hz), pool size 12/side (24 total), fixed SpotLight dispose/material dispose/scene.remove() in reset()

## References

- **Epics doc:** Story 7-3 definition, ACs, architectural context in Epic 7 overview
- **Previous story:** Story 7-2 — procedural building generation (pool pattern, scroll formula, reset pattern, layer/lighting decisions)
- **Architecture doc:** SceneManager ownership, lighting layer setup (AmbientLight + DirectionalLight), render loop structure
- **UX spec:** Lampposts as warm accent lighting, Night City palette, street-light metaphor
- **tokens.js:** `COLORS.ACCENT` reserved for lamppost world lighting, `COLORS.EDGE` for silhouettes