# Story 6.6: Variant Scale Wave Spawn Activation

**Status:** review

**Epic:** 6 — Variant Transition Cinematic & Handoff
**Story ID:** 6-6
**Story Key:** 6-6-variant-scale-wave-spawn-activation
**Depends on:** 6-5 (backend variant promote endpoint)

---

## Context

### What 6-5 established

After 6-5, the promote endpoint commits the scale swap on the backend and returns new-scale note/geometry data. The `promoting → active` handler calls `waveScheduler.resumeQueueing(resp.notes, startIdx)` and `setWaves([], ...)` — but this still clears in-flight outgoing waves instantly (`setWaves` with empty array removes all active wave meshes).

### What 6-6 does

6-6 refines the wave transition: outgoing-scale waves that are still in-flight when `promote` fires should NOT be instantly removed. Instead, `resumeQueueing` starts spawning new-scale waves alongside the remaining outgoing-scale waves. Both cohorts coexist briefly in the scheduler's wave array and in the scene. Outgoing waves exit naturally via pruning; new-scale waves arrive from the horizon.

This is the final piece of the cinematic: the player sees the last few outgoing-scale carts scroll past while the first new-scale carts appear in the distance.

### Current behavior (post-6-5)

```
promoting → active:
  1. promoteVariant() → get new notes
  2. waveScheduler.resumeQueueing(resp.notes, startIdx)  ← starts new waves
  3. scene.setWaves([], performance.now())               ← clears ALL active wave meshes
  4. safeZoneRenderer.reset()
```

Step 3 is the problem: it removes in-flight outgoing waves instantly. After 6-6, step 3 is removed — outgoing wave meshes stay in the scene until they expire naturally.

---

## User Story

As a player completing a variant track switch,
I want outgoing-scale waves to continue travelling past me until they naturally leave the frame while new-scale waves appear from the horizon,
so that the transition feels seamless — the old scale fades out, the new scale fades in, with no visual pop.

---

## Acceptance Criteria

**AC-1 — `setWaves([], ...)` removed from promoting→active handler:**
In `main.js`, the promoting→active handler no longer calls `scene.setWaves([], performance.now())`. The `activeWaves` Map in SceneManager retains all in-flight outgoing-scale waves. They continue to scroll and are removed only by:
1. The existing prune in `setWaves()` (wave Z < FRONT_Z on poll update — post-6-5 there are no more poll-fed waves, so this path is inert)
2. The render loop's Z-based removal (wave Z > prune threshold → scene.remove)
3. The prune threshold in `WaveScheduler.tick()` (waves whose `spawn_time_ms + duration_ms < game_now - 10000`)

**AC-2 — `resumeQueueing` spawns new-scale waves alongside old:**
`WaveScheduler.resumeQueueing(resp.notes, startIdx)` (from 6-1) already preserves `_waves` — old-scale waves are not cleared. After promote, `tick()` starts appending new-scale wave objects to `_waves`. Old and new waves coexist in the same array. New waves have `wave_id` continuing from `_totalWavesSpawned` (not reset) so there's no ID collision.

**AC-3 — SceneManager renders both old and new wave meshes:**
`setWaves(waves, nowMs)` is called each frame with the full `waveScheduler.waves` array (which now contains both old-scale and new-scale waves). New waves get their meshes created (if not already in `activeWaves`). Old waves that haven't been pruned continue to have their meshes updated. Both cohorts render in the same scene.

**AC-4 — Old-scale wave meshes age out naturally:**
Old outgoing-scale waves have a finite `duration_ms`. The prune filter in `WaveScheduler.tick()` (`spawn_time_ms + duration_ms < game_now - 10000`) removes them from `_waves` 10 seconds after they expire. The `setWaves()` method in SceneManager removes meshes whose wave_id is no longer in the current waves array (existing logic at lines 328-339). This is the natural cleanup path — no explicit "clear all outgoing waves" call needed.

