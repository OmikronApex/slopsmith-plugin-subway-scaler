# Story 7.5: Vertex Shader — Curved World Surface

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player**,
I want the world surface (floor + track area) to appear slightly curved, like running on a cylindrical planet surface,
so that the scene gains PS1-era visual authenticity and a stronger sense of forward motion toward a dropped horizon.

## Acceptance Criteria

**AC-1 — Cylindrical bend applied to world geometry via vertex shader:**
Given the game scene renders,
When the ground plane and track geometry are drawn,
Then a custom vertex shader applies a cylindrical bend to the world geometry (floor tiles, track lanes, building bases, lampposts),
And the bend is implemented by injecting GLSL into the existing materials via `material.onBeforeCompile` — **no material constructor type changes** (still `MeshStandardMaterial` / `MeshPhysicalMaterial`),
And the bend curves the surface **downward in +distance (−Z view space)** so geometry far ahead of the camera dips below the flat-plane line, producing a falling horizon.

**AC-2 — Bend is subtle and configurable:**
Then the curvature strength is driven by a single configurable constant,
And the default value produces a horizon that appears **~5–10° below a flat plane** within the visible draw distance (fog far = 100 units),
And the curvature is **monotonic and smooth** across the visible range — no kink, no inflection inside the draw distance.

**AC-3 — Buildings remain upright (only bases follow the curve):**
Then building geometry above ground level remains **visually upright** — vertical edges do not visibly shear,
And buildings sit **on** the curved surface (their base Y drops with the curve at their Z), rather than floating above or sinking below it,
And the same holds for lampposts (poles stay vertical, bases follow the curve).

**AC-4 — Horizon treatment at the lowered horizon line:**
Then the scene reads with a coherent horizon where the curved ground meets the sky/void,
And horizon fog uses `COLORS.BG_VOID` (`0x0D0D1A`) — within the Night City palette, **no external colour literal**,
And the existing `THREE.Fog(COLORS.BG_VOID, 35, 100)` continues to blend distant geometry into the void at the lowered horizon line (the curve drops far geometry into the fog band, reinforcing the horizon without a hard edge),
And if an explicit horizon ring/backdrop element is added, it uses `COLORS.BG_VOID` fading toward transparent and introduces no new colour outside `tokens.js`.

**AC-5 — Shader handles scrolling/recycling correctly:**
Then because the bend is computed in **view space** (from the per-frame model-view matrix), vertex positions update correctly **automatically** as floor tiles, buildings, and lampposts scroll in +Z and recycle to the rear — no per-object CPU bookkeeping is required,
And no Z-pop, seam, or curvature discontinuity is visible when a tile/building/lamppost recycles from front cull to rear spawn.

**AC-6 — Toggleable via a constant in `tokens.js`:**
Then the curved-world effect is gated by a boolean constant exported from `tokens.js` (e.g. `CURVED_WORLD`),
And when the toggle is `false`, `applyWorldCurve()` is a **no-op** (materials compile to their stock shaders, scene renders flat exactly as pre-7-5),
And the curvature radius/strength constant is also exported from `tokens.js` alongside the toggle.

**AC-7 — 60 fps maintained:**
Then the shader injection adds **zero per-frame CPU cost** (no per-frame uniform thrash beyond what already exists) and negligible GPU cost (a few extra vertex-shader ALU ops),
And the scene holds 60 fps with the curve enabled under the existing building + lamppost load (26 buildings/side pool + 12 SpotLights),
And frame time increase over the pre-7-5 baseline does not exceed **0.5 ms** on the reference device.

**AC-8 — No new console warnings:**
When the curved world is enabled,
Then no Three.js shader-compile errors, deprecation warnings, or WebGL warnings are emitted,
And shader programs are **shared** across instances using the same material (no per-instance program explosion) — verified by a stable `renderer.info.programs` count.

**AC-9 — Zero regressions:**
All existing E2E tests pass with no new console errors, both with the toggle ON and OFF.

---

## Tasks / Subtasks

