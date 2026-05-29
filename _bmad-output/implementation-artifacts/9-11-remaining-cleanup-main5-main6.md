# Story 9.11: Duplicate Promote Paths Consolidation & Dual Pause UI Cleanup

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-11
**Story Key:** 9-11-remaining-cleanup-main5-main6
**Depends on:** 9-10 (dead code removal and constant consolidation complete)

---

## Context

Story 9-9 produced `_bmad-output/implementation-artifacts/refactor-findings.md` with prioritised findings. Story 9-10 implemented all Low-risk findings (dead code removal, constant consolidation, backend cleanup, texture caching, `gameNow()` helper). This story implements the **medium-risk code-level findings** that were explicitly deferred from 9-10:

- **MAIN-5** — Duplicate promote paths: `promoting` phase listener (~696–742) and `applyPromoteResponse` (~615–662) contain near-identical logic for applying a variant promote response. Consolidate into a shared helper.
- **MAIN-6** — Dual pause UI: `pauseBtn` (legacy DOM element, line 282) and `pauseButton` (HudShell `PauseButton` component, line 294) both trigger `pauseGame()`/`resumeGame()`. Consolidate to the HudShell `PauseButton` exclusively and remove the legacy DOM pause button.

The larger SceneManager decomposition (SM-1 through SM-7) and TransitionOrchestrator extraction (MAIN-1/2) remain deferred to a future epic.

---

## User Story

As a **developer**,
I want duplicate promote-path logic consolidated into one shared helper and the dual pause mechanism unified under HudShell,
so that the codebase has fewer latent bugs from diverging paths and one fewer legacy DOM element to maintain.

---

## Acceptance Criteria

### AC-1 — Duplicate promote paths consolidated

**Given** `static/game/main.js` currently has two paths that call `gameClient.promoteVariant()` and apply the response:
- The `applyPromoteResponse` function (lines ~615–662) — called from `onDiagComplete` after cinematic exit
- The `'promoting'` phase listener callback (lines ~696–742) — called from breather path

**When** this story is applied,

**Then** both paths call a single shared function `_applyPromoteResponse(resp, ctx)` (or equivalent name)

**And** the shared function contains:
- `run.sequence` / `run.cursor` update from `resp.notes` / `resp.current_note_index`
- `ascendingNoteCount` / `rootNote` / `apexNote` update
- `variantController.ascendingNoteCount` sync
- `scene.moveToTrack(resp.current_track)`
- `scene.setLaneGeometry(resp.base_fret, resp.num_lanes)`
- `pushGameEvent('variant.promote', ...)`
- `_debugLogger.log('variant.promote', ...)`
- `poller._speedMultiplier` sync
- `fretBox.render(resp)`
- `setTransitionPhase('active', ctx)`

**And** the following path-specific differences are preserved:
- **Riding path** (via `applyPromoteResponse` / `onDiagComplete`): calls `scene.clearCinematicExit()`, `scene.setTargetCameraX()`, `scene.ghostExistingWaves()`, `scene.finalizeVariantTransition()`, `scene.setCharacterX()` (via `moveToTrack`) — **NO** `waveScheduler.resumeQueueing()` call (already pre-staged at corner-fire), **NO** `safeZoneRenderer.reset()` call
- **Breather path** (via `promoting` listener): calls `waveScheduler.resumeQueueing(resp.notes, startIdx, ...)`, `safeZoneRenderer.reset()` — does NOT call `scene.clearCinematicExit()`, `scene.ghostExistingWaves()`, or `scene.finalizeVariantTransition()`

**And** the shared function does not contain any `<script>` import changes — it remains a closure inside `start()` like both original paths.

### AC-2 — Legacy `pauseBtn` DOM element removed

**Given** `static/game/main.js` has two pause mechanisms:
- `pauseBtn` (line ~282): legacy DOM `<button>` with class `pause-btn`, appended to `.hud` div
- `pauseButton` (line ~294): HudShell `PauseButton` component, registered via `hudShell.registerChild`

**When** this story is applied,

**Then:**
- The `const pauseBtn = el('button', ...)` declaration at line ~282 is removed
- `hud.appendChild(pauseBtn)` at line ~285 is removed
- `pauseBtn.classList.remove('hidden')` at line ~913 is removed
- `pauseBtn.classList.add('hidden')` at line ~987 is removed
- `pauseBtn.textContent = 'Resume'` at line ~162 is removed (inside `pauseGame()`)
- `pauseBtn.textContent = 'Pause'` at line ~187 is removed (inside `resumeGame()`)
- `pauseBtn.textContent = 'Resume'` at line ~1152 is removed (inside blur handler)
- `pauseBtn.addEventListener('click', ...)` block at lines ~1138–1146 is removed
- `pauseBtn` reference in `window.__gameState._test.triggerPause` (lines ~1029–1037) is verified to work with the HudShell pauseButton instead

