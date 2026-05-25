# Story 6.8: Variant Transition Cinematic Refinement — Track-Aligned Character Rotation & Extended Ride

**Status:** ready-for-dev

**Epic:** 6 — Variant Transition Cinematic & Handoff
**Story ID:** 6-8
**Story Key:** 6-8-variant-transition-cinematic-refinement
**Depends on:** 6-6 (variant scale wave spawn activation), 6-7 (E2E transition sequence coverage)
**Rationale:** All 7 preceding Epic 6 stories (6-1 through 6-7) are in review. This story is a cinematic refinement pass on top of the working transition.

---

## Context

### What ships today (post 6-1 through 6-7)

The full variant transition cinematic is implemented and E2E-tested:

1. **6-1:** Transition phase state machine (`idle → proposed → accepted → riding → breather → promoting → active`), soft halt via `WaveScheduler.pauseQueueing()`.
2. **6-2:** Character lateral X-axis lerp onto variant lane, bound to bend Z-progress. Character reaches `variantX` when the incoming diagonal's midpoint reaches `z=0`.
3. **6-3:** Camera follows character's X position during `riding` phase with eased yaw (sine peak at 12°) and look-ahead offset. Camera resets on `breather` entry.
4. **6-4:** Async breather (timer + wave-clearance gate), new-scale tracks scroll in from `SPAWN_Z` toward play anchor.
5. **6-5:** Two-phase backend protocol (`accept_variant` = lightweight confirmation, `POST /variant/promote` = scale swap).
6. **6-6:** Outgoing + new-scale waves coexist during transition, no `setWaves([])` clear on promote.
7. **6-7:** E2E tests covering full phase progression, camera behavior, wave counts, error paths.

### What needs refinement

The current implementation works but feels mechanical rather than cinematic:

| Current behavior | Problem |
|---|---|
| Character slides laterally (X-axis only) while facing forward | Does NOT feel like riding a 45° turn — feels like a strafe |
| No character rotation during bend | Character always faces +Z, never turns into the curve |
| Camera yaw is a fixed sine curve, not tracking character orientation | Camera feels disconnected from character's actual heading |
| Z-bound lerp completes when bend midpoint reaches player | The bend resolves too quickly — no sense of riding along the diagonal |
| Variant track scrolling at `speedPxMs * 0.5` | No distinction between track-scroll speed and character riding speed; character feels stationary relative to track |
| Old tracks simply disappear when `clearTracks()` fires | No visual of the old tracks receding as you ride away from them |

### What this story changes

This story refines the `riding` phase to feel like a physical railway switch:

1. **Character rotates** to follow the 45° bend trajectory (yaw rotation proportional to position on the diagonal)
2. **Character moves along the diagonal** (Z + X combined) rather than just strafing X
3. **Camera tracks character heading** — yaw follows character's current facing direction + ahead offset
4. **Extended ride duration** — character rides the variant track further before transitioning to `breather`. The `riding → breather` gate fires when the character has fully traversed the diagonal AND travelled a configurable distance along the straight section.
5. **Old tracks visibly recede** — old track geometry continues scrolling away during ride, reinforcing the sense of distance traveled
6. **New track reveal** — new-scale tracks become visible at the horizon as the character rounds the bend (the reveal is a payoff moment)

---

## User Story

As a player accepting a variant track switch,
I want my character to physically turn and ride along the bend like a real railway switch — rotating into the curve, traveling along the diagonal, watching the old track recede behind me — so that the transition feels like a physical journey to a new scale, not a UI swap.

---

## Acceptance Criteria

**AC-1 — Character rotation during riding phase:**
During the `riding` phase, the character model rotates (yaw) to face the direction of travel along the bend. When the character is on the incoming diagonal, rotation is proportional to position along the diagonal length:
```js
// At start of diagonal (progress=0): yaw = 0 (facing +Z)
// At midpoint of diagonal (progress=0.5): yaw = 45° toward variant side
// At end of diagonal (progress=1.0): yaw = 0 (back to +Z on straight section)
const bendYaw = (variantSide === 'RIGHT' ? 1 : -1) * MAX_BEND_YAW * Math.sin(progress * Math.PI);
character.rotation.y = bendYaw;
```
Where `MAX_BEND_YAW = 45 * Math.PI / 180` (45° — matches the track visual angle). Character yaw resolves to 0 as the character exits the diagonal onto the straight section.