- [x] **Task 1: Add toggle + curvature constants to `tokens.js`** (AC-2, AC-6)
  - [x] 1.1 Export a boolean toggle and a strength constant. Suggested:
    ```js
    // ===== CURVED WORLD (story 7-5) =====
    // Cylindrical vertex bend applied to world geometry (floor, tracks, buildings,
    // lampposts) via material.onBeforeCompile. Toggle OFF to render flat (debug/compare).
    export const CURVED_WORLD = true;
    // View-space curvature strength. Surface Y is dropped by (viewZ^2 * strength).
    // viewZ is negative ahead of camera, so the square term drops far geometry.
    // Tuned so the horizon (~fog far, ~100 view units ahead) sits ~5-10° below flat.
    // Larger = more aggressive bend. Keep small — this is a subtle PS1 cue, not a fisheye.
    export const WORLD_CURVE_STRENGTH = 0.0009;
    ```
  - [x] 1.2 Document in the comment that `WORLD_CURVE_STRENGTH` is the canonical tuning knob and that disabling `CURVED_WORLD` reverts to stock shaders. Final value is tuned in-engine in Task 5.

- [x] **Task 2: Implement `applyWorldCurve(material)` helper in `SceneManager.js`** (AC-1, AC-3, AC-5, AC-6, AC-8)
  - [x] 2.1 Import the new constants: `import { COLORS, ..., CURVED_WORLD, WORLD_CURVE_STRENGTH } from './ui/tokens.js';`
  - [x] 2.2 Implement the helper near the top of `createScene()`, before any material that needs it is created:
    ```js
    // ─── Curved world vertex bend (story 7-5) ────────────────────────────────
    // Injects a view-space cylindrical bend into a standard material's vertex
    // shader. The surface drops in Y as geometry recedes from the camera
    // (negative view Z), producing a falling horizon. Computed in VIEW space so
    // scrolling/recycling geometry curves correctly with zero CPU bookkeeping
    // (the model-view matrix already carries each object's per-frame Z).
    //
    // No-op when CURVED_WORLD is false — material compiles to its stock program.
    function applyWorldCurve(material) {
      if (!CURVED_WORLD) return material;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uCurveStrength = { value: WORLD_CURVE_STRENGTH };
        shader.vertexShader =
          'uniform float uCurveStrength;\n' +
          shader.vertexShader.replace(
            '#include <project_vertex>',
            `vec4 mvPosition = vec4( transformed, 1.0 );
             #ifdef USE_INSTANCING
               mvPosition = instanceMatrix * mvPosition;
             #endif
             mvPosition = modelViewMatrix * mvPosition;
             // Cylindrical bend: drop Y by the square of view-space depth.
             mvPosition.y -= (mvPosition.z * mvPosition.z) * uCurveStrength;
             gl_Position = projectionMatrix * mvPosition;`
          );
      };
      // Share one compiled program across all instances using this material.
      // Without a stable cache key, three.js may treat onBeforeCompile-modified
      // materials as unique programs. The bend is identical for every material,
      // so a constant key is correct and keeps renderer.info.programs flat.
      material.customProgramCacheKey = () => 'worldCurve';
      return material;
    }
    ```
  - [x] 2.3 **Critical:** the `#include <project_vertex>` replacement above duplicates the stock chunk's body so downstream chunks (`fog_vertex`, lighting) still find a valid `mvPosition` / `gl_Position`. Do **not** delete the include without providing both `mvPosition` and `gl_Position`. Verify the exact stock chunk text against the bundled Three.js version (`static/game/vendor/three.module.js`) — if the chunk differs (e.g. `USE_BATCHING`, morph/skin defines), preserve those branches. Keep the injected body a faithful superset of the stock chunk plus the one bend line.

- [x] **Task 3: Apply the curve to all world-surface materials** (AC-1, AC-3)
  - [x] 3.1 Wrap each world-geometry material at its construction site with `applyWorldCurve(...)`. Targets (all in `createScene()`):
    - `trackMat` (line ~57) — track lanes, variant track pieces (variant pieces reuse `trackMat`)
    - `roofMat` (line ~58) — building roofs
    - `floorMat` (line ~66 **and** its recreation in `reset()` ~717)
    - `bldgBodyMat`, `bldgWindowMat` (lines ~106/111 **and** recreations in `reset()` ~737/742)
    - `lampPoleMat`, `lampHeadMat` (lines ~129/134 **and** recreations in `reset()` ~770/771)
  - [x] 3.2 **Decision — carts and safe zones — OVERRIDDEN by user during dev (2026-05-28):** The story originally scoped these OUT (keep flat). User directed that the bend **also** apply to cart bodies, safe-zone fills, **and** safe-zone borders so the whole world reads as one coherent curved surface. Now curved: cart `bodyMaterial()`, safe-zone fill `szMat` (SceneManager variant + `SafeZoneRenderer`), and safe-zone border `LineBasicMaterial` (both modules + prewarm). Borders use the `basic` shader which also includes `<project_vertex>`, so the same helper bends them — keeping borders aligned with their fills. Player capsule left flat (sits at z≈0, near-zero bend, gameplay-critical). See Dev Agent Record.
  - [x] 3.3 Because `reset()` disposes and recreates `floorMat`, `bldgBodyMat`, `bldgWindowMat`, `lampPoleMat`, `lampHeadMat`, the `applyWorldCurve()` wrap **must** be re-applied at every recreation site, not only at first construction. Easiest: route every `new THREE.MeshStandardMaterial(...)` / `MeshPhysicalMaterial(...)` for these through `applyWorldCurve(new THREE.…)`.

