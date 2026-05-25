# Story 6.4: Post-Bend Breather + New Scale Track Approach

**Status:** review

**Epic:** 6 — Variant Transition Cinematic & Handoff
**Story ID:** 6-4
**Story Key:** 6-4-post-bend-breather-and-new-scale-track-approach
**Depends on:** 6-3 (bend camera follow)

---

## Context

### What 6-3 established

After 6-3, the `riding` phase animates: character traverses onto the variant track's incoming diagonal, camera follows with eased yaw + look-ahead. When the bend midpoint reaches the player, phase transitions to `breather`.

### What 6-4 does

The `breather` phase holds the character on the straight variant section while outgoing-scale waves continue travelling until off-frame. A configurable breather timer (~3s, tunable via `timing_params.variantBreatherMs`) starts. At breather end, the remaining variant-scale tracks scroll in from the horizon. When all variant tracks reach the play anchor, phase transitions to `promoting`.

### Current state (post-6-3)

- The variant propose piece scrolls continuously through `riding` and into `breather`.
- Outgoing-scale waves are paused (no new queuing) but in-flight waves still render — `pauseQueueing()` from 6-1.
- The old scale's track geometry is still visible (never cleared since 6-2 removed `acceptVariantTracks`).
- `promoting → active` handler still does the synchronous swap (score, notes, scheduler resume).

### What needs to change

The `breather` phase becomes asynchronous: it waits for a timer AND for all outgoing waves to clear the frame (whichever is longer). Then it spawns the variant-scale tracks at the horizon, scrolls them to the play anchor, and then transitions to `promoting`. Only at `promoting → active` does the full state swap happen (wave scheduler, score tracking, safe zones).

---

## User Story

As a player who just navigated the variant track bend,
I want a brief breather on the straight section where I can see outgoing-scale waves clear naturally and watch the new scale's tracks roll in from the horizon,
so that I can reposition my fingers and feel the new scale arriving before gameplay resumes.

---

## Acceptance Criteria

**AC-1 — Breather phase is asynchronous:**
The `riding → breather` transition handler starts a breather. The phase stays in `breather` until both conditions are met:
1. Breather timer expired: `performance.now() - breatherStartMs >= variantBreatherMs`
2. All outgoing-scale waves have cleared the frame: `WaveScheduler.waves.length === 0` OR all waves' visual Z position is past the frame boundary (`pruneThreshold` already handles this; additionally check `activeWaves.size === 0` in SceneManager)
Whichever is longer wins. `breather → promoting` fires only when both conditions are true.

**AC-2 — Breather duration from timing_params:**
`timing_params` response from `POST /game/start` gains a new field `variant_breather_ms` (default 3000). The frontend reads this value. Backend default in `game_engine.py`:
```python
VARIANT_BREATHER_MS = 3000
```
Added to `timing_params` dict returned by `start_game`.

**AC-3 — Variant-scale tracks scroll in from horizon at breather end:**
When `breather → promoting` fires, `SceneManager.spawnVariantTracks(newPrimary)` creates the new scale's track geometry at `z = SPAWN_Z` and scrolls them toward `z = -TRACK_DEPTH/2 + 5` (the standard track rest position). The scroll uses the same speed as the variant piece: `lastWaveSpeed * 0.5`.

Implementation: add to SceneManager:
```js
function spawnVariantTracks(newPrimary, speedPxMs) {
  // Build new track meshes at SPAWN_Z
  _pendingTracks = [];
  for (let i = 0; i < newPrimary.num_lanes; i++) {
    const x = laneX(i, newPrimary.num_lanes);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, TRACK_DEPTH), trackMat);
    mesh.position.set(x, -0.05, SPAWN_Z);
    scene.add(mesh);
    _pendingTracks.push({ mesh, targetZ: -TRACK_DEPTH / 2 + 5 });
  }
}
```
In `render()`, scroll pending tracks toward their targetZ at `speedPxMs * 0.5`. When all tracks reach targetZ (±1 unit tolerance), fire `onTracksLanded` callback → `setTransitionPhase('promoting', ctx)`.