### AC-3 — Blur handler uses HudShell pause mechanism

**Given** the `window.addEventListener('blur', ...)` handler (lines ~1148–1154) currently sets `pauseBtn.textContent` directly,

**When** this story is applied,

**Then** the blur handler calls `pauseGame()` (which already handles all state transitions) instead of manually setting text content

**And** the blur handler no longer directly references `pauseBtn`

### AC-4 — `_test.triggerPause` works via HudShell

**Given** `window.__gameState._test.triggerPause` (lines ~1029–1037) currently calls `pauseGame()` / `resumeGame()` directly,

**When** this story is applied,

**Then** `triggerPause` continues to work identically — these functions are unaffected by the `pauseBtn` removal (they only call `pauseGame()` and `resumeGame()`, not the button)

**And** no test hook functionality is lost

### AC-5 — All tests pass

**Given** the changes above,

**When** the full test suite runs (`pytest`),

**Then** zero regressions. The Playwright E2E suite (if runnable) passes or was already skipped before this story.

### AC-6 — No production code changed beyond what's specified

**Given** the scope of this story,

**When** the story is complete,

**Then** no files outside `static/game/main.js` are modified (this is a main.js-only cleanup).

---

## Tasks / Subtasks

- [x] **T1 — Extract shared `_applyPromoteResponse` helper (AC-1)**
  - [x] Identify the common operations between `applyPromoteResponse` (~615–662) and the `promoting` listener (~696–742)
  - [x] Extract to a local function `function _applyPromoteResponse(resp, ctx) { ... }` inside `start()`
  - [x] Keep path-specific differences:
    - Riding path: `scene.clearCinematicExit()`, `scene.ghostExistingWaves()`, `scene.finalizeVariantTransition()` before shared helper
    - Breather path: `waveScheduler.resumeQueueing(notes, startIdx, ...)`, `safeZoneRenderer.reset()` after shared helper
  - [x] Replace `applyPromoteResponse(resp, ctx)` call at line ~611 with shared helper + riding-specific calls
  - [x] Replace the `promoting` listener's inline response block with shared helper + breather-specific calls
  - [x] Run `pytest` to verify no regressions

- [x] **T2 — Verify path-specific differences are preserved**
  - [x] Confirm riding path does NOT call `waveScheduler.resumeQueueing()` or `safeZoneRenderer.reset()`
  - [x] Confirm breather path does NOT call `scene.clearCinematicExit()` or `scene.ghostExistingWaves()`
  - [x] Trace the cinematic exit sequence to ensure `setCharacterX` / `moveToTrack` still fires correctly

- [x] **T3 — Remove legacy `pauseBtn` DOM element (AC-2)**
  - [x] Remove `const pauseBtn = el('button', { class: 'pause-btn hidden' }, 'Pause')` declaration
  - [x] Remove `hud.appendChild(pauseBtn)`
  - [x] Remove all `pauseBtn.textContent` assignments (pauseGame, resumeGame, blur handler)
  - [x] Remove `pauseBtn.classList` calls (.hidden toggles)
  - [x] Remove `pauseBtn.addEventListener('click', ...)` block
  - [x] Verify `pauseGame()` and `resumeGame()` work without `pauseBtn` reference — they use `hudShell.onPhaseChange(PHASES.PAUSED)` for HUD state, and the overlay manager for UI

- [x] **T4 — Update blur handler to use `pauseGame()` (AC-3)**
  - [x] Replace manual `pauseBtn.textContent = 'Resume'` with `pauseGame()` call in blur handler
  - [x] `pauseGame()` already calls `run.pause()`, `audio.pause()`, `hudShell.onPhaseChange()`, `gameClient.pause()`, and `overlayMgr.show()` — no other changes needed

- [x] **T5 — Verify test hooks (AC-4)**
  - [x] Confirm `window.__gameState._test.triggerPause` still works — it calls `pauseGame()` and `resumeGame()` directly, not the button
  - [x] Confirm `window.__gameState._test.forceCollision` and `setVariant` hooks unaffected
  - [x] Run `pytest` to verify no regressions