**AC-2 — Character moves along diagonal path (not just X lerp):**
Replace the Z-bound X-only lerp from 6-2 with true diagonal movement. The character moves along a path that follows the variant track geometry:
```js
// Progress: 0 = character at bend entry, 1 = at end of diagonal section
const diagProgress = clamp((straightZ + STRAIGHT_LEN/2 + DIAG_LEN - 0) / DIAG_LEN, 0, 1);
const targetX = lerp(startX, variantX, diagProgress);
// Z trails behind: as character moves onto diagonal, Z position lags to create
// the sensation of riding ALONG the diagonal rather than snapping to a new X
const zOffset = diagProgress * DIAG_LEN * 0.3; // 30% of diagonal length as Z travel
character.position.x = targetX;
character.position.z = -zOffset; // negative Z = moving away / deeper into scene
```
The Z offset is subtle (30% of diagonal length) — enough to create depth sensation without breaking track readability. Edge case: if propose piece is already past the diagonal entry on first frame, snap character to final position.

**AC-3 — Camera follows character heading, not static yaw curve:**
Replace the 6-3 sine-based camera yaw with heading-tracking: camera yaw follows the character's current rotation yaw plus a look-ahead offset (the look-ahead point is along the track tangent at the character's position, projected ~10 units ahead).
```js
if (phase === 'riding') {
  // Value clamp first: _targetCamYaw must not exceed ±45° regardless of character yaw
  _targetCamYaw = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, character.rotation.y * 0.7));
  // Rate clamp: per-frame delta capped at ±0.02 rad to produce eased follow
  _currentCamYaw += Math.max(-0.02, Math.min(0.02, _targetCamYaw - _currentCamYaw));
  camera.rotation.y = _currentCamYaw;
  // Look-at point follows character heading, projected LOOK_AHEAD_DIST units ahead
  const lookAheadX = character.position.x + Math.sin(_currentCamYaw) * LOOK_AHEAD_DIST;
  const lookAheadZ = character.position.z + Math.cos(_currentCamYaw) * LOOK_AHEAD_DIST + camBase.lookAt[2];
  camera.lookAt(lookAheadX, 0, lookAheadZ);
}
```
Note: `LOOK_AHEAD_DIST` (new, 10 units) is the heading-projection distance used in `riding` mode. The existing `CAMERA_LOOK_AHEAD_Z` constant is used by the default camera mode's fixed look-at offset and is unrelated — do not conflate them.

**AC-4 — Riding phase extends onto straight section:**
The `riding → breather` transition no longer fires when the bend midpoint reaches the player. Instead, riding continues until the character has:
1. Fully traversed the diagonal (`scene.getTraversalProgress() === null || scene.getTraversalProgress() >= 0.95`)
2. AND traveled RIDE_EXTEND_Z units along the straight section (`scene.getCharacterZ() <= -RIDE_EXTEND_Z`)
3. AND traversal is no longer active (`!scene.isTraversalActive()`)

```js
const diagComplete = scene.getTraversalProgress() === null || scene.getTraversalProgress() >= 0.95;
const straightTraveled = scene.getCharacterZ() <= -RIDE_EXTEND_Z && !scene.isTraversalActive();
if (diagComplete && straightTraveled) {
  scene.setCameraMode('default');
  setTransitionPhase('breather', ctx);
}
```

Where `RIDE_EXTEND_Z = 15` (world units).

**API contracts (both new getters added in Task 5):**
- `scene.getCharacterZ()` — returns `character.position.z`. Before 6-8, this value is always 0 (character Z is never written). From 6-8 onward, the `_charTraversal` block in `render()` writes it (AC-2). The safe zone system uses mesh world Z coordinates (not `character.position.z`) so there is no coordinate space conflict.
- `scene.isTraversalActive()` — returns `_charTraversal !== null`. `_charTraversal` is the existing flag from 6-2, set by `setCharacterTargetX()` and cleared when `progress >= 1` (render loop, line ~516) or by `reset()`/`clearVariantGeom()`. It becomes `null` naturally as the diagonal completes — condition 3 above fires only after the X lerp has fully resolved.

