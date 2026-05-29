# Story 9.12: Slide Obstacle for Consecutive Same-Fret Notes

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-12
**Story Key:** 9-12-slide-obstacle-for-consecutive-same-fret-notes
**Depends on:** 9-11

---

## Context

When a scale has two consecutive notes on the same fret (e.g. Hirajoshi: repeated pitch across the apex), both waves share the same `safe_track`. The player who reached the correct lane for note N is **already passively correct** for note N+1 — there is no incentive to actually play the second note.

Fix: when consecutive waves share the same `safe_track`, tag the second wave with `requires_slide: true` and spawn a **slide barrier** — a low-hanging horizontal obstacle (construction-site barrier aesthetic) spanning the full track width — at the same Z position as that wave. The character must be in **slide mode** when passing through it.

Slide mode is triggered automatically by note acceptance (NoteAcceptor fires → `scene.enterSlide(nowMs)`). If the player plays the note → character powerslides under the barrier safely. If the player does not play the note → character stays upright → collides with barrier → game over.

The asset `static/assets/Character_powerslide_north.gif` (already committed) provides the slide animation.

---

## User Story

As a **player**,
I want the game to force me to actively play every note in the sequence even when two consecutive notes share the same fret,
so that I cannot coast through repeated-fret passages without actually playing them.

---

## Acceptance Criteria

**AC-1 — Barrier spawns on same-fret repeat:**
Given a wave sequence where `wave[N].safe_track === wave[N+1].safe_track`,
when wave N+1 is constructed by `WaveScheduler._buildWave`,
then `wave[N+1].requires_slide === true`.

**AC-2 — Barrier does NOT spawn when frets differ:**
Given consecutive waves with different `safe_track` values,
then `requires_slide` is absent/falsy on both waves.

**AC-3 — Barrier visual renders in SceneManager:**
Given a wave with `requires_slide: true`,
when `setWaves()` adds this wave to the scene,
then a slide-barrier mesh (wide horizontal beam, full track width, height ≈ 1.2 world units) is added to the wave group in addition to the danger carts.

**AC-4 — Character enters slide state on note acceptance:**
Given a wave with `requires_slide: true` is in-flight,
when NoteAcceptor successfully accepts a note,
then `scene.enterSlide(nowMs)` is called and the character sprite switches to the powerslide frames for the duration of the slide state (~400 ms).

**AC-5 — Powerslide GIF used during slide state:**
Given `Character_powerslide_north.gif` is accessible at the asset path,
when the character is in slide state,
then the powerslide frames replace the running frames for the slide duration; on expiry the running animation resumes.

**AC-6 — Barrier collision triggers game over when not sliding:**
Given wave N+1 has `requires_slide: true` and the character is on the safe lane (no cart collision),
when the character passes through the wave Z-zone while NOT in slide state,
then `checkCollision()` returns `true`.

**AC-7 — No collision when character is sliding:**
Given the character is in slide state (entered via note acceptance),
when `checkCollision()` runs against the same barrier wave,
then it returns `false` (character cleared the barrier).

**AC-8 — No regression on waves without requires_slide:**
Existing waves without `requires_slide` continue to behave exactly as before; all existing unit and E2E tests pass.

---

## Technical Design

### 1. `WaveScheduler.js` — tag consecutive same-fret waves

In `_buildWave`, compare the current note's fret to the **previous wave's** `safe_track`. Add a `_prevSafeTrack` instance variable (initialised to `null`, reset in `reset()`).

```js
// in _buildWave, after computing safeTrack:
const requiresSlide = (this._prevSafeTrack !== null && safeTrack === this._prevSafeTrack);
this._prevSafeTrack = safeTrack;
const wave = {
  // ... existing fields ...
  requires_slide: requiresSlide,
};
```

Reset `_prevSafeTrack = null` in both `reset()` and `setRun()`.

### 2. `static/game/ui/tokens.js` — add powerslide sprite constant

```js
export const CHARACTER_POWERSLIDE_SPRITE_PATH =
  '/plugins/subway-scaler/static/assets/Character_powerslide_north.gif';
```

### 3. `SceneManager.js` — slide barrier mesh + slide state

**3a. Barrier mesh factory** (add near `makeCart`):
```js
function makeSlideBarrier() {
  const g = new THREE.Group();
  // Wide beam: spans full visible track width (~9 world units for max 8 lanes)
  const BARRIER_W = 10;
  const BARRIER_H = 0.25;
  const BARRIER_D = 0.5;
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(BARRIER_W, BARRIER_H, BARRIER_D),
    applyWorldCurve(new THREE.MeshStandardMaterial({
      color: 0xFFAA00,  // construction orange
      roughness: 0.7,
      metalness: 0.1,
      dithering: true,
    }))
  );
  beam.position.y = 1.2;   // height the standing character would collide with
  g.add(beam);
  // Two vertical support posts at either end
  const postMat = applyWorldCurve(new THREE.MeshStandardMaterial({
    color: 0x333333, roughness: 0.8, dithering: true,
  }));
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), postMat);
    post.position.set(side * (BARRIER_W / 2 - 0.1), 0.6, 0);
    g.add(post);
  }
  return g;
}
```