- [x] **T6 — Full test suite validation (AC-5)**
  - [x] Run `pytest` — verify all tests pass (81 passed, 1 pre-existing unrelated failure in test_get_scales_ok)

---

## Dev Notes

### MAIN-5: Shared helper extraction details

Current state — `applyPromoteResponse` (riding path):
```js
function applyPromoteResponse(resp, ctx) {
  scene.clearCinematicExit?.();
  scene.setTargetCameraX?.(scene.getWorldOffsetX?.() ?? 0);
  scene.ghostExistingWaves?.();
  scene.finalizeVariantTransition?.();
  const startIdx = resp.current_note_index ?? 0;
  if (run && resp.notes) {
    run.sequence = resp.notes;
    run.cursor = startIdx;
    setExpected();
  }
  if (resp.ascending_note_count != null) {
    ascendingNoteCount = resp.ascending_note_count;
    variantController.ascendingNoteCount = ascendingNoteCount;
  }
  if (resp.notes) {
    rootNote = resp.notes[0] ?? null;
    apexNote = ascendingNoteCount > 0 ? resp.notes[ascendingNoteCount - 1] : null;
  }
  if (resp.current_track != null) {
    scene.moveToTrack(resp.current_track, true);
  }
  if (resp.base_fret != null && resp.num_lanes != null) {
    scene.setLaneGeometry(resp.base_fret, resp.num_lanes);
  }
  pushGameEvent('variant.promote', { ... });
  if (_debugLogger) _debugLogger.log('variant.promote', { ... });
  if (resp.speed_multiplier != null && poller) {
    poller._speedMultiplier = resp.speed_multiplier;
  }
  if (resp.notes) fretBox.render(resp);
  setTransitionPhase('active', ctx);
}
```

Current state — promoting listener inline block (breather path):
```js
const startIdx = resp.current_note_index ?? 0;
if (run && resp.notes) {
  run.sequence = resp.notes;
  run.cursor = startIdx;
  setExpected();
}
if (resp.ascending_note_count != null) {
  ascendingNoteCount = resp.ascending_note_count;
  variantController.ascendingNoteCount = ascendingNoteCount;
}
if (resp.notes) {
  rootNote = resp.notes[0] ?? null;
  apexNote = ascendingNoteCount > 0 ? resp.notes[ascendingNote_count - 1] : null;
  waveScheduler.resumeQueueing(resp.notes, startIdx, resp.base_fret, resp.num_lanes, gameNow());
}
if (resp.current_track != null) {
  scene.moveToTrack(resp.current_track, true);
}
if (resp.base_fret != null && resp.num_lanes != null) {
  scene.setLaneGeometry(resp.base_fret, resp.num_lanes);
}
pushGameEvent('variant.promote', { ... });
if (_debugLogger) _debugLogger.log('variant.promote', { ... });
safeZoneRenderer.reset();
if (resp.notes) fretBox.render(resp);
if (resp.speed_multiplier != null && poller) {
  poller._speedMultiplier = resp.speed_multiplier;
}
setTransitionPhase('active', ctx);
```

Shared `_applyPromoteResponse(resp, ctx)` body:
```js
const startIdx = resp.current_note_index ?? 0;
if (run && resp.notes) {
  run.sequence = resp.notes;
  run.cursor = startIdx;
  setExpected();
}
if (resp.ascending_note_count != null) {
  ascendingNoteCount = resp.ascending_note_count;
  variantController.ascendingNoteCount = ascendingNoteCount;
}
if (resp.notes) {
  rootNote = resp.notes[0] ?? null;
  apexNote = ascendingNoteCount > 0 ? resp.notes[ascendingNoteCount - 1] : null;
}
if (resp.current_track != null) {
  scene.moveToTrack(resp.current_track, true);
}
if (resp.base_fret != null && resp.num_lanes != null) {
  scene.setLaneGeometry(resp.base_fret, resp.num_lanes);
}
pushGameEvent('variant.promote', {
  base_fret: resp.base_fret, num_lanes: resp.num_lanes, note_index: startIdx,
});
if (_debugLogger) _debugLogger.log('variant.promote', {
  base_fret: resp.base_fret, num_lanes: resp.num_lanes,
  note_index: startIdx, current_track: resp.current_track,
});
if (resp.speed_multiplier != null && poller) {
  poller._speedMultiplier = resp.speed_multiplier;
}
if (resp.notes) fretBox.render(resp);
setTransitionPhase('active', ctx);
```

