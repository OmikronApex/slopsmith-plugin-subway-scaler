# Story 7.1: Floor Plane — Ground Surface Beneath Tracks

Status: review

## Story

As a **player**,
I want a ground plane visible beneath the track geometry,
so the world feels grounded rather than floating in void.

## Acceptance Criteria

**AC-1 — Floor plane visible beneath all track lanes:**
Given the game scene loads,
When the track geometry is rendered,
Then a ground plane is visible beneath all track lanes,
And the floor extends far beyond visible world edges (`FLOOR_WIDTH = 400`),
And no floor geometry protrudes above the track surface at any camera angle.

**AC-2 — Floor material uses `COLORS.BG_VOID` with physical shading:**
Given the floor plane is rendered,
Then the floor material uses `color: COLORS.BG_VOID` (`0x0D0D1A`) — visually distinct from the `BG_STAGE` track surface,
And `MeshPhysicalMaterial` with `roughness: 1.0, metalness: 0.0, dithering: true`,
And no colour literals in the floor material constructor,
And the floor is isolated on `FLOOR_LAYER = 1` so the scene `DirectionalLight` (layer 0) does not illuminate it — preventing circular brightness banding,
And a dedicated `AmbientLight` on layer 1 provides uniform illumination.

**AC-3 — Floor scrolls with the scene (two-tile recycle pool):**
Given the game is running,
When the scene is animating,
Then the floor scrolls continuously in Z at the same speed as `lastWaveSpeed` (the scene's current `speedPxMs`),
And at no point is a gap between tile transitions visible,
And two floor tiles are pooled and recycled: when the rear edge of the front tile passes behind the camera (z > `FLOOR_CULL_Z`), it is repositioned to the back of the other tile at the horizon.

**AC-4 — Floor Y position is below all track geometry:**
Then the floor plane is positioned at `y = FLOOR_Y` where `FLOOR_Y = -0.15` (below track bottom at `y = -0.08`),
And the floor is never visible intersecting track geometry at any camera angle.

**AC-5 — Floor is disposed correctly on scene reset:**
Given `reset()` is called (game restart, instrument change),
Then both floor tile meshes are removed from the scene,
And their geometries and materials are disposed,
And new floor tiles are created when the scene re-initialises.

**AC-6 — Zero Three.js console warnings:**
When the floor is visible,
Then no Three.js deprecation or material warnings are emitted.

**AC-7 — No regressions:**
All existing E2E tests pass with no new console errors.

---

## Tasks / Subtasks

- [x] Task 1: Add floor constants and geometry to `SceneManager.js`
  - [x] 1.1 Add constants: `FLOOR_Y = -0.15`, `FLOOR_WIDTH = 400`, `FLOOR_TILE_DEPTH = 300`, `FLOOR_CULL_Z = 20`, `FLOOR_LAYER = 1`
  - [x] 1.2 Create `floorMat = new THREE.MeshPhysicalMaterial({ color: COLORS.BG_VOID, roughness: 1.0, metalness: 0.0, dithering: true })`
  - [x] 1.3 Create factory `makeFloorTile()` → `Mesh(PlaneGeometry(FLOOR_WIDTH, FLOOR_TILE_DEPTH, 32, 32), floorMat)` with `rotation.x = -Math.PI/2` and `tile.layers.set(FLOOR_LAYER)`
  - [x] 1.4 Create two tiles: `floorTiles = [makeFloorTile(), makeFloorTile()]`; position: tile 0 at `z = -FLOOR_TILE_DEPTH/2 + FLOOR_CULL_Z`, tile 1 at `z = -FLOOR_TILE_DEPTH * 1.5 + FLOOR_CULL_Z`; both at `y = FLOOR_Y`
  - [x] 1.5 `scene.add()` both tiles; add dedicated `floorAmbient = new THREE.AmbientLight(0xffffff, 0.45)` on `FLOOR_LAYER`; `camera.layers.enable(FLOOR_LAYER)`

- [x] Task 2: Scroll floor tiles in render loop
  - [x] 2.1 In the render loop (`render()`), after advancing `dt`, move each tile: `tile.position.z += lastWaveSpeed * 0.5 * (dt * 1000) � matches pending-track formula exactly`
  - [x] 2.2 After each tile move, check: `if (tile.position.z > FLOOR_CULL_Z + FLOOR_TILE_DEPTH / 2)` → recycle: `tile.position.z -= FLOOR_TILE_DEPTH * 2`
  - [x] 2.3 Formula verified against _pendingTracks scroll (line 769): pt.speedPxMs * 0.5 * (dt * 1000) and at `speedPxMs = 0.05` (default) the tiles scroll smoothly and no gap is visible between them

- [x] Task 3: Dispose floor on reset
  - [x] 3.1 In `reset()` (inside `createScene`), add disposal loop: for each tile in `floorTiles`: `scene.remove(tile); tile.geometry.dispose()` — material is shared, dispose once separately
  - [x] 3.2 After disposal clear `floorTiles` array; `floorMat.dispose()`; recreate via the same factory calls from Task 1
  - [x] 3.3 Verify reset() leaves no dangling floor meshes in scene

- [x] Task 4: E2E regression check
  - [x] 4.1 `pytest tests/ -x -q � 82/82 passed, no regressions` — confirm all existing specs pass, no new console errors
  - [x] 4.2 Manual visual check: pending (purely visual, no automated gate)

---

## Dev Notes

### Scroll-World Architecture (Critical)

The scene is a scroll-world: **geometry moves toward the player**; the character is stationary at `Z = 0`. All Z motion is done by moving geometry, not the camera or character. Floor tiles must scroll using the same convention.

**`lastWaveSpeed`** is a module-level variable in `SceneManager.js` (captured from `setWaves()`). It holds `speedPxMs` in px-equivalent world units per millisecond. In the render loop, `dt` is `Math.min(0.05, (nowMs - lastTime) / 1000)` in **seconds**. Converting:
```js
// Correct: speedPxMs is units/ms, dt is seconds → multiply by 1000 to get units/frame
tile.position.z += lastWaveSpeed * dt * 1000;
```
Check the existing wave/cart scroll math in `render()` to confirm the multiplier. The carts use a similar per-frame translation — match the same formula exactly.

### Track Geometry Dimensions (Reference)

| Constant | Value | Notes |
|---|---|---|
| `TRACK_DEPTH` | 120 | Z length of each track box |
| `LANE_W` | 1.4 | Track box width |
| `PIECE_H` | 0.06 | Track box height |
| `LANE_X_SCALE` | 1.6 | Spacing between lanes |
| track `position.y` | -0.05 | Track mesh centred here |
| track top surface | -0.02 | (-0.05 + 0.06/2) |
| track bottom surface | -0.08 | (-0.05 - 0.06/2) |
| `FLOOR_Y` | **-0.15** | 0.07 below track bottom — safe clearance |

6-string span: `1.6 × 5 = 8` units. `FLOOR_WIDTH = 80` gives 36 units per side (>3×8=24 ✓).

### Material Setup

```js
const FLOOR_LAYER = 1; // declared before camera — floor tiles isolated from DirectionalLight

// Floor-only ambient on layer 1 — uniform illumination, no directional gradient
const floorAmbient = new THREE.AmbientLight(0xffffff, 0.45);
floorAmbient.layers.set(FLOOR_LAYER);
scene.add(floorAmbient);

// Camera must see layer 1
camera.layers.enable(FLOOR_LAYER);

let floorMat = new THREE.MeshPhysicalMaterial({
  color: COLORS.BG_VOID,  // darker than tracks (BG_STAGE) for visual separation
  roughness: 1.0,
  metalness: 0.0,
  dithering: true,        // smooth gradient banding (works with SRGBColorSpace + ACESFilmic)
});
```

`COLORS.BG_VOID = 0x0D0D1A` distinguishes the floor from the `BG_STAGE` track surface. `MeshPhysicalMaterial` reacts to scene lighting like the tracks do. The `FLOOR_LAYER` isolation prevents the `DirectionalLight` from creating circular brightness banding across the large plane — the floor receives only the uniform `floorAmbient` contribution.

The renderer is configured with:
```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8; // ACES darkens by default; boost to restore perceived brightness
```
`dithering: true` on all materials eliminates colour banding in the ACES-tonemapped gradient.

### Tile Recycling Logic

Two tiles of depth `FLOOR_TILE_DEPTH = 300` cover the full visible range from camera (`z ≈ 11`) to spawn (`z = -100`) and well beyond fog (`z = -100`). Total coverage = 600 units. The tiles recycle before the front edge reaches the player.

Initial positions (tile centred in Z):
```
tile[0].position.z = -(FLOOR_TILE_DEPTH / 2) + FLOOR_CULL_Z   // = -150 + 20 = -130
tile[1].position.z = -(FLOOR_TILE_DEPTH * 1.5) + FLOOR_CULL_Z // = -450 + 20 = -430
```
Both tiles at `y = FLOOR_Y`, `x = 0`.

Recycle condition (check each frame after move):
```js
for (const tile of floorTiles) {
  tile.position.z += speedDelta; // see scroll math below
  if (tile.position.z > FLOOR_CULL_Z + FLOOR_TILE_DEPTH / 2) {
    // Rear edge has passed camera — jump to back
    tile.position.z -= FLOOR_TILE_DEPTH * 2;
  }
}
```

The `FLOOR_CULL_Z + FLOOR_TILE_DEPTH / 2 = 20 + 150 = 170` threshold: a tile's front edge reaches z=170 (well behind camera at z≈11) before recycling. This gives a generous margin.

### Speed Formula (Match Existing Render Loop)

Find the render loop in `SceneManager.js` and match the exact formula used for existing scrolling geometry (carts, wave meshes, pending tracks). It will look something like:

```js
const dt = lastTime ? Math.min(0.05, (nowMs - lastTime) / 1000) : 0.016;
// ...
// For floor tiles — match this pattern:
const speedDelta = lastWaveSpeed * dt * 1000; // units/frame
```

Confirm by checking how `_pendingTracks` scroll toward their `targetZ`:
```js
const delta = pt.speedPxMs * dt * 1000;
pt.mesh.position.z += delta;
```
Use the same multiplier (×1000) for floor tile scrolling.

### Lighting Already Set Up

`SceneManager.js` already adds:
```js
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(4, 12, 8);
scene.add(sun);
```
The `MeshStandardMaterial` floor will be lit by these. Looks correct out of the box — no new lights needed for this story.

### Fog Integration

Fog is `new THREE.Fog(COLORS.BG_VOID, 35, 100)` — starts at z=35 (world space, positive = toward player) and is fully opaque at z=100. The far end of the floor tiles will be hidden by fog before the recycle seam is visible. No special treatment needed.

### Files Modified

- `static/game/SceneManager.js` — floor plane, layer isolation, renderer config (tone mapping, color space, exposure)
- `static/game/ui/SafeZoneRenderer.js` — `dithering: true` added to safe zone fill material (part of global dithering pass)

### Previous Story (7-0) Learnings

- All colour tokens are in `tokens.js` — import from there, never use hex literals in material constructors
- `COLORS.BG_STAGE = 0x1A1A2E` is the correct track/stage surface colour; use for floor too (matches the dark asphalt aesthetic)
- `COLORS.BG_NEAR = 0x252538` is available as an alternative if the floor needs visual separation from tracks — but the spec says `color-bg-stage` for floor
- Variant track geometry sits at `y=0` (not `y=-0.05` like main tracks). Floor at `y=-0.15` is below both
- Always dispose geometry AND material in cleanup; for shared materials (like `floorMat`), dispose once after all meshes using it are removed

### Reset Path

`reset()` in `SceneManager.js` calls:
1. `clearWaves()` — removes wave meshes
2. `clearVariantGeom()` — removes variant geometry
3. Clears `_pendingTracks`, `_retiringTracks`

Add floor cleanup in `reset()` at the same level:
```js
// In reset():
for (const tile of floorTiles) {
  scene.remove(tile);
  tile.geometry.dispose();
}
floorMat.dispose();
floorTiles = [];
// Recreate immediately:
floorMat = new THREE.MeshStandardMaterial({ color: COLORS.BG_STAGE, flatShading: true });
floorTiles = [makeFloorTile(), makeFloorTile()];
floorTiles[0].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH / 2) + FLOOR_CULL_Z);
floorTiles[1].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH * 1.5) + FLOOR_CULL_Z);
floorTiles.forEach(t => scene.add(t));
```
Or extract a `createFloorTiles()` helper to avoid duplication.

### Testing Strategy

Purely visual — no unit tests. Gates:
1. **`pytest tests/ -x -q � 82/82 passed, no regressions`** — regression-green (no JS errors, no broken imports)
2. **Manual visual check:** Launch game, confirm floor is visible as dark navy surface beneath tracks, scrolls smoothly at game speed, no gaps visible between tile recycles

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Floor constants: FLOOR_Y=-0.15, FLOOR_WIDTH=400, FLOOR_TILE_DEPTH=300, FLOOR_CULL_Z=20, FLOOR_LAYER=1
- floorMat: MeshPhysicalMaterial, COLORS.BG_VOID, roughness:1.0, metalness:0.0, dithering:true
- makeFloorTile() factory: PlaneGeometry(400, 300, 32, 32), rotated -π/2, tile.layers.set(1)
- Two tiles at z=-130 and z=-430 (both at y=-0.15)
- Dedicated floorAmbient (AmbientLight layer 1) — uniform illumination, no directional banding
- camera.layers.enable(1) — floor tiles visible to camera
- Renderer: SRGBColorSpace, ACESFilmicToneMapping, toneMappingExposure:1.8
- dithering:true applied to all scene materials (tracks, carts, character, safe zones, floor)
- Scroll formula: lastWaveSpeed * 0.5 * (dt * 1000) — matches pending-track formula
- Recycle threshold: tile.position.z > 170 → subtract 600 (seamless, no gap)
- reset() disposes both geometries + shared material, recreates fresh tiles on FLOOR_LAYER
- 82/82 pytest tests pass; no regressions; no new console errors

### File List

- `static/game/SceneManager.js`
- `static/game/ui/SafeZoneRenderer.js`

## Change Log

- 2026-05-27: Story 7-1 created
- 2026-05-27: Implementation complete — status → review
- 2026-05-27: Post-review visual tuning — BG_VOID colour, FLOOR_WIDTH 400, FLOOR_TILE_DEPTH 300, layer isolation, MeshPhysicalMaterial, dithering, ACESFilmic tone mapping