This gives the character time to settle on the straight section before the breather begins. The variant track continues scrolling during this extension — character rides the track, not the bend animation.

**AC-5 — Old tracks visibly recede during riding phase:**
Old track geometry is NOT cleared when the character enters the riding phase. Instead, old tracks continue scrolling backward at the variant piece's speed (`lastWaveSpeed * 0.5`) until they pass `z < FRONT_Z * 2` (deep behind the camera). This creates the visual of the old street receding as you ride away from it. The clear happens at the existing `spawnVariantTracks()` call in the breather phase (6-4), unchanged.

Implementation: in the existing `render()` loop, while `phase === 'riding'`, the old track group (if any) continues its Z scroll without being removed. The `clearTracks()` in `spawnVariantTracks()` handles cleanup at breather → promoting.

**AC-6 — Camera constants defined and tunable:**
```js
const MAX_BEND_YAW = 45 * Math.PI / 180;    // character yaw peak — matches visual track angle
const RIDE_EXTEND_Z = 15;                    // units to ride on straight section after bend
const LOOK_AHEAD_DIST = 10;                  // riding-mode camera look-ahead along character heading
const CAMERA_YAW_FOLLOW_RATE = 0.08;        // unused directly — rate clamp of 0.02 rad/frame applies instead (see AC-3)
```

Existing constants to preserve (different purposes, do not rename or remove):
- `CAMERA_BEND_YAW_MAX` — max camera yaw in the 6-3 sine curve (character yaw, not camera, is now `MAX_BEND_YAW`)
- `CAMERA_LOOK_AHEAD_Z` — fixed look-at Z offset used by the default camera mode; unrelated to `LOOK_AHEAD_DIST`
- `CAMERA_RESET_DURATION_MS` — duration of camera ease-back on `breather` entry

**AC-7 — E2E and unit parity:**
- All existing Playwright tests (84/84 from 6-7 baseline) still pass
- All Python tests pass
- New unit tests for character rotation, diagonal path, extended ride timing
- Smoke visual check: character rotates into the bend, old tracks recede, new tracks revealed from horizon
- `window.__gameState.scene.transitionRideProgress` (new observable, 0→1) tracks ride completion for test hooks

---

## Tasks / Subtasks

- [ ] **Task 1 — Add `MAX_BEND_YAW`, `RIDE_EXTEND_Z`, `LOOK_AHEAD_DIST` constants to SceneManager (AC-1, AC-6)**
  - In `static/game/SceneManager.js`, add at module level after existing camera constants:
    ```js
    const MAX_BEND_YAW = 45 * Math.PI / 180;
    const RIDE_EXTEND_Z = 15;
    const LOOK_AHEAD_DIST = 10;
    const CAMERA_YAW_FOLLOW_RATE = 0.08;
    ```
  - Do NOT modify or remove existing `CAMERA_BEND_YAW_MAX`, `CAMERA_LOOK_AHEAD_Z`, `CAMERA_RESET_DURATION_MS` — these are still used for the camera reset transition in `breather`.

- [ ] **Task 2 — Implement character rotation on diagonal (AC-1)**
  - In `SceneManager.createScene()` closure, in the `render()` function where `_charTraversal` is processed:
    - After computing `progress` (0→1 across diagonal), set character yaw:
      ```js
      if (_charTraversal) {
        const variantSide = variantInfo?.side || 'RIGHT';
        const sign = variantSide === 'RIGHT' ? 1 : -1;
        const bendYaw = sign * MAX_BEND_YAW * Math.sin(progress * Math.PI);
        character.rotation.y = bendYaw;
      }
      ```
    - When `_charTraversal` completes (`progress >= 1`), do NOT snap yaw to 0 — ease it back over ~200ms using existing tween patterns:
      ```js
      if (!_charTraversal && Math.abs(character.rotation.y) > 0.01) {
        character.rotation.y *= 0.9; // exponential decay toward 0
      }
      ```
    - Guard: if `character` object does not have a `.rotation.y` property (no Three.js character mesh yet), skip rotation silently.

  - **Preserve existing behavior:** The `_charTraversal` X lerp still runs (from 6-2). The rotation is additive on top.