Riding path after extraction:
```js
function applyPromoteResponse(resp, ctx) {
  scene.clearCinematicExit?.();
  scene.setTargetCameraX?.(scene.getWorldOffsetX?.() ?? 0);
  scene.ghostExistingWaves?.();
  scene.finalizeVariantTransition?.();
  _applyPromoteResponse(resp, ctx);
}
```

Breather path after extraction:
```js
// Inside 'promoting' listener:
.applyPromoteResponse(resp, ctx) // ... inside .then()
if (resp.notes) waveScheduler.resumeQueueing(resp.notes, startIdx, ...);
safeZoneRenderer.reset();
_applyPromoteResponse(resp, ctx);
```

### MAIN-6: pauseBtn removal safety

`pauseBtn` references to remove (grep first to confirm):
- Declaration + usage in DOM building (lines 282, 285)
- `pauseGame()` body: `pauseBtn.textContent = 'Resume'` (line 162)
- `resumeGame()` body: `pauseBtn.textContent = 'Pause'` (line 187)
- RAF loop: `pauseBtn.classList.remove('hidden')` (line 913)
- `cleanup()`: `pauseBtn.classList.add('hidden')` (line 987)
- Event listener: `pauseBtn.addEventListener('click', ...)` (lines 1138–1146)
- Blur handler: `pauseBtn.textContent = 'Resume'` (line 1152) — replace with `pauseGame()` call

What stays:
- `pauseButton = new PauseButton(hudShell, () => pauseGame())` (line 294) — HudShell component
- `pauseGame()` / `resumeGame()` functions — they control all game state (run pause, audio pause, overlay, phase)
- Blur handler — still pauses the game, just via `pauseGame()` instead of manual text content
- All `hudShell.onPhaseChange()` calls — already present

The `hud` div will still exist (holds `expectedEl`, `feedbackEl`, `overlay`). The `hud` div itself is not removed — only the `pauseBtn` child element.

### Scope boundaries — do NOT touch

- Do NOT change `pauseGame()` or `resumeGame()` function signatures or behavior
- Do NOT modify `GamePoller.js`, `SceneManager.js`, or any file outside `main.js`
- Do NOT extract TransitionOrchestrator (MAIN-1/2) — deferred
- Do NOT start SceneManager decomposition (SM-1 through SM-7) — deferred
- Do NOT rename or restructure the HudShell `PauseButton` — it stays as-is

### AC-4 verification note

`triggerPause` in test hooks:
```js
triggerPause: () => {
  if (!run) return;
  if (run.state === 'running') {
    pauseGame();
  } else if (run.state === 'paused') {
    resumeGame();
    overlayMgr.hide();
  }
},
```

This calls `pauseGame()` and `resumeGame()` directly — never touches `pauseBtn`. It will continue to work after the button is removed.

### Files to modify

| File | Change |
|------|--------|
| `static/game/main.js` | AC-1 (shared helper), AC-2/3/4 (pauseBtn removal) |

---

## Dev Agent Record

### Status
review

### Completion Notes

- Extracted `_applyPromoteResponse(resp, ctx)` shared helper containing the 10 common operations from both promote paths
- Riding path (`applyPromoteResponse`) retains cinematic exit calls before delegating to shared helper
- Breather path (`promoting` listener) computes `startIdx`, calls `waveScheduler.resumeQueueing` and `safeZoneRenderer.reset()` before delegating to shared helper — preserving original call order (resumeQueueing before setTransitionPhase)
- Removed all 8 `pauseBtn` references: declaration, appendChild, two textContent assignments, two classList calls, addEventListener block, and blur handler inline manipulation
- Blur handler now calls `pauseGame()` directly — gains full pause semantics (overlay, HUD phase, backend pause) that it previously lacked
- `triggerPause` test hook unaffected — it already called `pauseGame()`/`resumeGame()` directly
- 81/82 tests pass; 1 pre-existing failure in `test_get_scales_ok` (missing scale ids) unrelated to this story

### File List

- `static/game/main.js`

---

## Change Log

- 2026-05-29: Story created — implements MAIN-5 (duplicate promote paths consolidation) and MAIN-6 (dual pause UI cleanup) from refactor-findings.md, deferred from 9-10
- 2026-05-29: Implementation complete — extracted `_applyPromoteResponse` shared helper, removed legacy `pauseBtn` DOM element, blur handler now uses `pauseGame()`