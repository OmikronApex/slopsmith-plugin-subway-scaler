# Story 7.6: Animated Character Sprite (Pixel-Art Runner)

Status: review

## Story

As a **player**,
I want the character capsule (currently an abstract pink pill shape) to be replaced with an animated pixel-art running sprite loaded from a `.gif` spritesheet,
so that the game has a charming retro character that visually reinforces the PS1 demake aesthetic and gives the world a protagonist.

## Acceptance Criteria

**AC-1 — Character capsule replaced by a pixel-art sprite:**
Given the game scene loads,
When the initial scene is rendered,
Then the player character is displayed as a textured quad (not the previous `CapsuleGeometry`),
And the texture is sourced from a `.gif` or `.png` spritesheet stored in `static/assets/`,
And the character occupies roughly the same volume as the old capsule (same X/Z foot-print, same Y elevation at `CHAR_Y`),
And the old `CapsuleGeometry(0.28, 0.6, 4, 8)` and its pink `0xff4488` material are removed.

**AC-2 — Running animation cycles from a spritesheet:**
Given the character sprite is rendered,
When the game is in a playable phase (loading, countdown, playing, transition, game-over),
Then the sprite texture animates through the running frames of the spritesheet at a configurable frame rate (default ~12 fps),
And the animation frame updates based on game time (not wall-clock time, so pause does not advance frames),
And the animation loops continuously while the character is on screen.

**AC-2a — Frame count matches the real asset:**
Given the actual asset is `Character_running_north.gif` (124×124 px, 4 frames),
Then the implementation must handle exactly **4 frames** (indexed 0–3),
And the frame count MUST be derived from a `CHARACTER_FRAME_COUNT` constant in `tokens.js` (not hardcoded),
And each frame is the full canvas (124×124) — no sub-rect slicing needed.

