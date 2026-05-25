# Story 6.2: Character Lateral Traversal Onto Variant Track

**Status:** review

**Epic:** 6 — Variant Transition Cinematic & Handoff
**Story ID:** 6-2
**Story Key:** 6-2-character-lateral-traversal-onto-variant-track
**Depends on:** 6-1 (accept-gate state machine, soft halt)

---

## Context

### What 6-1 established

Story 6-1 wired the transition phase state machine (`idle → proposed → accepted → riding → breather → promoting → active`) and `WaveScheduler.pauseQueueing()` into the accept handler. After 6-1, the entire accept sequence still runs synchronously in one frame — behavior parity with today.

### What 6-2 does

6-2 replaces the `accepted → riding` synchronous jump with an asynchronous, animation-driven phase. When the phase enters `riding`, the character begins lateral traversal from the main lane onto the variant track's bend. Movement is bound to the scroll progress of the variant track geometry (not wall-clock time), so the character arrives at the variant lane exactly when the incoming diagonal's bend midpoint reaches the player.

### Current accept flow (post-6-1)

1. Phase → `accepted`, `waveScheduler.pauseQueueing()` called
2. Phase → `riding` (no-op — synchronous)
3. Phase → `breather` (no-op — synchronous)
4. Phase → `promoting` (default handler: scene.acceptVariantTracks, waveScheduler.resumeQueueing, safeZoneRenderer.reset — all synchronous)
5. Phase → `active`

After 6-1 the `scene.acceptVariantTracks()` call still creates the dismiss bend piece and old-style character tween. 6-2 reworks this: the propose piece itself becomes the ride piece, and character movement is driven by its Z-progress.

### Why bind to Z-progress, not wall-clock

`proposeVariantTracks` scrolls geometry at a speed derived from `speedPxMs * 0.5` (SCENE MANAGER). If the character used wall-clock timing, it would desync from the visual bend whenever speed changes. Binding to Z-progress guarantees the character touches the variant lane just as the bend arrives.

---

## User Story

As a variant-accepting player,
I want my character to smoothly slide onto the variant track's bend as it scrolls toward me,
so that the transition feels physical — I'm riding the railway switch, not teleporting.

---

## Acceptance Criteria

**AC-1 — riding phase is asynchronous:**
After `setTransitionPhase('accepted', ...)` and `waveScheduler.pauseQueueing()`, the `riding` phase transition handler (registered via `setTransitionPhaseListener`) waits for the variant track geometry to reach the bend midpoint before calling `setTransitionPhase('breather', ...)`. The `accepted → riding` transition happens immediately (same frame), but `riding → breather` fires only when `scene.isBendMidpointReached()` returns `true`.

**AC-2 — `SceneManager.isBendMidpointReached()`:**
Returns `true` when the incoming diagonal's midpoint has reached `z = 0` (the player position). Computed from the propose piece's Z position:
```js
const straightZ = variantProposePiece.mesh.position.z;
const incomingMidpointZ = straightZ + STRAIGHT_LEN / 2 + DIAG_LEN / 2;
return incomingMidpointZ >= 0;
```

