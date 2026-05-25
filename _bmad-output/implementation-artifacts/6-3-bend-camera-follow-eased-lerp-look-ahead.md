# Story 6.3: 45° Bend Camera Follow (Eased Lerp + Look-Ahead)

**Status:** review

**Epic:** 6 — Variant Transition Cinematic & Handoff
**Story ID:** 6-3
**Story Key:** 6-3-bend-camera-follow-eased-lerp-look-ahead
**Depends on:** 6-2 (character lateral traversal onto variant track)

---

## Context

### What 6-2 established

After 6-2, the `accepted → riding` phase triggers character lateral traversal onto the variant track's incoming diagonal. Character X position lerps from main lane to variantX, bound to the bend's Z-progress. The variant propose piece survives accept and continues scrolling as the ride piece.

### What 6-3 does

During the `riding` phase, the camera follows the character through the 45° bend turn with eased lerp and a look-ahead offset along the track tangent. Once the character reaches the straight variant section (bend midpoint passed), the camera eases back to forward-facing orientation. This replaces the static camera that currently stays centered on the main track regardless of what the character is doing.

### Current camera

`SceneManager.render()` (line 522-527):
```js
currentCameraX += (targetCameraX - currentCameraX) * 0.1;
camera.position.x = currentCameraX;
camera.position.y = CAMERA_DISTANCE * Math.sin(rad);
camera.position.z = CAMERA_DISTANCE * Math.cos(rad) + camBase.lookAt[2];
camera.lookAt(currentCameraX, 0, camBase.lookAt[2]);
```
Static X follow only. No rotation during bends. Camera always faces forward (+Z direction).

### What the cinematic needs

During the `riding` phase, the camera:
1. Pans X to follow the character onto the variant lane
2. Rotates slightly to look down the track tangent during the bend
3. Restores forward-facing orientation once the character is on the straight section

---

## User Story

As a player accepting a variant track switch,
I want the camera to smoothly follow my character through the 45° railway bend with a natural look-ahead,
so that the transition feels cinematic and I can see the track ahead of me during the turn.

---

## Acceptance Criteria

**AC-1 — Camera X follows character during riding phase:**
When transition phase is `riding`, `targetCameraX` tracks the character's current X position (already set by 6-2's Z-bound lerp). The existing eased lerp (`currentCameraX += (targetCameraX - currentCameraX) * 0.1`) naturally smooths this. No change to the lerp formula — just set `targetCameraX = character.position.x` during riding phase.

**AC-2 — Camera yaw rotation during bend:**
During the riding phase, the camera applies a temporary yaw rotation proportional to the bend angle at the character's current position on the incoming diagonal. The yaw angle lerps from 0° to `CAMERA_BEND_YAW_MAX` (~12°) as the character traverses the diagonal, then back to 0° after the bend midpoint:
```js
if (phase === 'riding') {
  const progress = _charTraversalProgress; // 0→1 across the diagonal
  // Yaw peaks at 50% progress (mid-diagonal), symmetric ease-out
  const yaw = CAMERA_BEND_YAW_MAX * Math.sin(progress * Math.PI);
  camera.rotation.y = yaw * (variantInfo.side === 'RIGHT' ? 1 : -1);
}
```
The yaw direction matches the bend: RIGHT variant → camera pans right (+yaw), LEFT variant → camera pans left (−yaw).

**AC-3 — Camera look-ahead offset during bend:**
During the riding phase, the camera's lookAt target shifts forward along the track tangent:
```js
const lookAheadZ = camBase.lookAt[2] + CAMERA_LOOK_AHEAD_Z; // ~5 units ahead
camera.lookAt(currentCameraX + yaw * 2, 0, lookAheadZ);
```
This ensures the player sees the approaching straight section, not just the immediate ground.

**AC-4 — Camera resets on `breather` phase entry:**
When phase transitions from `riding` to `breather`, the camera yaw is lerped back to 0 over ~500ms using the same eased lerp pattern. `targetCameraX` resets to the center of the new variant lane (or 0 if the variant lane is at the edge — maintain centered-on-track convention). After the reset, camera behavior returns to pre-6-3 static mode.

**AC-5 — No camera changes outside riding phase:**
The camera behaves identically to pre-6-3 during `idle`, `playing`, `paused`, `game_over`, `proposed`, `accepted`, `breather`, `promoting`, and `active` phases. Only the `riding` phase activates bend camera behavior.