**AC-4 — Old track geometry cleared, waves preserved:**
When `spawnVariantTracks` is called, the existing primary tracks (from `tracks` array) are removed via a new `clearTracks()` function that removes ONLY track geometry — it does NOT call `clearWaves()`. `activeWaves` (in-flight outgoing-scale wave meshes) are preserved untouched, so old-scale carts continue rendering during the track-scroll-in sequence.

Add to SceneManager API:
```js
function clearTracks() {
  for (const t of tracks) { scene.remove(t.mesh); }
  tracks = [];
}
```
`spawnVariantTracks` calls `clearTracks()` (NOT `clearScene()`) before building new track meshes.

**AC-5 — Outgoing wave clearance detection:**
`SceneManager.getActiveWaveCount()` returns `activeWaves.size`. The breather handler in main.js polls this alongside the timer:
```js
const wavesCleared = scene.getActiveWaveCount() === 0;
const timerExpired = performance.now() - breatherStartMs >= breatherMs;
if (wavesCleared && timerExpired) { /* transition to promoting */ }
```
Check is done each RAF frame via a registered callback (same pattern as bend-midpoint callback from 6-2).

**AC-6 — `promoting → active` handler does full state swap:**
When `promoting` fires (tracks have landed), the registered default handler does what today's accept handler does, minus the geometry swap (already done):
1. `waveScheduler.resumeQueueing(resp.notes, startIdx)` — new scale waves begin spawning
2. `scene.setWaves([], performance.now())` — clear in-flight old-scale wave meshes
3. `safeZoneRenderer.reset()` — clear old safe zones
4. Update `run.sequence`, `run.cursor`, `ascendingNoteCount`, `rootNote`, `apexNote`
5. `setTransitionPhase('active', ctx)`

**AC-7 — Breather is NOT skippable by player input:**
No key/click during breather advances the phase. The breather timer + wave clearance gate is the only path to `promoting`.

