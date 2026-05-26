# Story 6.1: Accept-Gate State Machine & Soft Halt of Outgoing Scale

**Status:** review

**Epic:** 6 — Variant Transition Cinematic & Handoff
**Story ID:** 6-1
**Story Key:** 6-1-accept-gate-state-machine-soft-halt
**Depends on:** 5-8 (safe-zone-gated accept) — _Epic 5 closed; this story is the first scaffolding step for the Epic 6 cinematic._

---

## Context

### What ships today (post-5-8)

When the player plays `trigger_midi` while the variant safe zone is adjacent
(`scene.isVariantSafeZoneAdjacent()`), `main.js:540` calls `gameClient.acceptVariant(midi)`.
On success the handler **synchronously and instantly**:

1. Calls `scene.acceptVariantTracks(...)` — old track geometry replaced with the variant lane set.
2. Resets the run sequence cursor.
3. Calls `waveScheduler.reset(resp.notes, startIdx)` — outgoing-scale waves are wiped from the
   scheduler, new-scale waves start generating immediately.
4. Calls `scene.setWaves([], performance.now())` — in-flight wave meshes vanish from the scene.
5. Calls `safeZoneRenderer.reset()` — all primary safe zones disappear.

There is no transition phase. The visual swap is a one-frame cut: outgoing waves pop out, the
character has not yet moved onto the variant track, the new scale's waves spawn into the same
position the outgoing waves just vacated.

### What Epic 6 needs

Epic 6 turns this into a cinematic sequence: character rides the bend, camera follows,
outgoing waves clear naturally, a breather lets the player reposition, the new scale's tracks
arrive from the horizon, only then do new waves spawn. The state machine and soft-halt
introduced in this story are the load-bearing plumbing that **all subsequent Epic 6 stories
attach to**. This story changes no observable behavior — it inserts the seams.

### Why end-to-end behavior must still work after 6-1 alone

This story does NOT yet implement the cinematic. After 6-1, accept still produces the same
visible result as today (instant swap), but the swap is now driven through the new phase
state machine and hooks. The instant-swap behavior is preserved by synchronously progressing
through all phases (`accepted → riding → breather → promoting → active`) inside the accept
handler, with all phase-change hooks defaulting to no-ops. Stories 6-2 through 6-6 each
replace one synchronous phase transition with an asynchronous, hooked-in behavior.

---

## User Story

As an Epic 6 implementer,
I want a transition-phase state machine and a soft-halt mechanism on the wave scheduler
already wired into the accept handler with no-op hook points for every phase transition,
so that subsequent stories (6-2 character traversal, 6-3 camera follow, 6-4 breather,
6-5 backend promote, 6-6 wave activation) can each attach their behavior at a single
well-defined seam without re-touching the accept handler's control flow.

---

## Acceptance Criteria

**AC-1 — Transition phase enum exposed on game state:**
`GameState` (`static/game/GameState.js`) gains a `variant.transitionPhase` field with the
canonical enum `'idle' | 'proposed' | 'accepted' | 'riding' | 'breather' | 'promoting' | 'active'`,
exported as `TRANSITION_PHASES`. `window.__gameState.variant.transitionPhase` is written
whenever the phase changes. Initial value: `'idle'`. When a variant is proposed (existing
propose path in `main.js:614-624`), phase advances to `'proposed'`. On dismiss/timeout/missed,
phase returns to `'idle'`.

**AC-2 — Phase-change hook registry with cleanup:**
A single `setTransitionPhaseListener(cb)` function in `main.js` (or a new
`static/game/TransitionPhases.js` module) registers a callback fired on every phase change
with signature `cb(newPhase, prevPhase, ctx)` where `ctx` is an object containing any
phase-specific payload (variant id, scale info, scheduler reference, scene reference).
Multiple listeners supported (use an array). Listeners are called synchronously in
registration order; thrown errors are caught and logged so one bad listener cannot break
the transition.

`setTransitionPhase` also calls a `_cleanupPhase(prevPhase)` hook BEFORE firing listeners
for the new phase. Initially a no-op. Each downstream story registers phase-exit teardown
here: 6-2 clears the bend-midpoint callback on `riding` exit, 6-3 resets camera mode,
6-4 clears the breather timer. This guarantees cleanup even on dismiss/error paths
(`* → idle`).

Additionally, `setTransitionPhase` logs a `console.warn` if it detects a transition that
skips an expected intermediate phase (e.g., `idle → riding` without passing through
`accepted`). This is a non-blocking warning, not a rejection — the state machine is
permissive so error paths can always reach `idle`, but the warning catches silent
desynchronization bugs during development.