**AC-6 — Camera constants are tunable:**
Define at module level:
```js
const CAMERA_BEND_YAW_MAX = 12 * Math.PI / 180; // 12° max yaw during bend
const CAMERA_LOOK_AHEAD_Z = 5; // units ahead of default lookAt during bend
const CAMERA_RESET_DURATION_MS = 500; // yaw → 0 lerp duration after riding
```

**AC-7 — E2E and unit parity:**
- Playwright chromium 74/74 pass
- pytest 71/71 pass
- Smoke E2E: inject audio for accept, observe `window.__gameState.variant.transitionPhase === 'riding'` → camera X follows character to variant lane, yaw non-zero during bend, yaw = 0 after phase hits `breather`

---

## Tasks / Subtasks

- [x] **Task 1 — Expose character position and traversal progress (AC-1)**
  - Add `getCharacterX()` to SceneManager return API (returns `character.position.x`).
  - Add `getTraversalProgress()` — returns 0→1 progress of the Z-bound character lerp, or null if no traversal active.
  - These are read-only getters for main.js to use in the riding phase handler.

- [x] **Task 2 — Add riding-phase camera mode to render() (AC-2, AC-3)**
  - Add `setCameraMode(mode)` where mode is `'default' | 'riding'`:
    ```js
    let _cameraMode = 'default';
    let _cameraResetStartMs = 0;
    let _cameraResetStartYaw = 0;
    ```
  - In `render()`, after computing `currentCameraX`, branch on `_cameraMode`:
    - `'default'`: current behavior (no yaw, standard lookAt).
    - `'riding'`: apply yaw per AC-2, look-ahead per AC-3.
  - Reset `_cameraMode = 'default'` in `reset()`.

- [x] **Task 3 — Implement camera reset transition (AC-4)**
  - When `setCameraMode('default')` is called while camera is in `'riding'` mode:
    - Record `_cameraResetStartMs = performance.now()` and `_cameraResetStartYaw = camera.rotation.y`
    - Over the next `CAMERA_RESET_DURATION_MS`, lerp yaw from start to 0:
      ```js
      const t = Math.min(1, (nowMs - _cameraResetStartMs) / CAMERA_RESET_DURATION_MS);
      const e = 1 - (1 - t) * (1 - t); // ease-out quad
      camera.rotation.y = _cameraResetStartYaw * (1 - e);
      ```
    - Reset `_cameraMode` to `'default'` when t ≥ 1.

- [x] **Task 4 — Wire phase listeners in main.js (AC-1, AC-4, AC-5)**
  - Register `setTransitionPhaseListener` for `riding → *`:
    - On entry to `riding`: `scene.setCameraMode('riding')`
    - On exit from `riding` (any next phase): `scene.setCameraMode('default')`
  - During riding phase, each RAF frame: `scene.setTargetCameraX(scene.getCharacterX())` to keep the camera tracking the character.

- [x] **Task 5 — Full test suite parity (AC-7)**
  - `.venv/Scripts/python.exe -m pytest` → 71/71 pass
  - `npx playwright test` (chromium) — E2E requires running Docker stack (deferred to 6-7 full coverage)
  - Unit + Python tests validated

- [x] **Task 6 — Unit tests for camera interpolation (AC-7)**
  - Extend `tests/unit/js/SceneManager.test.js`:
    - **Camera easing curve test:** riding mode with mid-progress traversal → yaw follows CAMERA_BEND_YAW_MAX * sin curve (asserted > 0.1 and ≤ max)
    - **Camera reset transition test:** setCameraMode('default') after riding → yaw lerps to 0 after CAMERA_RESET_DURATION_MS via ease-out quad
    - **Look-at target test:** riding mode lookAt Z > 0 (shifted from default -2 by CAMERA_LOOK_AHEAD_Z=5)
    - **Left variant:** yaw negated (< -0.1)
    - **Default mode:** yaw = 0

---

## Dev Notes

### Files to modify

- `static/game/SceneManager.js` — camera mode state, riding-phase yaw + look-ahead, camera reset transition, `setCameraMode()`, `getCharacterX()`, `getTraversalProgress()`
- `static/game/main.js` — riding phase listener for camera mode

### Files to read (do not modify)