- [ ] **Task 3 — Implement Z-offset diagonal movement (AC-2)**
  - In the same `_charTraversal` block, add Z offset:
    ```js
    const zOffset = progress * DIAG_LEN * 0.3;
    character.position.z = -zOffset;
    ```
  - The Z offset moves the character deeper into the scene (negative Z) as they traverse the diagonal. This combines with the X lerp to create diagonal movement.
  - **Edge case:** When `_charTraversal` resolves (`progress >= 1`), freeze Z position — don't snap back to 0. The character stays at the final Z position.
  - **Edge case:** If `reset()` or `clearVariantGeom()` is called during traversal, reset character Z to 0 (done by the existing `_charTraversal = null` in `reset()` + manual `character.position.z = 0`).

- [ ] **Task 4 — Implement heading-tracking camera (AC-3)**
  - In `SceneManager.js`, in the `render()` function's camera block:
    - Add camera yaw target state: `let _targetCamYaw = 0; let _currentCamYaw = 0;`
    - When `_cameraMode === 'riding'`:
      ```js
      // Step 1 — value clamp: cap target before rate clamp, prevents wild spinning
      _targetCamYaw = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, character.rotation.y * 0.7));
      // Step 2 — rate clamp: per-frame delta capped at ±0.02 rad (eased follow)
      _currentCamYaw += Math.max(-0.02, Math.min(0.02, _targetCamYaw - _currentCamYaw));
      camera.rotation.y = _currentCamYaw;
      // Step 3 — look-ahead along heading using LOOK_AHEAD_DIST (not CAMERA_LOOK_AHEAD_Z)
      const lookAheadX = character.position.x + Math.sin(_currentCamYaw) * LOOK_AHEAD_DIST;
      const lookAheadZ = character.position.z + Math.cos(_currentCamYaw) * LOOK_AHEAD_DIST + camBase.lookAt[2];
      camera.lookAt(lookAheadX, 0, lookAheadZ);
      ```
    - When `_cameraMode` transitions from `'riding'` to `'default'` (on `breather` entry):
      - Reuse the existing `CAMERA_RESET_DURATION_MS` (500ms) ease-out to lerp `_currentCamYaw → 0` and `camera.rotation.y → 0`.
      - Camera lookAt also resets to `camBase.lookAt` (standard forward).
    - **Edge case:** If character yaw is 0 (no traversal active or no character mesh), `_targetCamYaw` is 0 → camera behaves as default.

- [ ] **Task 5 — Extend riding phase to straight section (AC-4)**
  - In `main.js`, modify the `riding` phase handler to gate `riding → breather` on extended conditions:
    - Track the character's diagonal progress AND straight-section distance:
      ```js
      // In the per-frame riding check
      const characterZ = scene.getCharacterZ(); // NEW getter
      const diagComplete = scene.getTraversalProgress() === null || scene.getTraversalProgress() >= 0.95;
      const straightTraveled = characterZ <= -RIDE_EXTEND_Z && !scene.isTraversalActive(); // Z negative = deeper
      if (diagComplete && straightTraveled) {
        scene.setCameraMode('default'); // Start camera reset
        setTransitionPhase('breather', ctx);
      }
      ```
    - Add `getCharacterZ()` to SceneManager API (returns `character.position.z`).
    - Add `isTraversalActive()` to SceneManager API (returns `_charTraversal !== null`).

  - **Backward compatibility with 6-4:** The `breather` handler from 6-4 already expects `riding → breather` to be async and polls timer/wave-clearance. This is unchanged — we're just delaying the transition.

  - **New `transitionRideProgress` test hook:**
    Written in `static/game/SceneManager.js`, inside the `render()` function's `_charTraversal` block (Task 3), on every frame — not in `main.js`. The render loop has direct access to both `progress` and `character.position.z` at the same tick, avoiding race conditions between the phase-gate logic in main.js and the animation state in SceneManager.
    ```js
    // Inside the _charTraversal block in render(), after computing progress and zOffset:
    const diagTraveled = progress * DIAG_LEN;
    const straightTraveled = Math.max(0, -character.position.z - DIAG_LEN * 0.3); // post-diagonal Z
    const totalRideDuration = DIAG_LEN + RIDE_EXTEND_Z;
    if (window.__gameState?.scene) {
      window.__gameState.scene.transitionRideProgress = Math.min(1, (diagTraveled + straightTraveled) / totalRideDuration);
    }
    ```
    Reset to 0 when `_charTraversal` is set to null (traversal complete or reset). Reset to `undefined` (not 0) on `reset()` so tests can distinguish "never started" from "just completed".