**AC-3 — `WaveScheduler.pauseQueueing()` / `resumeQueueing(notes, startIndex)`:**
`WaveScheduler.js` gains two methods:
- `pauseQueueing()` — sets an internal `_queueingPaused = true` flag. While paused,
  `tick()` MUST NOT generate new waves (the `while (this._nextDeadlineMs < ...)` block is
  skipped) but MUST still prune passed waves (`_waves.filter(...)` runs as today).
  In-flight waves continue to be exposed via `get waves()` and continue advancing in the
  render loop.
- `resumeQueueing(notes, startIndex = 0)` — replaces `_notes`, sets
  `_nextWaveNoteIndex = notes.length > 0 ? startIndex % notes.length : 0`, clears
  `_queueingPaused`. **Does NOT clear `_waves`** — in-flight outgoing-scale waves keep
  travelling alongside newly queued waves. `_nextDeadlineMs` is reset to
  `performance.now()` so the first new wave spawns one gap-interval after the next tick
  (gradual horizon appearance — unlike `reset()` which sets `_nextDeadlineMs = 0` and
  backfills waves immediately).
- Existing `reset(notes, startIndex)` method is preserved for restart/initial-setup paths
  and is NOT called from the accept handler anymore.

**AC-4 — Accept handler routed through listener-driven phase machine:**
In `main.js` (`onDetection` variant-accept branch, currently lines ~537–579), the
synchronous post-`acceptVariant` block is replaced by a `runAcceptTransition(resp)`
function that fires `setTransitionPhase('accepted', { resp })` ONLY. The rest of the
phase progression is driven by default listeners registered via
`setTransitionPhaseListener` — each phase's default handler triggers the next phase:

1. `setTransitionPhase('accepted', { resp })` — fires the `accepted` listener.
2. **Default `accepted` listener:** `waveScheduler.pauseQueueing()` — soft halt, then
   `setTransitionPhase('riding', { resp })`.
3. **Default `riding` listener:** immediately fires `setTransitionPhase('breather', { resp })`
   (no-op default; 6-2 replaces this with async bend-midpoint gating).
4. **Default `breather` listener:** immediately fires `setTransitionPhase('promoting', { resp })`
   (no-op default; 6-4 replaces this with timer+wave-clearance gating).