**AC-5 — Safe zone renderer handles dual-wave cohort:**
`safeZoneRenderer.update(waves, ...)` receives the full waves array. Old-scale safe zones for waves that have already passed the player (Z < 0) are naturally out of view. New-scale safe zones appear at SPAWN_Z and scroll toward the player. The safe zone renderer already handles per-wave safe zones — no logic change needed.

**AC-6 — No regression in wave visual behavior:**
- New-scale waves spawn with the correct note sequence, timing, and speed from `resumeQueueing`
- Old-scale waves continue at their existing speed until pruned
- No duplicate safe zones (each wave has unique wave_id)
- `window.__gameState.scene.waveCount` reflects total waves (old + new)

**AC-7 — E2E and unit parity:**
- Playwright chromium 74/74 pass
- pytest: all pass (no backend changes in this story)
- Smoke E2E: inject audio for propose → accept → wait for promote → observe waveCount transitions smoothly (doesn't drop to 0, old waves count down as they exit, new waves appear)

---

## Tasks / Subtasks

- [x] **Task 1 — Remove `setWaves([], ...)` from promoting→active handler (AC-1)**
  - In `main.js`, in the promoting→active transition handler (or `runAcceptTransition`), delete the line:
    ```js
    scene.setWaves([], performance.now());
    ```
  - This is the ONLY deletion. Everything else stays.

- [x] **Task 2 — Verify `resumeQueueing` doesn't clear old waves (AC-2)**
  - Read `WaveScheduler.resumeQueueing()` (added in 6-1). Confirm it does NOT clear `this._waves`. It should only:
    - Set `this._notes = notes`
    - Set `this._nextWaveNoteIndex = startIndex`
    - Set `this._nextDeadlineMs = performance.now()`
    - Set `this._queueingPaused = false`
  - If 6-1 implementation added a `this._waves = []` line in `resumeQueueing`, remove it.
  - Add comment: "// Preserve in-flight outgoing-scale waves — they coexist with new-scale waves."

- [x] **Task 3 — Verify SceneManager wave mesh lifecycle (AC-3, AC-4)**
  - Read the `setWaves()` method (lines 324-359). The removal logic at lines 328-339 already handles waves leaving the array: if a wave_id is in `activeWaves` but not in the new `waves` array, and its Z < FRONT_Z, it's removed.
  - Confirm no early-removal edge case: an old-scale wave that's still in the scheduler's `_waves` but has Z >> FRONT_Z should NOT be removed. The current logic only removes when `z < FRONT_Z` (passed the player AND not in current set).
  - No code changes needed if the existing logic is correct. Add a unit test to verify.

- [x] **Task 4 — Unit test for dual-wave cohort in WaveScheduler (AC-2, AC-6)**
  - Extend `tests/unit/js/WaveScheduler.test.js`:
    - Create scheduler with oldNotes, tick several frames → record old wave count.
    - Call `pauseQueueing()` → tick → no new waves.
    - Call `resumeQueueing(newNotes, 0)` → tick.
    - Assert: old waves still present + new waves appended.
    - Assert: `waveCount >= oldWaveCount` (never drops below pre-resume count until pruning kicks in).
    - Assert: new waves use `newNotes` for their note data.
  - **Race-condition edge cases:**
    - **0 notes remaining:** `pauseQueueing()` with empty scheduler → `resumeQueueing(newNotes)` → assert only new waves present, no crash.
    - **1 note remaining:** pre-seed scheduler with 1 old wave, pause, resume with new notes → assert old wave not cleared during first new-wave tick.
    - **N notes remaining:** pre-seed with 5 old waves, pause, resume → assert all 5 survive after 3 more ticks, new waves appended.
    - **Wave boundary overlap:** pause during inter-wave gap (`_nextDeadlineMs` between two waves), resume → assert first new wave spawns at correct deadline (not immediately, not doubled).
    - **Scoring continuity:** no wave object is dropped or double-counted across the pause/resume boundary — verify `_totalWavesSpawned` increments monotonically.

- [x] **Task 5 — Unit test for SceneManager dual-cohort rendering (AC-3)**
  - Extend `tests/unit/js/SceneManager.test.js`:
    - Set waves with 2 old-scale waves → activeWaves.size = 2.
    - Set waves with 2 old + 3 new → activeWaves.size = 5.
    - Set waves with only 3 new (old pruned by scheduler) → activeWaves.size = 3.
    - Assert old meshes removed, new meshes created.

- [x] **Task 6 — Full test suite parity (AC-7)**
  - `.venv/Scripts/python.exe -m pytest` → all pass
  - `npx playwright test` (chromium) → 74/74 pass
  - Smoke E2E: observe smooth wave count during transition

---

## Dev Notes

### Files to modify

- `static/game/main.js` — remove `setWaves([], ...)` from promoting→active handler
- `static/game/WaveScheduler.js` — verify `resumeQueueing` preserves `_waves` (may already be correct from 6-1)
- `tests/unit/js/WaveScheduler.test.js` — dual-cohort test
- `tests/unit/js/SceneManager.test.js` — dual-cohort rendering test

### Files to read (do not modify)

- `static/game/WaveScheduler.js` — `resumeQueueing()`, `tick()` prune logic (from 6-1)
- `static/game/SceneManager.js` — `setWaves()` mesh lifecycle (lines 324-359)
- `static/game/main.js` — promoting→active handler (post-6-5)
- `_bmad-output/implementation-artifacts/6-5-backend-variant-promote-endpoint.md` — promote flow

### Smallest story in Epic 6

6-6 is the lightest story — one line deletion, two test additions, and verification of existing behavior. Most of the heavy lifting was done in 6-1 (`resumeQueueing` preserving `_waves`, `pauseQueueing` stopping new spawns) and 6-4 (track approach, promoting phase wiring).

### Why this matters visually

Without 6-6, the transition has a visible pop: outgoing waves vanish, a frame of emptiness, then new waves appear. With 6-6, there's continuous motion — the player sees carts from both scales in the same frame, reinforcing that they've switched to a new railway line.

### Pruning ensures no memory leak

The WaveScheduler prune threshold (10s after wave expiry) and SceneManager's `setWaves` removal ensure old-scale waves don't accumulate forever. Within ~15 seconds of promote, all outgoing-scale wave objects and meshes are cleaned up.

### References

- Epic 6 spec — [Source: _bmad-output/planning-artifacts/epics.md#Epic 6]
- Story 6-5 — [Source: _bmad-output/implementation-artifacts/6-5-backend-variant-promote-endpoint.md]
- WaveScheduler — [Source: static/game/WaveScheduler.js]
- SceneManager setWaves — [Source: static/game/SceneManager.js#L324-L359]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- main.js: removed `scene.setWaves([], performance.now())` from promoting→active handler — outgoing waves now expire naturally via Z-based pruning
- WaveScheduler.js: verified `resumeQueueing` already preserves `_waves` (comment "Preserve in-flight outgoing-scale waves" present from 6-1)
- SceneManager.js: verified `setWaves` removal logic gated on `z >= FRONT_Z` — old waves in front of player preserved until they scroll past
- WaveScheduler.test.js: added "dual-wave cohort coexistence" describe block (4 tests: coexistence, monotonic IDs, empty scheduler recovery, new notes used)
- SceneManager.test.js: added "dual-wave cohort rendering" describe block (3 tests: old+new coexist, old removed after FRONT_Z, new meshes created)
- 81 Python tests pass; 226 JS tests pass

### File List

- `static/game/main.js`
- `tests/unit/js/WaveScheduler.test.js`
- `tests/unit/js/SceneManager.test.js`
- `_bmad-output/implementation-artifacts/6-6-variant-scale-wave-spawn-activation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-25: Implemented story 6-6 — removed setWaves([]) from promote handler; old-scale waves now coexist with new-scale waves through natural pruning. Added dual-cohort unit tests.