- [ ] **Task 6 — Preserve old track geometry during riding phase (AC-5)**
  - In `static/game/SceneManager.js`, in `render()`:
    - Before the existing `clearTracks()` call (in `spawnVariantTracks` which fires during breather), add a guard: old tracks should NOT be cleared during riding phase.
    - The existing behavior is: old tracks are in the `tracks` array and scroll at `speedPxMs * 0.5` in the render loop. While the character is in the `riding` phase, this continues — old tracks scroll backward (negative Z at `speedPxMs * 0.5 * dt`).
    - Track visibility: when old track Z position is past `FRONT_Z * 2` (double the front boundary), they're effectively behind the camera and out of view — no need to actively remove them; `clearTracks()` handles cleanup.
  - **No code changes needed if tracks naturally scroll away during riding.** Verify by reading the render loop's track-scroll logic. If tracks are explicitly removed on riding entry, gate that removal behind `phase !== 'riding'`.

- [ ] **Task 7 — Unit tests for character rotation and diagonal movement (AC-7)**
  - Extend `tests/unit/js/SceneManager.test.js`:
    - **Character rotation test:** Start traversal at progress=0 → yaw ≈ 0. Progress=0.5 → |yaw| ≈ MAX_BEND_YAW * sin(π/2) ≈ 45°. Progress=1 → yaw ≈ 0 (snap not checked, ease-back checked with tolerance).
    - **Z offset test:** Start traversal → `character.position.z` moves negative proportional to `progress * DIAG_LEN * 0.3`. At progress=0.5 → z ≈ -DIAG_LEN * 0.3 * 0.5. At progress=1 → z ≈ -DIAG_LEN * 0.3.
    - **Camera heading tracking test:** In `riding` camera mode, with character at progress=0.5 → `currentCamYaw` ≈ `character.rotation.y * 0.7` (within lerp tolerance).
    - **Camera reset test:** After `riding → default` transition, camera yaw lerps to 0 over CAMERA_RESET_DURATION_MS.
    - **Ride progress test:** `getCharacterZ()` returns correct Z at various traversal stages.

- [ ] **Task 8 — Full test suite parity (AC-7)**
  - `npx playwright test` → 84/84 pass (no regressions)
  - `.venv/Scripts/python.exe -m pytest` → all pass
  - Smoke test: run Docker stack, inject audio for propose→accept, observe character rotation and diagonal movement visually, verify console no errors

---

## Dev Notes

### Files to modify

- `static/game/SceneManager.js` — character rotation yaw, Z-offset diagonal movement, heading-tracking camera, extended ride Z target, test hooks
- `static/game/main.js` — extended riding gate condition, `transitionRideProgress` test hook, `getCharacterZ()` integration

### Files to read (do not modify)

- `static/game/SceneManager.js` — existing `_charTraversal` logic (6-2), `_cameraMode` block (6-3), `render()` loop structure, `tracks` array scrolling, `clearTracks()` (6-4), existing camera constants
- `static/game/main.js` — existing `riding` phase listener (6-2), `setTransitionPhaseListener` wiring (6-1), `_perFrameHook` pattern (6-4)
- `static/game/TransitionPhases.js` — `setTransitionPhaseListener`, `registerPhaseCleanup` (6-1)
- `_bmad-output/implementation-artifacts/6-2-character-lateral-traversal-onto-variant-track.md` — current character traversal mechanics
- `_bmad-output/implementation-artifacts/6-3-bend-camera-follow-eased-lerp-look-ahead.md` — current camera behavior
- `_bmad-output/implementation-artifacts/6-4-post-bend-breather-and-new-scale-track-approach.md` — breather phase, track approach