5. **Default `promoting` listener** (registered via `setTransitionPhaseListener` for
   `'promoting'` phase ONLY — NOT inline in `runAcceptTransition`):
   `scene.acceptVariantTracks(...)`, `run.sequence/cursor` update,
   `ascendingNoteCount` / `rootNote` / `apexNote` updates,
   `waveScheduler.resumeQueueing(resp.notes, startIdx)` (replaces today's `waveScheduler.reset`),
   `scene.setWaves([], performance.now())`, `safeZoneRenderer.reset()`, then
   `setTransitionPhase('active', { resp })`.
6. Variant tracking state reset (`shownVariantId`, `activeVariant`, `activeWindow`,
   `variantPendingSpawn`, `variantSpawnedForWave`) and `updateVariantHud()`.

After 6-1 all five phase transitions execute synchronously in one frame (each default listener
immediately fires the next phase) — behavior parity with today. Subsequent stories replace
individual default listeners without re-touching `runAcceptTransition`. Zero touchpoints on
the accept handler after 6-1.

**AC-5 — Soft-halt observable behavior:**
With `pauseQueueing()` engaged, no new wave objects are added to `WaveScheduler.waves`
across subsequent ticks; existing wave objects' `spawn_time_ms` and `duration_ms` are
unchanged; pruning still removes waves whose `spawn_time_ms + duration_ms < game_now - 10000`.
Unit test (`tests/unit/js/WaveScheduler.test.js` — extend existing or create) covers:
- `pauseQueueing()` → tick → `waves.length` unchanged from pre-tick count.
- `pauseQueueing()` → simulate 30 s elapsed → in-flight waves still present until they
  exceed prune threshold; no new waves appended.
- `resumeQueueing(newNotes, 0)` → tick → new waves spawn from `newNotes`; previously
  in-flight waves NOT removed.

**AC-6 — Backwards-compatible error / dismiss paths:**
The catch block on `acceptVariant` rejection (currently `main.js:541-549`) and the
`success:false` rejection block (currently `main.js:581-589`) both call
`setTransitionPhase('idle', { reason: 'accept-failed' })` and **must not** leave the
scheduler paused. If `pauseQueueing()` was called, reset via `resumeQueueing(currentNotes, run.cursor)`
where `currentNotes` is the run's existing sequence (no scale swap). The dismiss / miss
callbacks (`scene.setOnVariantMissed`, `gameClient.dismissVariant`) already set variant
state to null; extend them to also call `setTransitionPhase('idle', { reason: 'dismissed' | 'missed' })`.

**AC-7 — E2E parity, no regressions:**
`npx playwright test` — 73/73 chromium baseline (per 5-8 final run) still passes. Python
`pytest` — 71/71 still passes. `window.__gameState.variant` legacy fields
(`id`, `timerRunning`, `timerMs`, `timerExpired`, `safeZoneZ`) preserved unchanged.

**AC-8 — Test hooks for downstream stories:**
`window.__gameState.variant.transitionPhase` is the canonical synchronization point for
Epic 6 E2E tests. Story 6-7 will rely on it. Verify in a smoke E2E spec
(`tests/e2e/specs/epic6-transition-phases.spec.ts`, NEW) that triggering accept via
injected audio drives the phase through `proposed → accepted → riding → breather →
promoting → active` and lands on `'active'` within one frame (today) or within the
configured cinematic duration (after 6-2..6-6).

---

## Tasks / Subtasks

- [x] **Task 1 — Add transition phase enum + state field (AC-1)**
  - Edit `static/game/GameState.js`: export
    ```js
    export const TRANSITION_PHASES = {
      IDLE: 'idle', PROPOSED: 'proposed', ACCEPTED: 'accepted',
      RIDING: 'riding', BREATHER: 'breather', PROMOTING: 'promoting', ACTIVE: 'active',
    };
    ```
  - Initialise `window.__gameState.variant.transitionPhase = 'idle'` wherever variant state
    is first set in `main.js` (search for `window.__gameState.variant.id = null` initialisation).

- [x] **Task 2 — Phase listener registry + setter with cleanup (AC-2)**
  - Either inline in `main.js` (preferred — small surface) or in a new
    `static/game/TransitionPhases.js` module export:
    ```js
    const listeners = [];
    const _cleanup = [];
    export function setTransitionPhaseListener(cb) { listeners.push(cb); }
    export function registerPhaseCleanup(phase, cleanupFn) { _cleanup.push({ phase, fn: cleanupFn }); }
    let _phase = 'idle';
    export function setTransitionPhase(next, ctx = {}) {
      const prev = _phase;
      // Guardrail: warn on likely-bug transitions
      const ORDER = ['idle','proposed','accepted','riding','breather','promoting','active'];
      const prevIdx = ORDER.indexOf(prev);
      const nextIdx = ORDER.indexOf(next);
      if (next !== 'idle' && nextIdx >= 0 && prevIdx >= 0 && nextIdx > prevIdx + 1) {
        console.warn(`[transition-phase] skipping phases: ${prev} → ${next}`);
      }
      // Phase-exit cleanup (dismiss/error safe — always fires)
      for (const c of _cleanup) {
        if (c.phase === prev) {
          try { c.fn(); } catch (e) { console.error('[transition-phase] cleanup error', e); }
        }
      }
      _phase = next;
      if (window.__gameState) window.__gameState.variant.transitionPhase = next;
      for (const cb of listeners) {
        try { cb(next, prev, ctx); }
        catch (e) { console.error('[transition-phase] listener error', e); }
      }
    }
    export function currentTransitionPhase() { return _phase; }
    ```
  - Wire `setTransitionPhase('proposed', { variant: resp.variant })` into the existing
    propose-success block (`main.js:621-624`).
  - Wire `setTransitionPhase('idle', { reason })` into the dismiss callback
    (`main.js:515-525`), the propose-error path, and the polling-driven dismiss
    (search for blocks that set `activeVariant = null` in the poll handler around `main.js:678`).

- [x] **Task 3 — `WaveScheduler.pauseQueueing` / `resumeQueueing` (AC-3, AC-5)**
  - Edit `static/game/WaveScheduler.js`:
    - Add `this._queueingPaused = false;` to constructor.
    - In `tick(game_now, speedMultiplier)`, wrap the `while (...)` block:
      ```js
      if (!this._queueingPaused) {
        while (this._nextDeadlineMs < game_now + wave_lookahead_ms) { ... }
      }
      ```
      Pruning remains unconditional.
    - Add methods:
      ```js
      pauseQueueing() { this._queueingPaused = true; }
      resumeQueueing(notes, startIndex = 0) {
        this._notes = notes;
        this._nextWaveNoteIndex = notes.length > 0 ? startIndex % notes.length : 0;
        this._nextDeadlineMs = performance.now();
        this._queueingPaused = false;
      }
      get queueingPaused() { return this._queueingPaused; }
      ```
  - **Do not modify** `reset()` — keep it for restart paths.

- [x] **Task 4 — Refactor accept handler into `runAcceptTransition` (AC-4, AC-6)**
  - In `main.js`, extract the body of the `if (resp && resp.success)` block
    (lines ~550-579) into a new local function `runAcceptTransition(resp)`.
  - Replace its body with ONLY: `setTransitionPhase('accepted', { resp })`.
  - Register default listeners (each triggers the next phase, making the synchronous
    waterfall emergent from default behavior):
    - **`accepted` listener:** calls `waveScheduler.pauseQueueing()`, then
      `setTransitionPhase('riding', { resp })`.
    - **`riding` listener (default):** immediately calls `setTransitionPhase('breather', { resp })`.
    - **`breather` listener (default):** immediately calls `setTransitionPhase('promoting', { resp })`.
    - **`promoting` listener (default):** performs today's swap actions
      (`scene.acceptVariantTracks(...)`, `run.sequence/cursor` update, `ascendingNoteCount` /
      `rootNote` / `apexNote` updates, `waveScheduler.resumeQueueing(resp.notes, startIdx)`,
      `scene.setWaves([], performance.now())`, `safeZoneRenderer.reset()`), then calls
      `setTransitionPhase('active', { resp })`.
    - **`active` listener (default):** resets variant tracking state and calls `updateVariantHud()`.
  - In the catch block and the `success:false` block, add cleanup: if
    `waveScheduler.queueingPaused === true`, call
    `waveScheduler.resumeQueueing(run.sequence, run.cursor)` to restore outgoing-scale
    queuing, then `setTransitionPhase('idle', { reason })`.
    The phase-exit cleanup in `setTransitionPhase` guarantees per-frame callbacks and camera
    state are torn down on any `* → idle` transition, even mid-cinematic.

- [x] **Task 5 — Unit tests for soft halt (AC-5)**
  - Create or extend `tests/unit/js/WaveScheduler.test.js`:
    - Construct scheduler, run several ticks → record wave count.
    - Call `pauseQueueing()`; advance `game_now` by 5 × `base_duration_ms`; tick →
      assert wave count unchanged.
    - Continue advancing past prune threshold (10 s + duration); tick → assert old
      waves pruned, no new waves added.
    - Call `resumeQueueing(newNotes, 2)` with a different notes array; tick → assert
      new waves spawn with notes from `newNotes` starting at index 2; assert any
      surviving pre-pause waves are still present.
  - Run `node --test tests/unit/js/WaveScheduler.test.js` (or whatever runner this
    project uses for JS unit tests — check existing `tests/unit/js/*.test.js`).

- [x] **Task 6 — Smoke E2E for phase progression (AC-7, AC-8)**
  - Create `tests/e2e/specs/epic6-transition-phases.spec.ts`:
    - Start a game, inject audio for the propose-trigger note, wait for
      `window.__gameState.variant.transitionPhase === 'proposed'`.
    - Wait for `window.__gameState.variant.safeZoneZ` adjacency (existing 5-8 pattern).
    - Inject audio for `activeWindow.trigger_midi`.
    - Assert the phase reaches `'active'` (today: same frame; later stories: within N ms).
    - Assert no console errors throughout.
  - Run `npx playwright test tests/e2e/specs/epic6-transition-phases.spec.ts` against
    the Slopsmith Docker stack at `localhost:8000`.

- [x] **Task 7 — Full test suite parity (AC-7)**
  - `.venv/Scripts/python.exe -m pytest` → 71/71 pass.
  - `npx playwright test` (chromium project) → 73/73 + new smoke = 74/74 pass.

---

## Dev Notes

### This story changes no observable behavior

After 6-1, the accept-to-swap sequence still happens in one frame. The cinematic feel
comes in 6-2 (character traversal), 6-3 (camera), 6-4 (breather), 6-5 (backend promote
endpoint), 6-6 (wave activation). 6-1's value is structural: every downstream story
attaches at `setTransitionPhaseListener` without re-touching the accept handler.

### Why soft-halt (`pauseQueueing`) instead of just letting `reset` keep working

Today's `reset()` clears `_waves` outright, then in-flight wave meshes are wiped from the
scene via `scene.setWaves([], performance.now())`. Epic 6 spec says outgoing waves must
continue travelling until off-frame. `pauseQueueing` is the mechanism that allows
existing waves to coexist with the (eventual) deferred new-scale spawn. In 6-1 the
old behavior is preserved because the `scene.setWaves([], ...)` call still runs at the
end (in the default `promoting → active` handler). Story 6-4/6-6 will remove that wipe
and let the prune timer naturally retire outgoing waves while the new scale spawns
alongside them.

### Why `pauseQueueing` keeps pruning

Pruning is a memory-management concern, not a gameplay one. Wave objects past the prune
threshold (10 s after off-screen) hold scene-mesh references through the
`scene.setWaves` consumer. Continuing to prune while paused prevents unbounded growth
during a long cinematic.

### Why `resumeQueueing` does NOT clear `_waves`

`reset()` clears `_waves` because restart/initial-setup wants a clean slate. The Epic 6
transition wants to layer: old waves are still present and visible; new waves start
spawning from the horizon. Same scheduler, two cohorts of waves coexisting briefly.

### Phase progression direction

The enum is ordered. `setTransitionPhase` does NOT enforce a state-graph (e.g., can't
go `idle → active` directly) in 6-1 — keep it permissive. Validate transitions in a
later story if it becomes a maintenance issue. Going `* → 'idle'` must always be
allowed (used by dismiss/error paths).

### Where existing variant state lives

- `activeVariant`, `activeWindow`, `shownVariantId`, `variantPendingSpawn`,
  `variantSpawnedForWave` — module-locals in `main.js` (around lines 287-295).
- `window.__gameState.variant.{id, timerRunning, timerMs, timerExpired, safeZoneZ}` —
  set by main.js (id/timer fields) and SceneManager.js (safeZoneZ).
- This story adds `window.__gameState.variant.transitionPhase` to that bridge.

### Files to read before editing

- `static/game/GameState.js` (whole file — small)
- `static/game/WaveScheduler.js` (whole file — 64 lines)
- `static/game/main.js` lines 280–700 (variant state init, accept handler, propose path,
  dismiss callback, poll handler)
- `static/game/SceneManager.js:100-220` (variant geometry / safe zone — read-only for context;
  not modified in 6-1)
- `tests/unit/js/` (existing test runner conventions — check for `node --test` vs other)

### Do NOT touch in 6-1

- `services/game_engine.py` — backend protocol change is scope of 6-5
  (`POST /variant/promote`). Today's `accept_variant` keeps its existing behavior of
  immediately swapping the primary scale; 6-5 will split that.
- `SceneManager.js` variant geometry (`proposeVariantTracks`, `acceptVariantTracks`,
  `clearVariantGeom`) — 6-2 and 6-3 will modify these for character traversal and
  camera follow.
- `SafeZoneRenderer.js` — unchanged.
- `WaveScheduler.reset()` — preserved for restart paths.

### References

- Epic 6 spec — [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Variant Transition Cinematic & Handoff]
- Story 5-8 (safe-zone-gated accept, current state of variant lifecycle) — [Source: _bmad-output/implementation-artifacts/5-8-safe-zone-gated-track-switching.md]
- `WaveScheduler` baseline — [Source: static/game/WaveScheduler.js]
- Current accept handler — [Source: static/game/main.js#L530-L590]
- Variant propose path (sets `'proposed'` phase entry) — [Source: static/game/main.js#L614-L640]
- Dismiss callback (sets `'idle'` phase) — [Source: static/game/main.js#L515-L525]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- TRANSITION_PHASES enum added to GameState.js
- New TransitionPhases.js module with listener registry, cleanup registry, phase setter, and phase guardrail warnings
- WaveScheduler.pauseQueueing() / resumeQueueing() / queueingPaused getter added; reset() preserved unchanged
- main.js: imports TransitionPhases, adds transitionPhase to __gameState.variant, registers 5 default phase listeners (accepted→riding→breather→promoting→active) inside start() after waveScheduler creation
- runAcceptTransition(resp) fires setTransitionPhase('accepted', { resp }) only; all subsequent transitions driven by listeners
- Accept handler catch block + success:false block both call setTransitionPhase('idle') and resume scheduler if paused
- Miss callback + poll-driven dismiss also set phase to 'idle'
- Propose success block calls setTransitionPhase('proposed', ...)
- _test.triggerVariantAccept hook added for E2E smoke testing
- All 215 unit tests pass; 71 Python tests pass

### File List

- `static/game/GameState.js`
- `static/game/TransitionPhases.js` (NEW)
- `static/game/WaveScheduler.js`
- `static/game/main.js`
- `tests/unit/js/WaveScheduler.test.js`
- `tests/e2e/specs/epic6-transition-phases.spec.ts` (NEW)
- `_bmad-output/implementation-artifacts/6-1-accept-gate-state-machine-soft-halt.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-25: Implemented story 6-1 — transition phase state machine, WaveScheduler soft halt, accept handler refactored into runAcceptTransition with listener-driven phase waterfall. All tests pass.