**3b. Attach barrier in `setWaves()`** — inside the `if (!w)` block, after building the cart group:
```js
if (waveData.requires_slide) {
  const barrier = makeSlideBarrier();
  // No X offset needed — barrier spans full width; centre at world X=0 + _worldOffsetX
  barrier.position.x = _worldOffsetX;
  group.add(barrier);
}
```
Store `w.requiresSlide = waveData.requires_slide` on the wave record.

**3c. Slide state tracking** (module-level vars):
```js
let _isSliding = false;
let _slideUntilMs = 0;
const SLIDE_DURATION_MS = 400;
```

**3d. Powerslide sprite frames** — load alongside running frames. Add in `initSpriteFrames`:
```js
let _powerslideFrames = null;
let _powerslideTextures = null;

fetch(CHARACTER_POWERSLIDE_SPRITE_PATH)
  .then(res => { if (!res.ok) throw new Error(); return res.arrayBuffer(); })
  .then(buf => {
    const { frames } = parseGifFrames(buf);
    if (frames.length >= 1) {
      _powerslideFrames = frames;
      _powerslideTextures = _buildSpriteTextures(frames);
    }
  })
  .catch(() => {}); // graceful fallback — slide state will use running frame[0]
```

**3e. `enterSlide(nowMs)` exported function:**
```js
function enterSlide(nowMs) {
  _isSliding = true;
  _slideUntilMs = nowMs + SLIDE_DURATION_MS;
}
```

**3f. `updateCharacterSprite` — use powerslide textures when sliding:**
```js
// at top of updateCharacterSprite:
if (_isSliding) {
  if (nowMs >= _slideUntilMs) {
    _isSliding = false;
  } else if (_powerslideTextures?.length) {
    character.material.map = _powerslideTextures[0]; // static pose or cycle if multi-frame
    character.material.needsUpdate = true;
    return; // skip running animation
  }
}
```

**3g. `checkCollision` — barrier collision when not sliding:**
After the existing cart-collision check, add inside the Z-proximity block:
```js
if (w.requiresSlide && !_isSliding) {
  if (Math.abs(charX - safeX) <= 0.6) {
    // Character IS on the safe lane but not sliding — hits the barrier
    _lastCollisionDebug = { /* same pattern as cart collision */ charX, safeX, reason: 'barrier_no_slide' };
    return true;
  }
}
```

**3h. Export `enterSlide`** — add to the returned API object.

### 4. `NoteAcceptor.js` — call `enterSlide` on acceptance

`NoteAcceptor` receives `scene` as a dependency (it already calls `scene.moveToTrack`, `scene.setWaves` etc. via the injected `scene` reference). On a successful note accept result:

```js
if (acceptResult.accepted) {
  scene.enterSlide?.(performance.now());
  // ... existing post-accept logic
}
```

Use optional chaining (`?.`) so the call is a no-op in tests that don't inject the full scene mock.

---

## Files to Change

| File | Change |
|------|--------|
| `static/game/WaveScheduler.js` | Add `_prevSafeTrack` tracking; set `requires_slide` in `_buildWave`; reset in `reset()` and `setRun()` |
| `static/game/ui/tokens.js` | Add `CHARACTER_POWERSLIDE_SPRITE_PATH` export |
| `static/game/SceneManager.js` | `makeSlideBarrier()`, barrier spawn in `setWaves()`, slide state vars, `enterSlide()`, powerslide frame loading, `updateCharacterSprite` slide branch, `checkCollision` barrier check, export `enterSlide` |
| `static/game/NoteAcceptor.js` | Call `scene.enterSlide?.(nowMs)` on successful accept |

**No new files.** No backend changes required — `requires_slide` is computed entirely on the frontend from the wave sequence.

---

## Dev Notes

### What must NOT break
- Waves without `requires_slide` must continue working exactly as before — barrier code is gated on `waveData.requires_slide`.
- Existing `checkCollision` cart-collision path is untouched; barrier check is additive.
- `_prevSafeTrack` must reset on `setRun()` to avoid a stale carry-over from the previous scale pass falsely tagging the first note of a new run.
- The powerslide GIF is a single-frame (static pose) GIF; `parseGifFrames` will return one frame — use index `[0]` only. Do not assume multiple frames.
- `enterSlide` is called from `NoteAcceptor.js` which already has access to the `scene` ref. Do not add a new dependency or a new event channel.
- The barrier mesh uses `_worldOffsetX` for its X position (same as carts) so it stays centred after variant transitions.