### Existing SceneManager geometry constants (repeated from 6-2 for reference)

```
STRAIGHT_LEN = 60   — Z length of variant parallel track
DIAG_LEN = 45       — Z length of diagonal section
LANE_W = 1.4        — lane box width
SPAWN_Z = -100      — track spawn position
FRONT_Z = -80       — front boundary for track removal
```

### Why character rotation matters

Without rotation, the character strafes sideways while facing forward. This breaks the illusion of a physical track switch — Subway Surfers-style runners always rotate their character into turns. The 45° yaw peak at mid-diagonal matches the visual angle of the bend, creating a cohesive visual.

### Why Z-offset diagonal movement

The current implementation (6-2) only moves the character on X. The user experience is "character slides to the side" rather than "character rides along the diagonal." The Z offset (30% of diagonal length) creates genuine diagonal travel — the character recedes slightly into the distance as they cross the bend, which enhances perspective depth.

### Why extended ride onto straight section

The current behavior resolves the bend as soon as the midpoint passes — the character is on the variant lane but the transition to breather is near-instant. Extending the ride by RIDE_EXTEND_Z (15 units) gives:
1. Time for the character rotation to resolve (yaw → 0)
2. Time for the camera to settle behind the character
3. A sense of "riding the new track" before the breather pause
4. Old tracks continue receding, reinforcing the spatial transition

### Why heading-tracking camera replaces sine yaw

6-3's sine-based camera yaw (peak at mid-diagonal regardless of character position) works when the character only slides X. But with character rotation and diagonal travel, the camera should follow WHAT THE CHARACTER IS LOOKING AT. Heading-tracking creates a tighter coupling between character facing and camera facing, which feels more natural.

### Why this is story 6-8 and not a rework of 6-2/6-3

All 7 preceding stories are in review — they implement a correct, tested transition. This story is a cinematic polish pass that refines the feel without changing the fundamental architecture. If any of the changes are too invasive, they can be gated behind a `cinematicRefinement` flag (default `true`) and the existing 6-2/6-3 behavior serves as fallback.

### References

- Epic 6 spec — [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Variant Transition Cinematic & Handoff]
- Story 6-2 character traversal — [Source: _bmad-output/implementation-artifacts/6-2-character-lateral-traversal-onto-variant-track.md]
- Story 6-3 camera follow — [Source: _bmad-output/implementation-artifacts/6-3-bend-camera-follow-eased-lerp-look-ahead.md]
- Story 6-4 breather/track approach — [Source: _bmad-output/implementation-artifacts/6-4-post-bend-breather-and-new-scale-track-approach.md]
- SceneManager geometry constants — [Source: static/game/SceneManager.js]
- Camera rendering block — [Source: static/game/SceneManager.js#L515-L535]
- Character traversal render — [Source: static/game/SceneManager.js render() _charTraversal block]
- main.js phase listeners — [Source: static/game/main.js]

---

## Dev Agent Record

### Agent Model Used

DeepSeek V4 Flash (Claude Code)

### Completion Notes List

- Created as story 6-8 — cinematic refinement for variant transition
- Refines riding phase: character rotation, diagonal movement, heading-tracking camera, extended ride
- Old tracks recede visually during riding (no early clear)
- New constants: MAX_BEND_YAW (45°), RIDE_EXTEND_Z (15), LOOK_AHEAD_DIST (10), CAMERA_YAW_FOLLOW_RATE (0.08)
- Falls back to existing 6-2/6-3 behavior if cinematic refinement disabled

### File List

- `static/game/SceneManager.js` (MODIFY)
- `static/game/main.js` (MODIFY)
- `tests/unit/js/SceneManager.test.js` (MODIFY)
- `_bmad-output/implementation-artifacts/6-8-variant-transition-cinematic-refinement.md` (NEW)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)