- [~] **Task 4: Horizon treatment** (AC-4)
  - [x] 4.1 Confirm the existing `scene.fog = new THREE.Fog(COLORS.BG_VOID, 35, 100)` already blends curved-down distant geometry into the void. With the bend, far geometry drops into the fog band — verify the horizon reads as a soft `BG_VOID` line, not a hard cut.
  - [ ] 4.2 If (and only if) in-engine review (Task 5) shows a visible gap between the dropped ground edge and the clear-color void (i.e. the curve exposes background above the ground far edge), add a minimal horizon backdrop: a large plane or ring at the far Z, colour `COLORS.BG_VOID`, fading to transparent toward the camera (vertex-alpha or a simple gradient), on its own layer so lighting doesn't tint it. **No new colour literal** — source from `COLORS.BG_VOID`. If fog alone reads correctly, skip the extra geometry and note that in the Dev Agent Record (AC-4 is satisfied by fog).

- [ ] **Task 5: In-engine tuning** (AC-2, AC-3, AC-7)
  - [ ] 5.1 Launch the app, observe the floor/track curve. Tune `WORLD_CURVE_STRENGTH` so the horizon dips ~5–10° below flat within fog distance — subtle, not fisheye.
  - [ ] 5.2 Verify buildings/lampposts stay visually upright (vertical edges don't shear) and sit on the curve, not floating/sinking.
  - [ ] 5.3 Toggle `CURVED_WORLD = false` and confirm the scene renders flat (stock shaders) with no residual curve.
  - [ ] 5.4 Profile: confirm 60 fps held with the full building + lamppost load; frame time delta ≤ 0.5 ms vs flat.
  - [ ] 5.5 Confirm `renderer.info.programs` count is stable (shared program via `customProgramCacheKey`).

- [~] **Task 6: Regression check** (AC-8, AC-9)
  - [x] 6.1 `.venv/Scripts/python.exe -m pytest tests/ -x -q` — 82 passed, no new console errors.
  - [x] 6.2 Ran the E2E baseline suite with `CURVED_WORLD` both ON and OFF, plus a clean-`main` (stashed) baseline. All three states show the **identical** set of pre-existing failures (`isReady` WebGL pageerror + `debug-logging` checkbox a11y violation). Zero NEW failures introduced by 7-5 in either toggle state → AC-9 satisfied.
  - [ ] 6.3 Manual visual check (PENDING — user reference device): curve present, horizon coherent, buildings/lampposts upright, carts + safe zones follow curve, smooth recycle (no curvature pop), no shader-compile warnings. The headless docker env has a **pre-existing** WebGL program-compile error (`isReady`, present on clean main) that blocks reliable in-engine screenshotting here.

---

## Dev Notes

### Files to Modify

- **`static/game/SceneManager.js`** — `applyWorldCurve()` helper, wrap world-surface materials at construction + at `reset()` recreation sites, optional horizon backdrop.
- **`static/game/ui/tokens.js`** — `CURVED_WORLD` toggle + `WORLD_CURVE_STRENGTH` constant (note: tokens lives at `static/game/ui/tokens.js`, imported as `./ui/tokens.js`).
- No backend changes. `TrackSystem.js`, `SafeZoneRenderer.js`, `main.js`: no changes.

### Why view-space bend (not world-space, not CPU)

The whole scene uses a **scroll-world** convention: geometry moves toward the player (+Z) and recycles; the player/camera is stationary at Z=0 (see story 7-2/7-3 dev notes). Computing the bend from `mvPosition.z` (view space) means the curve is a pure function of *distance from camera*, which is exactly what a planet-curvature illusion should be — and it is recomputed every frame from each object's model-view matrix for free. A floor tile or building that recycles from front cull (Z≈+20) to rear spawn (Z≈−115) simply gets a new mvPosition each frame and curves correctly with **zero CPU bookkeeping**. This directly satisfies AC-5. A world-space or CPU-side approach would require per-object updates and could pop on recycle.

### Why `onBeforeCompile` + `customProgramCacheKey`

- `onBeforeCompile` lets us keep the existing `MeshStandardMaterial` / `MeshPhysicalMaterial` (lighting, fog, dithering, flatShading all intact) and inject just the bend — no `ShaderMaterial` rewrite (AC-1).
- Three.js can treat each `onBeforeCompile`-modified material as needing its own program. All our world materials use the **identical** bend, so a constant `customProgramCacheKey = () => 'worldCurve'` lets them **share** the compiled program and keeps `renderer.info.programs` flat (AC-8). Different base materials (Standard vs Physical, with/without emissive) still differ by their own internal keys — the constant key only affects the curve-injection dimension. If the dev finds program sharing across *different* base materials causes wrong shading, scope the key per-material-kind (e.g. return a key that includes the material's defines) — but start with the simple shared key and verify visually.

### The `#include <project_vertex>` replacement — exact-text caution

`shader.vertexShader.replace('#include <project_vertex>', …)` is a literal string replace. It only fires if the bundled Three.js emits that exact include token. **Verify against `static/game/vendor/three.module.js`.** The stock `project_vertex` chunk roughly is:
```glsl
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
```
Our replacement reproduces this and inserts one line before `gl_Position`. If the bundled version adds `USE_BATCHING`, morph, or skinning branches, preserve them. Downstream chunks (`fog_vertex` uses `mvPosition`; lighting uses `vViewPosition = - mvPosition.xyz`) depend on `mvPosition` existing — our version still defines it, so fog and lighting keep working. Note: bending `mvPosition.y` slightly perturbs per-pixel view direction used by lighting/fog; the effect is negligible at this curvature and acceptable (it's a stylistic PS1 cue).

### Buildings stay upright "for free"

Buildings are `BoxGeometry(1,1,1)` scaled per instance (line ~257) — a tall building's vertices nearly all share the same view-space Z (the box is shallow in Z relative to its distance). Since the bend drops Y as a function of `mvPosition.z`, all of a building's vertices drop by ~the same amount → the whole box translates down onto the curve while its vertical edges stay (visually) vertical. No special "base-only" logic needed (AC-3). The same reasoning holds for lampposts (thin in Z). Only the floor (`PlaneGeometry(FLOOR_WIDTH, FLOOR_TILE_DEPTH, 32, 32)` — 32 Z-segments) has enough Z-extent and tessellation to show the curve *as* a curve, which is exactly what we want for the ground surface.

### Floor lighting layer interaction

Floor tiles are isolated on `FLOOR_LAYER = 1` with ambient-only light (see lines 36–55, 73) to avoid directional banding on the big plane. The bend does not change layers or lighting setup — it only displaces vertices. Keep `applyWorldCurve(floorMat)` and leave the layer logic untouched.

### `reset()` recreates materials — re-wrap required

`reset()` (lines ~684–776) disposes and re-creates `floorMat`, `bldgBodyMat`, `bldgWindowMat`, `lampPoleMat`, `lampHeadMat` with fresh `new THREE.…`. Each fresh material is a **stock** material until wrapped — so `applyWorldCurve()` must wrap every recreation site too, or the curve silently drops after the first `reset()` (game restart / game-over → replay). This mirrors the story 7-2/7-3 `let`-material dispose/recreate pattern; just route each recreation through `applyWorldCurve(new THREE.…)`.

### Testing Strategy

Purely visual feature — no unit tests for shader geometry (consistent with 7-1/7-2/7-3). Gates:
1. `.venv/Scripts/python.exe -m pytest tests/ -x -q` — regression-green (the venv python is required; `python`/`pytest` are not on PATH).
2. E2E suite green with toggle ON **and** OFF, zero new console errors (AC-9).
3. Manual in-engine: curve visible & subtle, horizon coherent (`BG_VOID`), buildings/lampposts upright, smooth recycle, stable `renderer.info.programs`, 60 fps.

### Project Structure Notes

- All work lives inside the `createScene()` closure in `static/game/SceneManager.js` plus two constants in `static/game/ui/tokens.js`. Consistent with the Epic 7 pattern (every scenery story is SceneManager-local).
- No raw colour literals: horizon (if added) uses `COLORS.BG_VOID`; the bend introduces no colour.
- `let` vs `const`: the curve helper does not change the existing `let`/`const` material decisions — keep `let` on the dispose/recreate materials.

### Previous Story (7-3) Learnings Carried Forward

- `flatShading: true` + `dithering: true` on all environment materials — the bend injection must not break these (it doesn't; `onBeforeCompile` preserves all material defines).
- Pool-and-recycle: no new GPU objects per frame. The shader approach adds none — the program is compiled once and shared.
- Use the bundled `three.module.js` (vendored) — match the exact shader chunk text of *that* version, not a newer/older Three.js.
- `reset()` recreates `let` materials — any per-material setup (here `onBeforeCompile`) must be re-applied on recreation.
- Variant track pieces reuse `trackMat` (line 786) — wrapping `trackMat` covers them automatically; no separate variant-material curve needed.

### References

- **Epics doc:** `_bmad-output/planning-artifacts/epics.md#Story 7-5` (ACs, lines 515–530), Epic 7 overview (lines 361–384), coverage map (line 543: FR-VP-005; line 544: NFR-001).
- **Previous story:** `_bmad-output/implementation-artifacts/7-3-lamppost-geometry-and-point-lighting.md` — material dispose/recreate in `reset()`, pool/recycle, scroll-world convention, layer/lighting decisions.
- **Source:** `static/game/SceneManager.js` — `createScene()` (line 25), materials (57–140), floor tile geometry (67–79), buildings (82–117, 257), `reset()` material recreation (684–776), render scroll (1424–1470), variant track reuse of `trackMat` (786).
- **Tokens:** `static/game/ui/tokens.js` — `COLORS.BG_VOID` (line 10); add `CURVED_WORLD` + `WORLD_CURVE_STRENGTH` here.
- **Project context:** `_bmad-output/project-context.md` — Three.js / ES-module conventions, no colour literals rule.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- Verified stock `<project_vertex>` chunk in bundled `three.module.js` (line 14001): includes a `USE_BATCHING` branch the story snippet omitted. Injected body preserves **both** `USE_BATCHING` and `USE_INSTANCING` branches plus the one bend line.
- E2E baseline failures (`isReady` WebGL pageerror, `debug-logging` checkbox a11y) reproduce identically on clean `main` (changes stashed) and with `CURVED_WORLD` OFF → confirmed pre-existing/environmental, not introduced by 7-5.

### Completion Notes List

- **Bend implemented** via `material.onBeforeCompile` + view-space Y-drop (`mvPosition.y -= viewZ² · uCurveStrength`). No material constructor changes — still `MeshStandardMaterial`/`MeshPhysicalMaterial`/`LineBasicMaterial`. (AC-1)
- **Toggle + strength** in `tokens.js`: `CURVED_WORLD` (bool) + `WORLD_CURVE_STRENGTH` (0.0009, spec default). When `false`, `applyWorldCurve()` returns the material untouched → stock shaders, flat scene. (AC-2, AC-6)
- **View-space → free recycling:** bend is a pure function of distance-from-camera via the per-frame model-view matrix; scrolling/recycling geometry curves correctly with zero CPU bookkeeping. (AC-5)
- **Program sharing:** `customProgramCacheKey = () => 'worldCurve'`. This is only one component of three's full program cache key — base-material type still differentiates, so `MeshStandard` vs `MeshBasic` (border) programs do not collide while curve-identical materials share a program. (AC-8)
- **`applyWorldCurve` hoisted to module scope and exported** so `SafeZoneRenderer.js` (separate module) shares the exact same helper. One-directional import (SafeZoneRenderer → SceneManager); no circular dependency (SceneManager does not import SafeZoneRenderer).
- **SCOPE OVERRIDE (user-directed, 2026-05-28):** Story Task 3.2 originally excluded carts + safe zones (keep flat). User directed the bend apply to them too. Now curved: world scenery (track, roof, floor, buildings, lampposts) **+** cart bodies **+** safe-zone fills **+** safe-zone borders (`LineBasicMaterial`, both `SceneManager` variant SZ and `SafeZoneRenderer` primary SZ, plus the `prewarmShaders` prototypes so prewarmed programs match runtime). Borders use the `basic` shader, which also includes `<project_vertex>`, so the same helper bends them and they stay aligned with their fills. Player capsule left flat (z≈0 → near-zero bend; gameplay-critical).
- **`reset()` re-wrap:** every disposed/recreated material (`floorMat`, `bldgBodyMat`, `bldgWindowMat`, `lampPoleMat`, `lampHeadMat`) re-routed through `applyWorldCurve()` so the curve survives game-over → replay. (AC-3, AC-5)
- **Horizon (AC-4):** existing `THREE.Fog(COLORS.BG_VOID, 35, 100)` unchanged — far geometry drops into the fog band at the lowered horizon. No backdrop geometry added (Task 4.2 is conditional on an in-engine gap; pending user visual confirmation). No new colour literal introduced.
- **Prewarm spike fix (during dev):** The first-wave lag spike traced to a three.js program-refcount gotcha, not the curve. `prewarmShaders()` warmed the safe-zone fill + border programs, then `finish()` **disposed** those prewarm-only materials. Three reference-counts compiled GPU programs per material, so disposing the sole holder dropped the refcount to 0 and **freed** the program — exactly the one the first wave's safe-zone fill/border need, so it recompiled on first draw (the spike). Fix: retain the prewarm-only fill/border materials for the scene lifetime (`_prewarmKeepAlive`) instead of disposing them; dispose only the throwaway geometries. Shared cart/track/roof materials were already retained, so they stayed warm. Also reverted to compiling in the live `scene` (protos at `y=-1000`) so warmed programs share the runtime fog + light state.
- **Prewarm crash fix (during dev):** `prewarmShaders()` used `renderer.compileAsync(scene, camera)`, whose readiness poll dereferences `currentProgram.isReady()` for every material in the live scene. Some live-scene material is added to compile()'s set without a `currentProgram` (a known three.js compileAsync bug; reproduces on clean `main`, so it predates 7-5) → uncaught `TypeError: program is undefined` at load (observed on Firefox). First attempt — synchronous `renderer.compile()` — removed the crash but reintroduced the first-wave lag spike (compile() only STARTS the async GPU link; the blocking link check then lands on the first draw). **Final fix:** keep `compileAsync` (awaits the link → no spike) but run it on a **dedicated proto-only scene** containing just the well-behaved mesh/line protos, sidestepping the buggy live material. The proto scene mirrors the live scene's program-cache-key inputs — `fog` and per-type light counts (counted from the live scene, matching dummy `DirectionalLight`/`SpotLight` added) — so the compiled programs are reused by the live scene. Verified: `zero JS pageerrors on load` E2E test passes (was failing on main).
- **Gates:** pytest 82 passed; E2E baseline 7/8 pass — the remaining failure (`debug-logging` checkbox missing accessible label) is pre-existing and unrelated to 7-5; the previously-failing pageerror test now passes. Zero NEW failures vs clean main in both toggle states (AC-9). **Pending user reference-device confirmation:** in-engine visual tuning of `WORLD_CURVE_STRENGTH` (~5–10° dip), upright-building check, 60 fps / ≤0.5 ms profiling, stable `renderer.info.programs` (Task 5, Task 6.3) — the headless docker WebGL env cannot render reliably (pre-existing `isReady` error).

### File List

- `static/game/ui/tokens.js` — added `CURVED_WORLD` toggle + `WORLD_CURVE_STRENGTH` constant.
- `static/game/SceneManager.js` — module-level exported `applyWorldCurve()` helper; wrapped `trackMat`, `roofMat`, `floorMat` (+reset), `bldgBodyMat`/`bldgWindowMat` (+reset), `lampPoleMat`/`lampHeadMat` (+reset), cart `bodyMaterial()`, variant safe-zone fill + border, and `prewarmShaders` SZ fill + border. Also fixed a pre-existing load-time crash: `prewarmShaders()` now uses synchronous `renderer.compile()` instead of `compileAsync()` (whose readiness poll crashed on the Sprite label's program), and drops the SpriteMaterial proto.
- `static/game/ui/SafeZoneRenderer.js` — import `applyWorldCurve`; wrapped primary safe-zone fill + border materials.

## Change Log

| Date       | Change                                                                                                              |
|------------|---------------------------------------------------------------------------------------------------------------------|
| 2026-05-28 | Implemented curved-world vertex bend: `tokens.js` constants, exported `applyWorldCurve()` helper, wrapped all world-surface + cart + safe-zone materials. Scope expanded per user to include carts and safe-zone fills/borders (Task 3.2 override). pytest 82 green; E2E zero new failures vs main (ON & OFF). In-engine visual tuning/fps pending user reference device. Status → review. |