- `static/game/SceneManager.js` — camera constants (CAMERA_PITCH, CAMERA_DISTANCE, camBase), current render() camera block, existing `currentCameraX`/`targetCameraX` pattern
- `static/game/GameState.js` — `TRANSITION_PHASES` enum (needed for phase listener wiring in main.js)
- `static/game/main.js` — transition phase listener wiring (from 6-1), `registerPhaseCleanup` (from 6-1)
- `_bmad-output/implementation-artifacts/6-2-character-lateral-traversal-onto-variant-track.md` — character traversal mechanics

### Camera E2E testing approach

Camera E2E tests in 6-7 use `page.evaluate()` to read camera state. This is inherently fragile because internal variable renames break tests even if the visual result is correct. Mitigations:
1. **Tolerance windows on all numeric assertions** — use `expect(yaw).toBeGreaterThan(0.01)` not `expect(yaw).toBe(0.785)`. CI machines have different frame timings and GPU interpolation may vary by ±0.05 rad.
2. **Wait for animation completion, not wall-clock time** — use `page.waitForFunction()` polling `window.__gameState.variant.transitionPhase === 'breather'` rather than `page.waitForTimeout(8000)`. The 8-12s transition varies by 2-3s across CI runs.
3. **Visual regression as secondary signal** — use Playwright's `toHaveScreenshot()` on a key transition frame (character at bend midpoint, with camera yaw active). This provides a behavioral test that doesn't care about internal state variable names. It's slower but is a hedge against `page.evaluate()` fragility.

These mitigations are documented for the 6-7 implementer — the camera E2E specs in 6-7 AC-2 must apply them.

SceneManager uses a closure-based pattern (not the `SceneManager` class at the bottom of the file). The `render` function inside `createScene()` owns camera state directly. All 6-3 camera changes go inside the `createScene()` closure.

### Why a separate `_cameraMode` state

The camera behavior is phase-dependent but shouldn't import phase constants. Using a simple `'default' | 'riding'` string mode keeps SceneManager decoupled from GameState and the transition phase system. main.js is the integration layer that maps phases to camera modes.

### Yaw direction convention

Three.js yaw is rotation around Y axis. Positive yaw = camera pans right. RIGHT variant means the variant lane is to the right of the main track → camera should pan right (+yaw). LEFT variant → camera pans left (−yaw).

### Tuning note

CAMERA_BEND_YAW_MAX (12°) and CAMERA_LOOK_AHEAD_Z (5 units) are initial values. Tune in-engine after 6-4 breather is implemented to ensure the camera doesn't overshoot or feel jerky. The sine-based yaw curve (peak at mid-diagonal) gives a natural ease-in/ease-out without requiring a keyframe system.

### References

- Epic 6 spec — [Source: _bmad-output/planning-artifacts/epics.md#Epic 6]
- Story 6-2 — [Source: _bmad-output/implementation-artifacts/6-2-character-lateral-traversal-onto-variant-track.md]
- SceneManager camera block — [Source: static/game/SceneManager.js#L522-L530]
- Camera constants — [Source: static/game/SceneManager.js#L13-L15]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- SceneManager: added `getCharacterX()`, `getTraversalProgress()`, `setCameraMode()`, `setTargetCameraX()`, camera constants (CAMERA_BEND_YAW_MAX, CAMERA_LOOK_AHEAD_Z, CAMERA_RESET_DURATION_MS)
- SceneManager: render() camera block branches on `_cameraMode`: riding → yaw + look-ahead; reset transition → ease-out quad; default → yaw=0
- SceneManager: `setCameraMode('default')` from riding records reset start time/yaw for smooth ease-back
- SceneManager: `reset()` clears `_cameraMode`, `_cameraResetStartMs`, `_cameraResetStartYaw`
- main.js: riding listener calls `scene.setCameraMode('riding')`; `registerPhaseCleanup('riding')` calls `scene.setCameraMode('default')`
- main.js: RAF loop tracks camera to character X during riding phase via `scene.setTargetCameraX(scene.getCharacterX())`
- Unit tests: 224 pass (SceneManager camera suite: 5 new tests covering yaw curve, left variant, look-ahead, reset transition, default mode)
- Python tests: 71 pass
- Key debug: SPAWN_Z = -100 (not -80 as assumed), spawn_time_ms=-1450 needed for mid-progress (0.5) traversal geometry

### File List

- `static/game/SceneManager.js`
- `static/game/main.js`
- `tests/unit/js/SceneManager.test.js`
- `_bmad-output/implementation-artifacts/6-3-bend-camera-follow-eased-lerp-look-ahead.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-25: Implemented story 6-3 — bend camera follow with eased yaw, look-ahead offset, and smooth reset transition.