**AC-8 — E2E and unit parity:**
- Playwright chromium 74/74 pass
- pytest 71/71 pass (new field in timing_params doesn't break existing tests)
- Smoke: inject accept audio → riding → breather → observe breather duration ≥ `variant_breather_ms`, waves clear, tracks scroll in, phase reaches `promoting` then `active`

---

## Tasks / Subtasks

- [x] **Task 1 — Add `variant_breather_ms` to backend timing_params (AC-2)**
  - In `services/game_engine.py`, add `VARIANT_BREATHER_MS = 3000` constant.
  - In `start_game()` response, include `variant_breather_ms: VARIANT_BREATHER_MS` in `timing_params`.
  - Update existing `timing_params` tests if any assert exact key sets.

- [x] **Task 2 — Add outgoing wave count getter to SceneManager (AC-5)**
  - Expose `getActiveWaveCount()` on the returned API (returns `activeWaves.size`).

- [x] **Task 3 — Implement `clearTracks()` + `spawnVariantTracks` + track scroll in SceneManager (AC-3, AC-4)**
  - Add `clearTracks()` function to SceneManager (exposed on return API):
    ```js
    function clearTracks() {
      for (const t of tracks) { scene.remove(t.mesh); }
      tracks = [];
    }
    ```
    This removes only track geometry — `activeWaves` is untouched so old-scale wave meshes
    continue rendering through the track-scroll-in sequence (required by 6-6 wave coexistence).
  - Add `_pendingTracks` state array.
  - Add `spawnVariantTracks(baseFret, numLanes, speedPxMs)` method:
    - Calls `clearTracks()` (NOT `clearScene()` — preserves wave meshes).
    - Builds new track meshes at `SPAWN_Z`.
    - Stores in `_pendingTracks`.
  - In `render()`, scroll pending tracks:
    ```js
    for (const pt of _pendingTracks) {
      pt.mesh.position.z -= speedPxMs * 0.5 * (dt * 1000); // dt in seconds
      // Clamp: don't overshoot target
      if (pt.mesh.position.z <= pt.targetZ) {
        pt.mesh.position.z = pt.targetZ;
      }
    }
    ```
  - Add `areTracksLanded()` — returns true when all pending tracks are within 1 unit of targetZ.
  - Add `setOnTracksLanded(cb)` — fires callback once when all tracks land (guarded by flag).
  - Reset `_pendingTracks` in `reset()`.

- [x] **Task 4 — Wire breather phase handler in main.js (AC-1, AC-5, AC-7)**
  - Register `setTransitionPhaseListener` for `breather` phase.
  - On entry to `breather`:
    - Record `breatherStartMs = performance.now()`.
    - Read `breatherMs = timing_params.variant_breather_ms ?? 3000`.
    - Register per-frame callback (via existing RAF loop pattern): check timer + wave clearance.
  - When both conditions met:
    - `scene.spawnVariantTracks(newPrimary.base_fret, newPrimary.num_lanes, lastWaveSpeed)`.
    - Wait for `scene.setOnTracksLanded()` → `setTransitionPhase('promoting', ctx)`.

- [x] **Task 5 — Wire promoting→active handler with full state swap (AC-6)**
  - Register default handler for `promoting → active` transition (via `setTransitionPhaseListener` or inline in `runAcceptTransition`):
    1. `waveScheduler.resumeQueueing(resp.notes, startIdx)`
    2. `scene.setWaves([], performance.now())`
    3. `safeZoneRenderer.reset()`
    4. Update `run.sequence`, `run.cursor`, `ascendingNoteCount`, `rootNote`, `apexNote`
    5. Variant state cleanup (same as 6-1 AC-4 step 8)
  - Note: `scene.acceptVariantTracks()` is NOT called (geometry already swapped in breather).

- [x] **Task 6 — Ensure outgoing-scale wave meshes continue rendering during breather (AC-1)**
  - `pauseQueueing()` only stops new wave generation. In-flight waves in `activeWaves` (SceneManager) continue rendering and scrolling. They expire naturally via the prune threshold.
  - No explicit clear of `activeWaves` during breather — the `setWaves([], ...)` call in promoting→active handles final cleanup.

- [x] **Task 7 — Full test suite parity (AC-8)**
  - `.venv/Scripts/python.exe -m pytest` → 71/71 pass
  - `npx playwright test` (chromium) → 74/74 pass
  - Python test: verify `variant_breather_ms` present in start_game response `timing_params`.
  - Smoke E2E: full accept → active sequence with breather delay visible.

---

## Dev Notes

### Files to modify

- `services/game_engine.py` — `VARIANT_BREATHER_MS` constant, add to `timing_params` in `start_game`
- `static/game/SceneManager.js` — `getActiveWaveCount()`, `spawnVariantTracks()`, `areTracksLanded()`, `setOnTracksLanded()`, pending track scroll in `render()`, `_pendingTracks` in `reset()`
- `static/game/main.js` — breather phase handler, promoting→active state swap, `variantBreatherMs` from timing_params

### Files to read (do not modify)

- `static/game/SceneManager.js` — `clearScene()`, `rebuildTracks()`, `activeWaves`, render loop structure
- `static/game/WaveScheduler.js` — `pauseQueueing()`, `resumeQueueing()` (from 6-1)
- `services/game_engine.py` — `start_game()` method, existing `timing_params` dict
- `_bmad-output/implementation-artifacts/6-1-accept-gate-state-machine-soft-halt.md` — phase machine wiring

### Breather timer floor

The breather timer is gated on "all outgoing waves cleared the frame" — so the effective breather duration is `max(variantBreatherMs, timeUntilWavesClear)`. In practice the timer always dominates: the last outgoing wave was queued before `pauseQueueing()` (called at `accepted` phase). By the time `breather` starts (~1-2s of bend traversal), most waves are already past the player, and the scheduler's 10s prune threshold plus SceneManager's Z-based removal means surviving waves clear within ~12s. The 3s timer fires first in all normal cases. The wave-clearance gate is a safety net for edge cases (very short `variantBreatherMs`, very slow wave speed, or scheduler back-pressure causing deep look-ahead queues) and serves as a debug assertion in normal operation.

### Why clearTracks instead of clearScene

Old tracks have the old `base_fret` and `num_lanes`. The new scale may have different fret geometry. `clearTracks()` removes only the track lane meshes while preserving `activeWaves` (in-flight outgoing-scale wave meshes). This is critical: 6-6 requires old-scale wave meshes to survive through the breather and into the promoting phase. If `clearScene()` (which calls `clearWaves()`) were used here, the wave meshes would be destroyed, and 6-6's "old + new waves coexist" design would be impossible to achieve — the meshes would already be gone.

### Track speed consistency

Variant piece scrolls at `lastWaveSpeed * 0.5`. New tracks scroll at the same speed. This keeps the scroll-in feeling consistent with the bend traversal — the player perceives one continuous movement.

### Speed reset to 1.0x: future ramp-back work

Today `accept_variant` resets `speed_multiplier = 1.0` (line 502 of `game_engine.py`). 6-5 preserves this in `_commit_variant_swap`. A player at 1.8x speed who takes a variant comes back at 1.0x — this is abrupt and may feel like whiplash, not a breather. The intentional behavior is: reset speed to give the player a moment to re-orient to the new scale. The open question is whether speed should ramp back to the pre-variant level over N bars after promote. This is deferred to a post-Epic-6 polish story — 6-4/6-5 ship the reset-to-1.0x behavior, and a follow-up story adds a configurable `variant_speed_ramp_bars` to `timing_params` with linear ramp-back.

### References

- Epic 6 spec — [Source: _bmad-output/planning-artifacts/epics.md#Epic 6]
- Story 6-3 — [Source: _bmad-output/implementation-artifacts/6-3-bend-camera-follow-eased-lerp-look-ahead.md]
- SceneManager clear/rebuild — [Source: static/game/SceneManager.js#L119-L149]
- WaveScheduler pause/resume — [Source: static/game/WaveScheduler.js]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- game_router.py: added `variant_breather_ms: 3000` to `timing_params` response
- SceneManager: added `_pendingTracks`, `_tracksLandedCb`, `_tracksLandedFired` state
- SceneManager: added `clearTracks()` (removes track lane meshes only, preserves activeWaves)
- SceneManager: added `spawnVariantTracks(newBaseFret, newNumLanes, speedPxMs)` — clears old tracks, spawns new at SPAWN_Z, sets up scroll-in animation
- SceneManager: added `areTracksLanded()`, `setOnTracksLanded(cb)` — callback fires once when all pending tracks reach targetZ
- SceneManager: pending tracks scroll in render() using dt-based motion; lands promote to `tracks` array
- SceneManager: `getActiveWaveCount()`, `getLastWaveSpeed()` exposed for main.js
- SceneManager: `reset()` clears pending track state
- main.js: added `_perFrameHook` pattern — called each RAF frame, used by breather timer
- main.js: breather listener now async — timer (variantBreatherMs) + wave-clearance gate; when both satisfied, spawns variant tracks then waits for tracks-landed callback
- main.js: `registerPhaseCleanup('breather', ...)` clears `_perFrameHook` on any breather exit
- Python contract test: added assertion for `variant_breather_ms == 3000` in timing_params
- 224 JS tests pass; 71 Python tests pass

### File List

- `services/game_router.py`
- `static/game/SceneManager.js`
- `static/game/main.js`
- `tests/contract/test_game_start.py`
- `_bmad-output/implementation-artifacts/6-4-post-bend-breather-and-new-scale-track-approach.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-25: Implemented story 6-4 — async breather with timer + wave-clearance gate, track scroll-in animation, clearTracks/spawnVariantTracks SceneManager API.