### Collision geometry rationale
- Cart body height: `y = 0.45`, BoxGeometry H = 0.8 → top at `y ≈ 0.85`.
- Barrier beam: `y = 1.2` (centre), H = 0.25 → bottom at `y ≈ 1.075`.
- Standing character height: sprite scale 2.8, geometry height 1.0 → character top ≈ 2.8 world units. The beam is well within collision range.
- Sliding character: powerslide pose is crouched; no explicit Y-position change needed — collision is toggled by `_isSliding` flag rather than actual geometry intersection.

### Vitest unit test additions (required)
Add to `tests/unit/js/` (new file `WaveScheduler.requires_slide.test.js` or append to existing WaveScheduler tests):

1. **Two consecutive same-fret notes** → second wave has `requires_slide: true`.
2. **Two consecutive different-fret notes** → neither wave has `requires_slide: true`.
3. **Same-fret pair followed by different fret** → only the middle wave (index 1) has `requires_slide`.
4. **After `reset()`** — `_prevSafeTrack` cleared; first wave of new run never has `requires_slide: true` even if the previous run's last safe track matched.

---

## Tasks

- [x] 1. WaveScheduler: add `_prevSafeTrack` tracking and `requires_slide` field
  - [x] 1a. Add `_prevSafeTrack = null` to constructor
  - [x] 1b. Compute `requiresSlide` and set `this._prevSafeTrack` in `_buildWave`
  - [x] 1c. Emit `requires_slide` field on wave object
  - [x] 1d. Reset `_prevSafeTrack = null` in `reset()` and `resumeQueueing()`
- [x] 2. tokens.js: add `CHARACTER_POWERSLIDE_SPRITE_PATH` constant
- [x] 3. SceneManager: slide barrier mesh, slide state, powerslide frames, collision, export
  - [x] 3a. Import `CHARACTER_POWERSLIDE_SPRITE_PATH`
  - [x] 3b. Add slide state vars and `enterSlide()` function
  - [x] 3c. Add `makeSlideBarrier()` factory
  - [x] 3d. Spawn barrier in `setWaves()` when `requires_slide: true`
  - [x] 3e. Load powerslide GIF frames in `initSpriteFrames`
  - [x] 3f. Use powerslide texture in `updateCharacterSprite` during slide state
  - [x] 3g. Add barrier collision check in `checkCollision`
  - [x] 3h. Export `enterSlide` in return object
- [x] 4. NoteAcceptor: call `scene.enterSlide?.(performance.now())` on accepted note
- [x] 5. Tests: add `WaveScheduler.requires_slide.test.js` with 4 required test cases

## Dev Agent Record

### Completion Notes

Implemented slide obstacle system for consecutive same-fret notes (Story 9-12).

- **WaveScheduler.js**: Added `_prevSafeTrack` instance var (null in constructor, reset in `reset()` and `resumeQueueing()`). In `_buildWave`, computes `requiresSlide = (_prevSafeTrack !== null && safeTrack === _prevSafeTrack)`, updates `_prevSafeTrack`, and emits `requires_slide` field on wave objects.
- **tokens.js**: Added `CHARACTER_POWERSLIDE_SPRITE_PATH` export pointing to the committed GIF asset.
- **SceneManager.js**: Added `_isSliding`/`_slideUntilMs`/`SLIDE_DURATION_MS` slide state vars; `enterSlide(nowMs)` sets the slide state; `makeSlideBarrier()` builds orange construction-beam obstacle (full track width, y=1.2); `setWaves()` spawns barrier when `waveData.requires_slide`; `initSpriteFrames` loads powerslide GIF frames into `_powerslideTextures`; `updateCharacterSprite` switches to powerslide texture during active slide and reverts on expiry; `checkCollision` adds barrier check (character on safe lane but not sliding → collision); `enterSlide` exported in API.
- **NoteAcceptor.js**: Calls `this.scene.enterSlide?.(performance.now())` immediately on `result === 'accepted'`, before backend sync.
- **Tests**: 4 new Vitest unit tests in `WaveScheduler.requires_slide.test.js` covering: same-fret consecutive (AC-1), different-fret (AC-2), mixed sequence (AC-1/AC-2), and reset clears state (AC-8).

All 4 new tests pass. 19 pre-existing test failures (SRGBColorSpace mock) unchanged — no regressions.

## File List

- `static/game/WaveScheduler.js` — modified
- `static/game/ui/tokens.js` — modified
- `static/game/SceneManager.js` — modified
- `static/game/NoteAcceptor.js` — modified
- `tests/unit/js/WaveScheduler.requires_slide.test.js` — new

## Change Log

- 2026-05-30: Story 9-12 implemented — slide obstacle for consecutive same-fret notes

## Out of Scope

- Responsive slide input (no keyboard/touch "duck" button) — slide is entirely audio-driven (playing the note = sliding).
- Visual slide animation beyond static powerslide frame (single-frame GIF asset provided).
- Backend changes — `requires_slide` is a pure frontend concern.
- Obstacle variety (sign vs. barrier) — construction-orange beam aesthetic is sufficient for this story.