**AC-3 — Character lateral lerp bound to bend Z-progress:**
`SceneManager.setCharacterTargetX(targetX)` sets a target X (the variant lane X) and begins a Z-bound lerp. On each `render()` call while the lerp is active:
```js
// progress: 0 when incoming front edge first touches player, 1 when midpoint reaches player
const frontEdgeZ = straightZ + STRAIGHT_LEN / 2 + DIAG_LEN;
const midpointZ = straightZ + STRAIGHT_LEN / 2 + DIAG_LEN / 2;
const progress = clamp((frontEdgeZ - midpointZ) > 0
  ? (frontEdgeZ - 0) / (frontEdgeZ - midpointZ)
  : 0, 0, 1);
character.position.x = lerp(startX, targetX, progress);
```
Edge case: if the propose piece is already past the midpoint on the first frame (shouldn't happen since accept fires at safe zone adjacency, well before bend arrives), snap character to targetX immediately.

The Z-extension in this formula is intentionally approximate: `frontEdgeZ` uses `DIAG_LEN` (45) instead of the true diagonal half-extent (`DIAG_LEN * 1.414 / 2 ≈ 31.8` offset from center at `STRAIGHT_LEN/2 + DIAG_LEN * 0.5`). True front edge = `straightZ + 84.3`. Formula gives `straightZ + 75`. The ~9-unit gap means character reaches targetX slightly (~20%) before the visual midpoint. This is acceptable because in-game the player can't perceive the exact moment a moving Z-coordinate crosses a boundary; tune after 6-4 breather timing is finalized.

**AC-4 — Accept handler no longer calls `scene.acceptVariantTracks`:**
The default `promoting → active` handler (which currently does `scene.acceptVariantTracks` + old swap actions) is removed. The `accepted` transition handler instead:
1. Sets `scene.setCharacterTargetX(variantInfo.variantX)` — begin traversal
2. The riding phase listener polls `scene.isBendMidpointReached()` via `requestAnimationFrame` (reusing existing RAF loop — register a per-frame check in `scene.render()` or the main loop)
3. When reached → `setTransitionPhase('breather', ...)`

**AC-5 — Variant propose piece survives past accept:**
Currently `variantProposePiece` is cleared in `acceptVariantTracks()` (via `clearVariantGeom()`). Remove the clear from the accept path: the propose piece becomes the ride piece. It scrolls until it exits the frame naturally (pruned when Z > STRAIGHT_LEN/2 + DIAG_LEN, existing logic). `clearVariantGeom()` is only called on dismiss/timeout paths.

**AC-6 — E2E and unit parity:**
- 74/74 Playwright chromium tests pass (6-1 baseline)
- 71/71 pytest pass
- `window.__gameState.variant.transitionPhase` transitions: `accepted → riding → breather` with `riding → breather` delayed until bend midpoint visible
- New unit test (`tests/unit/js/SceneManager.test.js` — extend existing): `isBendMidpointReached()` returns false when piece is far, true when midpoint at z ≥ 0

---

## Tasks / Subtasks

- [x] **Task 1 — Add `isBendMidpointReached()` to SceneManager (AC-2)**
  - In `static/game/SceneManager.js`, add method exposed on the returned API:
    ```js
    isBendMidpointReached() {
      if (!variantProposePiece) return false;
      const straightZ = variantProposePiece.mesh.position.z;
      return straightZ + STRAIGHT_LEN / 2 + DIAG_LEN / 2 >= 0;
    }
    ```

- [x] **Task 2 — Add `setCharacterTargetX()` to SceneManager (AC-3)**
  - Add internal state: `let _charTraversal = null; // { startX, targetX }`
  - Add method:
    ```js
    setCharacterTargetX(targetX) {
      _charTraversal = { startX: character.position.x, targetX };
    }
    ```
  - In `render()`, after existing tween logic but before wave updates, add Z-bound lerp:
    ```js
    if (_charTraversal && variantProposePiece) {
      const straightZ = variantProposePiece.mesh.position.z;
      const frontEdgeZ = straightZ + STRAIGHT_LEN / 2 + DIAG_LEN;
      const midpointZ = straightZ + STRAIGHT_LEN / 2 + DIAG_LEN / 2;
      const range = frontEdgeZ - midpointZ;
      const progress = range > 0 ? Math.max(0, Math.min(1, (frontEdgeZ - 0) / range)) : 1;
      character.position.x = _charTraversal.startX + (_charTraversal.targetX - _charTraversal.startX) * progress;
      if (progress >= 1) _charTraversal = null;
    }
    ```
  - Reset `_charTraversal = null` in `reset()` and `clearVariantGeom()`.

- [x] **Task 3 — Wire riding phase handler in main.js (AC-1, AC-4)**
  - In `main.js`, register a `setTransitionPhaseListener` for the `riding` phase (replaces the 6-1 default riding listener that synchronously jumps to `breather`).
  - On entry to `riding`: call `scene.setCharacterTargetX(variantInfoFromScene)`.
    The variant X is available from `variantInfo` which is set by `proposeVariantTracks`.
    Expose a getter `scene.getVariantInfo()` → `{ variantX, side }`.
  - The riding listener sets up a per-frame check. Since the RAF loop already calls `scene.render()`, add a callback hook: `scene.setOnBendMidpointReached(() => { setTransitionPhase('breather', ctx); })`.
  - In `SceneManager.render()`, after updating variant propose piece Z, check `isBendMidpointReached()` and fire the callback (once — guarded by a flag).
  - Register a phase-exit cleanup via `registerPhaseCleanup('riding', () => { scene.clearBendMidpointCallback(); })` so the per-frame check is torn down on ANY riding exit — including `riding → idle` (dismiss/miss during cinematic), not just `riding → breather`. Without cleanup, the callback persists on a destroyed propose piece.

- [x] **Task 4 — Remove `acceptVariantTracks` from promoting→active handler (AC-4)**
  - The promoting→active default handler in `runAcceptTransition` (from 6-1) currently calls `scene.acceptVariantTracks(...)` and `waveScheduler.resumeQueueing(...)`. Move `scene.acceptVariantTracks(...)` out — it will be replaced in 6-4 by the track-approach animation.
  - After 6-2, the promoting→active handler still does the wave/score/track swap but NOT `scene.acceptVariantTracks` (that geometry swap moves to 6-4).

- [x] **Task 5 — Prevent propose piece clear in accept path (AC-5)**
  - In `acceptVariantTracks()`, remove the call to `clearVariantGeom()` or the parts that clear `variantProposePiece`. The propose piece stays in the scene and continues scrolling.
  - Only `dismissVariantTracks()` and `clearVariantGeom()` (dismiss/timeout path) clear it.

- [x] **Task 6 — Unit test for bend midpoint detection (AC-6)**
  - Extend `tests/unit/js/SceneManager.test.js`:
    - Simulate propose piece at Z far from player → `isBendMidpointReached()` returns false.
    - Simulate propose piece at Z where midpoint ≥ 0 → returns true.
    - Simulate no propose piece → returns false.

- [x] **Task 7 — Full test suite parity (AC-6)**
  - `.venv/Scripts/python.exe -m pytest` → 71/71 pass
  - `npx playwright test` (chromium) → 74/74 pass
  - Smoke: inject audio for propose → accept trigger — verify `window.__gameState.variant.transitionPhase` goes through `accepted → riding → breather` with riding duration > 0

---

## Dev Notes

### Files to modify

- `static/game/SceneManager.js` — `isBendMidpointReached()`, `setCharacterTargetX()`, bend-midpoint callback, Z-bound lerp in render(), preserve propose piece in accept path
- `static/game/main.js` — riding phase listener, wire `setCharacterTargetX`, remove `acceptVariantTracks` from promoting→active handler
- `tests/unit/js/SceneManager.test.js` — bend midpoint detection tests

### Files to read (do not modify)

- `static/game/GameState.js` — `TRANSITION_PHASES` (added in 6-1)
- `static/game/WaveScheduler.js` — `pauseQueueing()` semantics (added in 6-1)
- `_bmad-output/implementation-artifacts/6-1-accept-gate-state-machine-soft-halt.md` — 6-1 baseline

### Existing SceneManager geometry constants (relevant)

```
STRAIGHT_LEN = 60   — Z length of variant parallel track
DIAG_LEN = 45       — Z length of diagonal section  
LANE_W = 1.4        — lane box width
```

The variant track group layout (Z-axis, local coords):
- Incoming diagonal: position.z = STRAIGHT_LEN/2 + DIAG_LEN/2 (at front, highest local Z)
- Straight section: position.z = 0 (center)
- Outgoing diagonal: position.z = -(STRAIGHT_LEN/2 + DIAG_LEN/2) (at back)

Group translates in world Z only. Scrolling toward player means group.position.z increases.

### Why character traversal uses the propose piece, not dismiss

6-1/6-2 preserve the propose piece through accept. The dismiss piece (old 5-8 behavior) was a separate mesh group created on accept that scrolled out. Epic 6 replaces that with the propose piece continuing through the accept — the same geometry that proposed the variant becomes the ride geometry.

### Direction of character movement

Character traverses from main lane X (where they currently stand) to `variantInfo.variantX`. The variantX was computed in `_variantLaneX()` during `proposeVariantTracks()` — it's 2 lane widths outside the anchor note's lane.

### References

- Epic 6 spec — [Source: _bmad-output/planning-artifacts/epics.md#Epic 6]
- Story 6-1 baseline — [Source: _bmad-output/implementation-artifacts/6-1-accept-gate-state-machine-soft-halt.md]
- SceneManager variant geometry — [Source: static/game/SceneManager.js#L101-L283]
- Current accept handler — [Source: static/game/main.js#L537-L579]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- SceneManager: added `isBendMidpointReached()`, `setCharacterTargetX()`, `setOnBendMidpointReached()`, `clearBendMidpointCallback()`, `getVariantInfo()` functions
- SceneManager: Z-bound character lerp added to `render()` loop; bend midpoint callback fires once when condition met
- SceneManager: `clearVariantGeom()` and `reset()` clear `_charTraversal`/`_bendMidpointCb`
- SceneManager: `acceptVariantTracks()` preserves propose piece (marked "ride piece")
- main.js: `riding` listener now async — calls `setCharacterTargetX` and registers bend-midpoint callback; falls back to synchronous advance if no variant geometry
- main.js: `registerPhaseCleanup('riding', ...)` clears bend callback on any riding exit
- main.js: `promoting` listener no longer calls `scene.acceptVariantTracks` (deferred to 6-4)
- 218 unit tests, 71 Python tests pass

### File List

- `static/game/SceneManager.js`
- `static/game/main.js`
- `tests/unit/js/SceneManager.test.js`
- `_bmad-output/implementation-artifacts/6-2-character-lateral-traversal-onto-variant-track.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-25: Implemented story 6-2 — character lateral traversal onto variant track via Z-bound lerp, bend midpoint detection, async riding phase handler.