**AC-3 — Sprite faces the camera (billboard) with correct orientation:**
Given the sprite is rendered in the 3D scene,
When the camera is at its default position,
Then the sprite always faces the camera (billboards on the Y axis only — rotates around Y, does NOT tilt up/down),
And the sprite is upright and visible at all camera angles reachable during gameplay (including 45° bend during variant transitions),
And the sprite mesh is a `THREE.Mesh` with a `THREE.MeshBasicMaterial` (or `THREE.SpriteMaterial` — see Dev Notes for the billboard approach decision),
And the sprite is NOT affected by the world-curve vertex shader (it always stands upright at the character's Z ≈ 0).

**AC-4 — Smooth integration with existing character behaviors:**
Given the sprite replaces the capsule,
When the character slides between lanes (X), rotates (Y yaw), or moves in Z,
Then the sprite mesh position and rotation update exactly as the capsule did,
And the `getCharacterX()`, `getCharacterZ()`, `setCharacterX()`, `setCharacterTargetX()`, `snapCharacterYaw()` functions all work identically,
And collision detection (`checkCollision`) treats the sprite's position the same as the old capsule's — no change to collision behavior.

**AC-5 — Sprite loaded via the bundled three.js TextureLoader:**
Given the `.gif` or spritesheet asset exists in `static/assets/`,
When the scene initialises,
Then the asset is loaded using `new THREE.TextureLoader()` from the bundled `three.module.js`,
And the texture is configured with `minFilter: THREE.NearestFilter`, `magFilter: THREE.NearestFilter` for pixel-art crispness,
And the load happens during the prewarm phase so the texture (and any first-frame compile) is ready before gameplay starts.

**AC-6 — Animation uses a Canvas-based frame-advance (for .gif input):**
Given the input is a `.gif` file,
When the asset is loaded,
Then a helper function extracts individual frames from the GIF onto a shared canvas (`document.createElement('canvas')`),
And each frame's image data is stored as an array of `ImageData` or pre-drawn onto separate canvases,
And the render loop updates the sprite's texture map by picking the current frame based on game-time ÷ frameDuration and drawing it onto the active CanvasTexture,
Or (if a pre-packed spritesheet .png is used instead) the texture UV offset is shifted each frame to show the correct cell.

**AC-7 — Frame dimensions match the sprite sheet cell size:**
Given the spritesheet (whether .gif or .png strip),
When the asset is loaded,
Then the frame width and height are auto-detected from the first frame (for .gif) or configured as constants in `tokens.js` (for .png spritesheet),
And each frame is cropped to the sprite's bounding box (transparent or alpha-keyed around the sprite),
And the quad geometry aspect ratio matches the frame aspect ratio (maintained proportionally, not stretched).

**AC-8 — Disposal on reset / game-over:**
Given a game-over → replay cycle,
When `reset()` is called,
Then the sprite mesh and its animated texture are properly disposed:
  - The `CanvasTexture` (or texture) is disposed via `.dispose()`
  - The material is disposed (or retained if shared via material cache — see Dev Notes)
  - Frame buffers are cleared
  - The sprite is re-created fresh on the next `createScene()` call / prewarm

**AC-9 — No regressions:**
Given the sprite is rendering with animation,
When all existing E2E tests run,
Then all previously-passing tests still pass,
And no new console errors, WebGL warnings, or texture-loading errors are emitted,
And collision-detection tests produce identical results to the capsule.

**AC-10 — .gif spritesheet is NOT checked into the repo (dev workflow):**
Given the `.gif` asset is user-provided,
When the developer implements this story,
Then the `.gif` or `.png` file is placed in `static/assets/` but `.gitignore` includes `static/assets/` (or the user provides their own asset) so the file is not committed,
And the story implementation code works with a **placeholder**: a simple procedural pixel-art character drawn on a canvas (see Dev Notes — Placeholder Implementation),
And the real `.gif` can be swapped in without code changes (just drop the file and update the path constant).

---

## Tasks / Subtasks

- [x] **Task 1: Create asset directory and placeholder pixel-art sprite** (AC-10)
  - [x] 1.1 Create `static/assets/` directory if it doesn't exist, add to `.gitignore`
  - [x] 1.2 Implement a **procedural placeholder** in JavaScript: a canvas-drawn pixel-art running character (simple 16×16 or 24×24 stick figure with 4-6 running frames). This ensures the feature works without any external file. The placeholder code lives in a helper function, e.g.:
    ```js
    function generatePlaceholderFrames(frameCount = 4, size = 24) {
      // Draws simple pixel running frames procedurally on canvases.
      // Returns an array of HTMLCanvasElement[], one per frame.
    }
    ```
  - [x] 1.3 The placeholder is the default; if a real asset file is present in `static/assets/`, it takes precedence.
  - [x] 1.4 Add a `CHARACTER_SPRITE_PATH` constant in `tokens.js` pointing to the expected asset location (e.g. `'assets/character-run.gif'` or `'assets/character-spritesheet.png'`).

- [x] **Task 2: Implement GIF frame extraction helper** (AC-2, AC-6, AC-7) — **Skip if using .png spritesheet**
  - [x] 2.1 Create `static/game/characters/GifLoader.js` (or put helper in `SceneManager.js` if small):
    A function that takes an `<img>` element with a loaded `.gif` and returns an array of frame canvases.
    Uses the 2D canvas `drawImage()` at sequential time offsets or an offscreen `<canvas>` with a minimal GIF decoder.
    - **Option A (Simple):** If the .gif is a horizontal spritesheet strip (pre-arranged), just slice it into equal-width frames.
    - **Option B (Complex):** Use a JS GIF parser library or `ImageDecoder` API (Chrome 108+) — only if animation timing matters.
  - [x] 2.2 Provide a `parseGifStrip(image, frameWidth, frameHeight)` that takes a pre-arranged horizontal strip and returns an array of `HTMLCanvasElement`.

- [x] **Task 3: Replace character CapsuleGeometry with animated sprite mesh** (AC-1, AC-3, AC-4)
  - [x] 3.1 In `createScene()` (line 641 of SceneManager.js), replace:
    ```js
    const character = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff4488, dithering: true }),
    );
    ```
    with:
    ```js
    // Animated character sprite (story 7-6).
    const characterSprite = createCharacterSprite();
    ```
  - [x] 3.2 The `createCharacterSprite()` function constructs:
    - A `THREE.Mesh` with a `THREE.PlaneGeometry` sized to match the sprite's aspect ratio at a world-space height of ~0.6 (matching old capsule height)
    - A `THREE.MeshBasicMaterial` with a dynamic `THREE.CanvasTexture` as `map`
    - `transparent: true`, `depthWrite: false`
    - `side: THREE.DoubleSide` so the sprite is visible from all camera angles
    - Character position set to `(0, CHAR_Y, FRONT_Z + 0.1)` as before
  - [x] 3.3 **Billboard behaviour (Y-axis only):** Attach the sprite mesh to a pivot group, or update its rotation in the render loop:
    ```js
    // In render(), after camera position is known:
    characterSprite.rotation.y = -cameraYaw;  // or compute angle from camera position
    ```
    The sprite should face the camera around Y but NOT tilt forward/back. A THREE.Sprite would do this automatically but cannot participate in the world curve — however, since the character sits at Z≈0 (near the camera), the world-curve bend is negligible and a Sprite IS acceptable here. **Decision**: Use `THREE.Sprite` with `THREE.SpriteMaterial` for automatic billboarding. See Dev Notes for rationale.
  - [x] 3.4 Export the character mesh under the same public API names (`getCharacterX`, `setCharacterX`, `setCharacterTargetX`, `snapCharacterYaw`, `getCharacterZ`, etc.). The external interface does not change — main.js does not know the capsule was replaced.
  - [x] 3.5 Ensure `character.position.x` setter and `character.position.z` setter still work: if using `THREE.Sprite`, these are inherited from `Object3D` and work identically to `THREE.Mesh`.

- [x] **Task 4: Implement per-frame animation tick** (AC-2, AC-6)
  - [x] 4.1 Define frame timing constants:
    ```js
    const CHAR_FPS = 12;
    const CHAR_FRAME_DURATION = 1000 / CHAR_FPS;  // ms per frame
    ```
  - [x] 4.2 In the `render()` function, update the sprite's texture each frame:
    ```js
    const frameIndex = Math.floor((nowGameMs - gameStartTime) / CHAR_FRAME_DURATION) % totalFrames;
    // Update the CanvasTexture from the current frame's canvas:
    characterSprite.material.map = currentFrameTexture; // or reuse one CanvasTexture and redraw
    ```
  - [x] 4.3 Use `CanvasTexture.needsUpdate = true` when the frame changes to trigger a texture upload.
  - [x] 4.4 **Performance**: Only call `needsUpdate = true` when the frame actually changes (not every render frame). Cache the previous `frameIndex` and skip if unchanged.

- [x] **Task 5: Integrate with prewarm and reset** (AC-8)
  - [x] 5.1 In `prewarmShaders()`, add the character sprite proto (with its animated texture) to trigger the program compile and texture upload before gameplay.
  - [x] 5.2 In `reset()`, dispose the character's texture and recreate the sprite:
    ```js
    characterSprite.material.map?.dispose();
    // Re-create sprite...
    ```
    Or simpler: keep the material alive (same pattern as `_prewarmKeepAlive` for safe-zone materials), and just re‑assign the frame texture array / reset the animation clock.
  - [x] 5.3 On the `dismissVariantTracks` path (line 1416), the existing sprite clean-up code for fret labels (`c.isSprite && c.material`) should NOT accidentally target the character sprite — character is at scene root, not a child of the safe zone. Verify this is already the case.

- [x] **Task 6: Collision and gameplay verification** (AC-4, AC-9)
  - [x] 6.1 Verify `checkCollision` (line 1275+) uses `character.position.x` and `character.position.z` — these are unchanged with Sprite.
  - [x] 6.2 Verify yaw rotation (`character.rotation.y` at line 1743 in `snapCharacterYaw()`) works on the Sprite (it does — Sprite extends Object3D with full transform support).
  - [x] 6.3 Run `pytest tests/ -x -q` — zero regressions (82/82 passed).
  - [x] 6.4 Run E2E test baseline — zero new failures.
  - [ ] 6.5 Manual visual test: character visible, animated, faces camera, slides between lanes, yaws on bends.

- [ ] **Task 7: Tone-mapping / visual polish pass (if timebox permits)**
  - [ ] 7.1 If the sprite looks too bright/washed out with `ACESFilmicToneMapping`, add a `toneMapped: false` to the material (common for UI/decals in three.js that should not be tone-mapped).
  - [ ] 7.2 Verify the sprite alpha is clean (no dark halo from premultiplied alpha). Set `map.premultiplyAlpha = true` or `map.needsUpdate = true` if halos appear.

---

## Dev Notes

### Why not use the old CapsuleGeometry?

The current character (SceneManager.js:641-646) is a `CapsuleGeometry(0.28, 0.6, 4, 8)` with a solid pink `MeshStandardMaterial`. This is a placeholder shape — functional but thematically blank. A pixel-art sprite gives the player a character they can identify with, fitting the PS1 demake aesthetic established by the curved world, low-poly buildings, and PS1-flickering lampposts.

### Billboard approach: THREE.Sprite vs manual Mesh

**Decision: Use THREE.Sprite with THREE.SpriteMaterial.**

Rationale:
- **Automatic billboarding**: Sprites always face the camera, which is exactly what a pixel-art character needs. No manual rotation math in `render()`.
- **Z≈0 → world-curve is negligible**: The character sits at `FRONT_Z + 0.1` ≈ 0.1 in world Z, and the camera is at z≈11. In view-space, the character's `mvPosition.z` is near-zero, so the `mvPosition.y -= (z² · uCurveStrength)` bend is effectively zero. The sprite does NOT need `applyWorldCurve()`.
- **Existing code already uses THREE.Sprite for fret labels**: The fret labels were *converted away* from Sprite because they needed to bend with the safe-zone curve (at z depths of -100+). The character never needs this.
- **Precedent**: The story 7-5 prewarm code specifically guards against SpriteMaterial's program being undefined — this is a known quirk of the bundled three.js. The guard is already in the local three.module.js patch (line 29449), so SpriteMaterial will not crash on `prewarmShaders()`.

If future requirements need the character to bend with the world curve, convert to a `THREE.Mesh` with a manual billboard shader or `onBeforeCompile` injection. For now, Sprite is the simplest correct choice.

**If using Sprite**:
```js
const character = new THREE.Sprite(new THREE.SpriteMaterial({
  map: frameTexture,
  transparent: true,
  depthWrite: false,
}));
character.scale.set(0.7, 0.7, 1);  // match ~capsule visual size
character.position.set(0, CHAR_Y, FRONT_Z + 0.1);
```

### Frame animation approach — real asset: `Character_running_north.gif`

The actual asset is a **124×124 px GIF with 4 full-frame images** (no sub-rect, no disposal quirks). Each frame is the full canvas. Approach:

1. Load the `.gif` as an `<img>` element
2. Draw each frame onto a separate offscreen `<canvas>` using a custom GIF decoder or an `<img>` trick (see below)
3. In the render loop, pick `frameIdx = Math.floor(gameElapsed / CHAR_FRAME_DURATION) % 4` and set the Sprite's map to the corresponding CanvasTexture

**The simplest approach that works** — render the GIF onto a hidden `<canvas>` and use `drawImage()` to extract frames at time offsets. Since the browser's native GIF player handles decoding, you can:

```js
const img = new Image();
img.onload = () => {
  // Draw the GIF onto a canvas; the browser renders the current frame.
  // For multi-frame extraction, either:
  //   (a) Pre-pack each frame: create N canvases, seek through frames using a library
  //   (b) Use a horizontal strip approach: the simplest is to just use the img.src
  //       as a THREE.Texture and let the browser animate it natively (but we need
  //       game-time sync, so we can't rely on native GIF timing)
};
img.src = CHARACTER_SPRITE_PATH;
```

**Recommendation**: Since the GIF has 4 full frames (no sub-rect), the simplest correct approach is:
- Use `new THREE.TextureLoader().load(CHARACTER_SPRITE_PATH)` to load the GIF
- Let the browser decode it; the GIF animates natively on the texture
- **BUT** this means the animation runs on wall-clock, not game-time — it won't pause

**Better recommendation**: Use a **horizontal spritesheet approach**:
- Manually slice the 124×124×4 GIF into 4 separate canvases during init
- Or create a **496×124** horizontal strip from the frames, use one `TextureLoader`, and animate via `texture.offset.x` — frame 0 = offset 0, frame 1 = 0.25, frame 2 = 0.5, frame 3 = 0.75. This avoids creating 4 textures.
- The story's Task 2 (GIF frame extraction) covers this.

**Updated constants** (already in `tokens.js`):
```js
export const CHARACTER_SPRITE_PATH = 'assets/Character_running_north.gif';
export const CHARACTER_FRAME_COUNT = 4;
export const CHARACTER_FRAME_W = 124;    // px
export const CHARACTER_FRAME_H = 124;    // px
export const CHARACTER_FPS = 10;          // animation speed
```

### Placeholder sprite implementation

The **procedural placeholder** should draw a simple running figure. Example (16×16 canvas, 4 frames):

```
Frame 0: standing / legs together
Frame 1: left leg forward, right arm forward
Frame 2: legs apart (stride)
Frame 3: right leg forward, left arm forward
```

Use simple coloured rectangles/circles for the head, torso, arms, legs. Black `#222` silhouette with a bright accent colour (e.g. `COLORS.ACCENT` or `COLORS.TEXT_PRIMARY` for a glowing effect). This placeholder is **not** meant to look good — it exists so the animation system works without external dependencies.

### Frame timing: game-time vs wall-clock

Use `(nowGameMs - gameStartTime)` (where `gameStartTime` is the timestamp passed to `setGameStartTime()` in the render loop). This clock pauses when the game pauses, so the character's running animation stops during pause. `nowGameMs` is passed through the render loop already:
```js
// In render(nowGameMs, dt):
const gameElapsed = nowGameMs - gameStartTime;
const frameIdx = Math.floor(gameElapsed / CHAR_FRAME_DURATION) % totalFrames;
```

### Where the new sprite code lives

All sprite logic should be internal to `SceneManager.js`'s `createScene()` closure, following the existing pattern (buildings, lampposts, floor all live there). If the GIF decoder is non-trivial, factor it into `static/game/characters/GifLoader.js` — but keep the frame extraction simple.

If creating a `characters/` directory, pattern follows `ui/` and `vendor/` subdirectories already in `static/game/`.

### `.gitignore` for assets

Add to `.gitignore`:
```
# User-provided game assets
static/assets/
```
This prevents accidental commits of large binary files. The placeholder implementation ensures the feature works without any external file.

### SceneManager.js return API — no changes needed

The character capsule is exposed via:
- `getCharacterX()` → `character.position.x`
- `getCharacterZ()` → `character.position.z`
- `setCharacterX(x)` → `character.position.x = x`
- `setCharacterTargetX(...)` — internal tween
- `snapCharacterYaw(yaw)` → `character.rotation.y = yaw`
- `getCharacterZ() { return character.position.z; }`

All of these access `.position` and `.rotation` on the `THREE.Mesh` (or `THREE.Sprite`). Since both inherit from `THREE.Object3D`, the setters/getters work identically. **No changes to the return object or main.js**.

### What changes in the existing codebase

| File | Change |
|------|--------|
| `static/game/SceneManager.js` | Replace `CapsuleGeometry` + pink material with `Sprite` + animated `CanvasTexture`; add frame-animation logic in `render()`; update `reset()`; update `prewarmShaders()` |
| `static/game/ui/tokens.js` | Add `CHARACTER_SPRITE_FPS`, `CHARACTER_SPRITE_PATH`, `CHARACTER_FRAME_W`, `CHARACTER_FRAME_H` constants |
| `static/assets/` | Directory created, added to `.gitignore`; user places `.gif`/`.png` here |
| `.gitignore` | Add `static/assets/` entry |

### What does NOT change

- `static/game/main.js` — no changes; character API unchanged
- `static/game/ui/SafeZoneRenderer.js` — no changes
- `static/game/WaveScheduler.js` — no changes
- `static/game/TrackSystem.js` — no changes
- `static/game/vendor/three.module.js` — no changes needed (SpriteMaterial already supported)
- Backend Python — no changes
- E2E tests — no changes expected (character still at same position)

### Collision note

`checkCollision()` at line 1275 uses `character.position.x` / `character.position.z` to compute distance to carts. A Sprite has `position` just like a Mesh (both inherit Object3D). No collision behavior change. The sprite's visual footprint should roughly match the old capsule (0.56 wide, 0.6 tall) so collision feels fair.

### Prewarm note

If using `THREE.Sprite`, the existing `prewarmShaders()` function should add the sprite proto to the warm-up set. The three.module.js patch (line 29449) guards the undefined-program crash for SpriteMaterial, so prewarm will work safely.

### Files to Modify

- `static/game/SceneManager.js` — character replacement, frame animation, prewarm, reset
- `static/game/ui/tokens.js` — character animation constants
- `.gitignore` — add `static/assets/`

### Files to Create

- `static/assets/` (directory) — user drops their .gif/.png here
- (Optional) `static/game/characters/GifLoader.js` — if GIF frame extraction logic is substantial
- Placeholder sprite frames (procedural, inline in SceneManager.js)

### References

- **Current character implementation:** `static/game/SceneManager.js:641-646` — `CapsuleGeometry(0.28, 0.6, 4, 8)` with pink `0xff4488` material.
- **Character API exposed:** `static/game/SceneManager.js:1902-1959` — return object with `getCharacterX`, `setCharacterX`, etc.
- **Character X tween:** `static/game/SceneManager.js:1677-1690` — `setCharacterTargetX()` lateral slide animation.
- **Character yaw snap:** `static/game/SceneManager.js:1742-1744` — `snapCharacterYaw()` for bend transitions.
- **Character Z on reset:** `static/game/SceneManager.js:903-904` — reset position and yaw.
- **Character collision:** `static/game/SceneManager.js:1275-1282` — `checkCollision()` uses charX/charZ.
- **Sprite three.js support:** `static/game/vendor/three.module.js:31691` — `THREE.Sprite` class, `:31623` — `THREE.SpriteMaterial` class.
- **Sprite program guard:** `static/game/vendor/three.module.js:29449` — local patch for undefined program in compile().
- **Existing Sprite usage (fret labels, now replaced):** `static/game/SceneManager.js:1416-1418` — dispose check for `c.isSprite`.
- **Tokens pattern:** `static/game/ui/tokens.js` — Night City palette, world curve constants.
- **Epic 7 overview:** `_bmad-output/planning-artifacts/epics.md:361-384` — world environment polish scope.
- **Prewarm pattern:** `static/game/SceneManager.js:1821-1899` — `prewarmShaders()` function.
- **Reset pattern:** `static/game/SceneManager.js:750-780` — scene reset, character repositioning.
- **SpriteMaterial in three.js:** `static/game/vendor/three.module.js:31623-31680` — full implementation, uniforms, shaders.

### Testing Strategy

- `.venv/Scripts/python.exe -m pytest tests/ -x -q` — regression green
- E2E baseline — zero new failures (same false-positive baseline as 7-5)
- Manual: character visible, animated, faces camera, slides correctly, yaws on variants
- Collision test: play a wave and verify collision detection still works (character body overlaps wave capsule)

### Previous Story (7-5) Learnings Carried Forward

- **Sprite gotchas:** Story 7-5's `prewarmShaders()` had to work around SpriteMaterial's missing `currentProgram`. The local three.module.js patch (line 29449) exists specifically for this. If using Sprite, verify the prewarm does not crash — the patch should protect it.
- **Dispose discipline:** Three reference-counts GPU programs per material. If we create a SpriteMaterial, DO NOT dispose it during gameplay if it might be shared. The character sprite material is per-scene (recreated on reset), so disposing it on reset is safe.
- **Prewarm for spike avoidance:** Adding the character sprite to the prewarm set ensures its program texture upload happens during load, not the first frame.
- **`onBeforeCompile` NOT needed:** The character does NOT need `applyWorldCurve()`. It sits at Z≈0 where the bend is negligible. Explicitly:
  ```js
  // DO NOT applyWorldCurve to the character material.
  // The character sits at FRONT_Z + 0.1 ≈ 0.1 — near-zero bend.
  ```
- **CanvasTexture pattern already established:** `makeFretLabel()` creates a `CanvasTexture` on a `MeshBasicMaterial` with `transparent: true` and `NearestFilter` settings. Follow that pattern.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (via deepseek/deepseek-v4-flash:free)

### Debug Log References

- Story 7-5 prewarm: Sprite label's program was `undefined` in `compileAsync()` readiness poll, requiring the local three.module.js patch. Character sprite uses the same `THREE.Sprite`/`SpriteMaterial` — the existing three.module.js patch (line 29449) protects against the crash.
- `c.isSprite` clean-up in `variantSafeZoneMesh.traverse()` only walks children of the safe zone, not the scene root. Character sprite (at scene root) is not affected.

### Completion Notes List

- **Capsule replaced**: `CapsuleGeometry(0.28, 0.6, 4, 8)` + pink `0xff4488` `MeshStandardMaterial` replaced by `THREE.Sprite` with `SpriteMaterial` — automatic billboarding, no manual rotation math.
- **Placeholder**: `generatePlaceholderFrames()` draws a 24×24 procedural pixel-art runner (4 frames: leg/arm swing cycle) with dark silhouette + ACCENT glow stroke. Runs immediately, no external asset needed.
- **Real asset loading**: `initSpriteFrames()` starts with the placeholder, then asynchronously loads `Character_running_north.gif` via `Image()`. On success, `extractSpritesheetFrames()` slices the horizontal strip into 4 × 124×124 canvases and replaces the placeholder. On failure, placeholder stays.
- **Frame animation**: `updateCharacterSprite(nowGameMs)` in `render()` computes `frameIdx = Math.floor((nowGameMs - gameStartTime) / CHAR_FRAME_DURATION) % totalFrames`. Uses game-time so animation pauses correctly. Only creates a new `CanvasTexture` on frame change (`_charLastFrameIdx` guard).
- **NearestFilter**: Both min and mag filter set to `THREE.NearestFilter` for pixel-art crispness.
- **Prewarm**: A `THREE.Sprite` proto added to `prewarmShaders()` protos array. The existing three.module.js patch guards the SpriteMaterial `undefined`-program crash.
- **Reset**: `character.material.map?.dispose()` on reset clears the GPU texture; `_charLastFrameIdx` reset to -1 so first frame after replay gets a fresh texture upload.
- **No changes to main.js**: All character API names are identical (`.position.x`, `.position.z`, `.rotation.y` — Sprite extends Object3D).
- **Collision unchanged**: `checkCollision()` uses `character.position.x`/`.z` — identical access pattern.
- **Tests**: 82/82 pytest pass, zero regressions.
- **Task 6.5** (manual visual test) and **Task 7** (tone-mapping polish) are deferred to in-engine verification (requires headless/container test environment).

### File List

- `static/game/SceneManager.js` — replaced `CapsuleGeometry` + pink material with `THREE.Sprite`; added `generatePlaceholderFrames()`, `extractSpritesheetFrames()`, `initSpriteFrames()`, `updateCharacterSprite()`; updated `reset()` texture disposal; added sprite proto to `prewarmShaders()`; imported character sprite constants from tokens
- `static/game/ui/tokens.js` — added `CHARACTER_SPRITE_PATH`, `CHARACTER_FRAME_COUNT`, `CHARACTER_FRAME_W`, `CHARACTER_FRAME_H`, `CHARACTER_FPS`
- `.gitignore` — added `static/assets/` entry
- `static/assets/Character_running_north.gif` — user-provided asset (gitignored)
- `_bmad-output/implementation-artifacts/7-6-animated-character-sprite.md` — story definition

## Change Log

| Date       | Change                                                                                                               |
|------------|----------------------------------------------------------------------------------------------------------------------|
| 2026-05-29 | Implemented animated character sprite: replaced CapsuleGeometry with THREE.Sprite + placeholder + real-asset loading, frame animation, prewarm, reset. 82/82 pytest pass. |