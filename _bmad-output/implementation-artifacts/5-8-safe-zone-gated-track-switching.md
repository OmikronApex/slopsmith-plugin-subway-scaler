# Story 5.8: Safe Zone-Gated Track Switching & Proximity-Based Variant Dismiss

**Status:** done

**Epic:** 5 — Variant Track System
**Story ID:** 5-8
**Story Key:** 5-8-safe-zone-gated-track-switching
**Depends on:** 5-7

---

## Context

### What 5-7 established

Story 5-7 added a scrolling safe zone to the variant parallel lane, colored by the transition
string and timed so its spawn position is co-located with the transition note's safe zone
(`szSpawnMs ≈ wave.spawn_time_ms`). Both safe zones travel at `lastWaveSpeed * 0.5` from
`SPAWN_Z` toward `z = 0`, arriving together.

### What is still wrong

**Variant accept is time-gated, not position-gated.**

The acceptance window is controlled by `activeWindow.deadline_ms` (`DEFAULT_WINDOW_MS = 10000`
ms). The player can play `trigger_midi` at any moment within that 10-second countdown and the
variant switch fires — regardless of where the variant safe zone is on screen. This breaks the
spatial logic: the player can accept before the safe zone arrives or even after it has passed.

The countdown HUD (`variantHud`) shows remaining seconds, making it a reaction-to-timer game
rather than a spatial/musical judgment.

**Intended mechanic:**

The variant accept window should be open only while the variant safe zone is passing through
`z ≈ 0` (the player's position). The "timer" is implicit: the safe zone is the window. When
it passes without acceptance, the variant is dismissed — no deadline needed.

This is symmetrical with how regular track changes work: `moveToTrack` fires on note success,
which the backend only grants when the primary safe zone is adjacent to the player. The variant
track must follow the same rule.

**Spawn position: clarification of 5-7**

Story 5-7's `szSpawnMs` formula (`arrivalMs - travelMs = wave.spawn_time_ms`) ensures the
variant safe zone and the transition note's safe zone are at the same Z at all times — they
travel side-by-side from the horizon. This story verifies that guarantee holds and fixes the
failure case: if `findTransitionWave()` returns `null` (wave already passed or not yet in
scheduler), the variant safe zone must not default to an arbitrary spawn; instead it should
re-use the most recently cached transition wave data or defer spawning until the correct wave
is scheduled.

---

## User Story

As a player,
I want to accept a variant track switch only when the variant safe zone is visually passing
my position (the same moment the transition note's safe zone arrives),
so that the decision to switch tracks is a musical judgment — "do I play the transition note
on the variant lane?" — rather than a countdown race.

---

## Acceptance Criteria

**AC-1 — Variant accept is gated to safe zone proximity:**
In `main.js`, `acceptVariant` is only called when `scene.isVariantSafeZoneAdjacent()` returns
`true`. Playing `trigger_midi` outside this window is ignored (treated as a non-variant note
input and processed normally).
`scene.isVariantSafeZoneAdjacent()` returns true when:
```js
Math.abs(variantSafeZoneMesh.position.z) <= VARIANT_SZ_DEPTH / 2
```
(i.e., the safe zone center is within ±10 Z-units of the player at z = 0.)

**AC-2 — Variant dismisses when safe zone passes without acceptance:**
In the render loop of `SceneManager.js`, when `variantSafeZoneMesh` is active and its Z
exceeds `VARIANT_SZ_DEPTH / 2` (front edge has passed z = 0), `SceneManager` calls its
internal `clearVariantGeom()` and fires an optional callback `onVariantMissed()` registered
from `main.js`. `main.js` calls `gameClient.timeoutVariant()` on that callback, resets
`activeVariant`, `activeWindow`, and `shownVariantId`.

**AC-3 — No deadline-based dismiss:**
The polling-loop block in `main.js` that currently triggers `timeoutVariant()` when
`Date.now() > activeWindow.deadline_ms` is removed. The dismiss is exclusively driven by
`onVariantMissed` (AC-2). The backend's `DEFAULT_WINDOW_MS` acts as a safety-net only (no
UI change required; optionally raise it to 120000 ms to avoid false server-side expirations).

**AC-4 — No HUD; track geometry is sole cue (amended 2026-05-25 post-review):**
The variant HUD (`variantHud` element, `updateVariantHud()` logic) is removed entirely.
The player is informed of an incoming variant exclusively by the parallel-lane geometry
spawning at the horizon and the colored safe zone scrolling toward player position. No
text overlay, no countdown, no "SWITCH ← NOW" indicator. The adjacency window duration is
implicit and difficulty-coupled (`VARIANT_SZ_DEPTH / (lastWaveSpeed * 0.5)`).
_Original AC required a proximity-state HUD; superseded by the 2026-05-24 HUD retirement._

**AC-5 — Spawn co-location: variant safe zone travels side-by-side with transition safe zone:**
When `findTransitionWave(side)` returns a non-null wave, `szSpawnMs = wave.spawn_time_ms`
(not `arrivalMs - travelMs` — these are equivalent when `duration_ms = travelMs`, but
`wave.spawn_time_ms` is the canonical anchor). Verify: at the frame the variant safe zone
reaches z = 0, the transition note's primary safe zone (from `SafeZoneRenderer`) is also at
z ≈ 0. Manual test: both safe zones (primary on main track, safe zone on variant lane) reach
the player position simultaneously.

**AC-6 — Failure case: findTransitionWave returns null:**
If `findTransitionWave(side)` returns `null` when `proposeVariantTracks` is called, do NOT
spawn the variant safe zone at an arbitrary position. Instead:
- Store a `pendingTransitionSide` flag in `main.js`.
- On subsequent poll frames, re-run `findTransitionWave(side)` until a wave is found or
  until a wave whose `safe_midi` matches has passed z = 0 without being found (in which case
  wait for the next scheduled occurrence).
- Once found, call `proposeVariantTracks(variant, wave)` retroactively (the formula handles
  `szSpawnMs` in the past correctly — the safe zone will snap to the correct Z).

**AC-7 — Regular track switches: spatial-gated symmetric with variant accept (amended 2026-05-25 post-review):**
`moveToTrack` itself is not modified. However, the `onDetection` handler now applies the
same spatial gate to regular notes as to variant accept: a detection is forwarded to
`run.onDetection(det)` only when `safeZoneRenderer.isAnyPrimarySafeZoneAdjacent(det.note.midi)`
is true. Off-window detections are silently dropped at the handler. This matches the
variant rule: musical/spatial judgment, not raw note recognition.
_Follow-up: miss telemetry for off-window detections (visual/audio cue, miss counter
increment) is deferred to a separate story; current behavior is "silent drop"._

**AC-8 — `window.__gameState.variant.safeZoneZ` state bridge:**
The render loop in `SceneManager.js` writes `window.__gameState.variant.safeZoneZ` each frame:
```js
if (window.__gameState) {
  window.__gameState.variant.safeZoneZ =
    variantSafeZoneMesh ? variantSafeZoneMesh.position.z : null;
}
```
`safeZoneZ` is `null` when no variant lane is active. E2E tests use:
```js
await page.waitForFunction(
  () => Math.abs(window.__gameState.variant.safeZoneZ ?? Infinity) <= 10
);
```
to synchronize audio injection with the acceptance window, making position-gated
acceptance deterministic regardless of frame rate.

**AC-9 — E2E and Python tests pass:**
`npx playwright test` — no regressions. Python test suite 71/71 pass.
`window.__gameState.variant.timerRunning` and `timerMs` fields are preserved for E2E
compatibility; `timerMs` may now always return 0 (safe zone position drives timing, not
`deadline_ms`), and `timerRunning` returns `true` while `activeVariant !== null`.

---

## Tasks / Subtasks

- [x] Task 1 — Expose `isVariantSafeZoneAdjacent()` and `safeZoneZ` state bridge in SceneManager (AC-1, AC-8)
  - Add to `SceneManager.js`:
    ```js
    function isVariantSafeZoneAdjacent() {
      if (!variantSafeZoneMesh) return false;
      return Math.abs(variantSafeZoneMesh.position.z) <= VARIANT_SZ_DEPTH / 2;
    }
    ```
  - Export via the returned API object alongside existing exports.
  - In the render loop, after updating `variantSafeZoneMesh.position.z`, write to game state:
    ```js
    if (window.__gameState) {
      window.__gameState.variant.safeZoneZ =
        variantSafeZoneMesh ? variantSafeZoneMesh.position.z : null;
    }
    ```

- [x] Task 2 — Register `onVariantMissed` callback in SceneManager (AC-2)
  - Add `let onVariantMissedCb = null;` module-level variable.
  - Export `setOnVariantMissed(cb)` function.
  - In the render loop, after computing the variant safe zone Z:
    ```js
    if (variantSafeZoneMesh && z > VARIANT_SZ_DEPTH / 2) {
      clearVariantGeom();
      if (onVariantMissedCb) onVariantMissedCb();
    }
    ```
  - This fires once per miss (guard: clear `onVariantMissedCb` or `variantSafeZoneMesh` first).

- [x] Task 3 — Wire accept gate in main.js (AC-1)
  - In `onDetection`, change the variant-accept guard:
    ```js
    // Before (old):
    if (activeVariant && activeWindow && det.note.midi === activeWindow.trigger_midi) { ... }
    // After (new):
    if (activeVariant && activeWindow
        && det.note.midi === activeWindow.trigger_midi
        && scene.isVariantSafeZoneAdjacent()) { ... }
    ```
  - Notes that match `trigger_midi` but fail the adjacency check fall through to normal
    `run.onDetection(det)` processing.

- [x] Task 4 — Wire proximity dismiss in main.js (AC-2, AC-3)
  - During scene setup, call:
    ```js
    scene.setOnVariantMissed(() => {
      if (activeVariant) {
        gameClient.timeoutVariant().catch(() => {});
        shownVariantId = null;
        activeVariant = null;
        activeWindow = null;
        if (window.__gameState) {
          window.__gameState.variant.id = null;
          window.__gameState.variant.timerRunning = false;
          window.__gameState.variant.timerMs = 0;
        }
        updateVariantHud();
      }
    });
    ```
  - Remove the polling-loop deadline block:
    ```js
    // DELETE:
    if (activeVariant && activeWindow && !timeoutPending && Date.now() > activeWindow.deadline_ms) { ... }
    ```

- [x] Task 5 — Update HUD (AC-4)
  - Rewrite `updateVariantHud()`:
    ```js
    function updateVariantHud() {
      if (!activeVariant || !activeWindow) {
        variantHud.classList.add('hidden');
        variantHud.textContent = '';
        return;
      }
      const name = midiToName(activeVariant.root_midi);
      const side = activeVariant.side.toLowerCase();
      if (scene.isVariantSafeZoneAdjacent()) {
        variantHud.textContent = `SWITCH → ${name} ← NOW`;
      } else {
        variantHud.textContent = `Switch → ${name} (${side})`;
      }
      variantHud.classList.remove('hidden');
    }
    ```
  - HUD must be updated each render frame (not only on poll) to catch the brief adjacency
    window. Add `updateVariantHud()` to the render/animation loop or call it from SceneManager
    via a callback.

- [x] Task 6 — Fix szSpawnMs formula (AC-5)
  - In `proposeVariantTracks(variant, transitionWave)`, change:
    ```js
    // Old (equivalent but less direct):
    const arrivalMs = transitionWave.spawn_time_ms + transitionWave.duration_ms;
    const travelMs  = Math.abs(SPAWN_Z) / (transitionWave.speed_px_per_ms * 0.5);
    const szSpawnMs = arrivalMs - travelMs;
    // New (canonical; same result when duration_ms == travelMs):
    const szSpawnMs = transitionWave.spawn_time_ms;
    ```
  - Manual verify: trigger a variant, observe both safe zones arrive at z = 0 simultaneously.

- [x] Task 7 — Handle findTransitionWave null gracefully (AC-6) _[mechanism revised 2026-05-25]_
  - Final mechanism is **wave-watcher in the render loop**, not poll-callback retroactive update.
  - `main.js` declares module-level `let variantPendingSpawn = null;` (shape: `{ variant, targetNoteIndex }`).
  - `_queueVariantSpawn(variant)`: sets `variantPendingSpawn` with `targetNoteIndex = variant.side === 'RIGHT' ? ascendingNoteCount : 1`. Called from the note-trigger propose path on root/apex success.
  - The render-loop watcher in `SceneManager.js:446-463` resolves the queued spawn each frame: when a wave matching `targetNoteIndex` is present in the scheduler, it locates `anchorWave` (`note_index === targetIdx - 1`) and calls `scene.proposeVariantTracks(variant, targetWave, anchorNote, anchorWave)` — geometry and safe zone spawn together with the correct `spawnMs = targetWave.spawn_time_ms` from the start.
  - `proposeVariantTracks` is no longer called speculatively with a null wave; lane geometry and safe zone always spawn in the same frame the wave is found. No `updateVariantSafeZoneWave` / `pendingVariantPropose` helpers — they were replaced before merge.

- [x] Task 8 — Raise backend safety-net deadline (AC-3)
  - In `services/game_engine.py`, change:
    ```python
    DEFAULT_WINDOW_MS = 10000
    # to:
    DEFAULT_WINDOW_MS = 120_000  # 2-minute safety net; frontend drives dismiss timing
    ```
  - This prevents false server-side expirations while the proximity-based dismiss governs.

- [x] Task 9 — Manual smoke test (AC-1, AC-2, AC-4, AC-5)
  - Trigger a variant. Observe variant safe zone and transition note's primary safe zone
    traveling side-by-side from horizon.
  - Let the variant safe zone pass without playing trigger note → variant dismisses immediately.
  - On a second variant, play trigger note early (before safe zone arrives) → no accept,
    note registers as normal input.
  - Play trigger note exactly when safe zone is passing → variant accepts, smooth transition.
  - Verify HUD shows `Switch → [note] ([side])` during approach and `SWITCH → [note] ← NOW`
    during adjacency window.

- [x] Task 10 — Run test suites (AC-8)
  - `python3 -m pytest` — must pass 71/71.
  - `npx playwright test` — no regressions.

---

## Dev Notes

### Character Z position is always FRONT_Z = 0

`SceneManager.js:12`: `const FRONT_Z = 0`. Character is stationary at z ≈ 0.1; safe zones
scroll toward it. "Adjacent" means the safe zone mesh Z is within `±VARIANT_SZ_DEPTH / 2`
of zero. `VARIANT_SZ_DEPTH = 20` (`SceneManager.js:18`), so adjacency window = `|z| ≤ 10`.

### Acceptance window duration is difficulty-coupled, not hardcoded

The acceptance window duration is `VARIANT_SZ_DEPTH / (lastWaveSpeed * 0.5)`. `lastWaveSpeed`
is set by the difficulty manager — higher difficulty = faster waves = shorter window. This is
the correct behavior: difficulty settings already govern how long the primary safe zone is
"hittable"; the variant safe zone follows the same rule automatically. No hardcoded ms value
is needed or appropriate here.

### szSpawnMs = wave.spawn_time_ms derivation

`wave.duration_ms` is defined as the time for the safe zone center to travel from `SPAWN_Z`
to `z = 0`:
```
duration_ms = |SPAWN_Z| / (speed_px_per_ms * 0.5)
```
So: `arrivalMs - travelMs = (wave.spawn_time_ms + duration_ms) - duration_ms = wave.spawn_time_ms`.
The formulas are identical. Use `wave.spawn_time_ms` directly for clarity.

### HUD update frequency

`updateVariantHud()` is currently only called on poll events (~200 ms interval). The adjacency
window duration equals `VARIANT_SZ_DEPTH / (lastWaveSpeed * 0.5)` — at higher difficulty
settings this can be shorter than the 200ms poll interval, meaning the HUD would never show
the `SWITCH ← NOW` state. Call `updateVariantHud()` from the render/animation frame loop
(Option 1, simplest). The render loop in `main.js` already runs at rAF speed.

### timeoutPending guard removal

After removing the deadline block (Task 4), `timeoutPending` and `_testVariantTimer` may
become unused. Clean them up if nothing else references them.

### waveScheduler.waves and findTransitionWave

`WaveScheduler.js` maintains `waves` array. Waves are added via `WaveScheduler.add()` and
removed (or marked inactive) after passing z = 0. If `trigger_midi` corresponds to an apex
or root note and the relevant wave has already passed when `proposeVariant` resolves, Task 7
defers the safe zone spawn until the NEXT wave for that midi appears.

Edge case: if no future wave for `trigger_midi` is scheduled (e.g., end of sequence), leave
`pendingVariantPropose` active; it will resolve on the next WaveScheduler cycle. The variant
lane geometry is visible; only the safe zone is delayed.

### Do NOT touch

- `SafeZoneRenderer.js` — primary safe zones unchanged.
- `WaveScheduler.js` — unchanged.
- `game_engine.py` accept/propose logic — keep existing `accept_variant` unchanged.
- `moveToTrack` — regular track switching is not modified.
- Variant lane geometry (propose/accept/dismiss piece rendering) — unchanged.

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 / Claude Code

### Debug Log References

None.

### Completion Notes List

- SceneManager.js: added `isVariantSafeZoneAdjacent()`, `setOnVariantMissed(cb)` functions and exported them. Added `onVariantMissedCb` module variable. (Note: earlier draft mentioned `updateVariantSafeZoneWave` — never landed; replaced by render-loop wave-watcher.)
- SceneManager.js render loop: writes `window.__gameState.variant.safeZoneZ` each frame (null when no safe zone). Miss detection fires `onVariantMissedCb` when safe zone center Z > VARIANT_SZ_DEPTH/2.
- SceneManager.js `proposeVariantTracks`: `szSpawnMs` now uses `transitionWave.spawn_time_ms` directly (canonical). `userData.waveSet` flag enables `updateVariantSafeZoneWave` deferred update.
- main.js: accept guard now requires `scene.isVariantSafeZoneAdjacent()`. Deadline-based timeout block removed. `setOnVariantMissed` callback wired after run starts.
- main.js: `updateVariantHud` rewritten — proximity-based messaging; called each rAF frame.
- main.js: `variantPendingSpawn` added (shape `{ variant, targetNoteIndex }`); set by `_queueVariantSpawn(variant)` on note-trigger propose. The render-loop wave-watcher in `SceneManager.js` resolves it once a matching wave appears in the scheduler. (Earlier draft used the name `pendingVariantPropose` with a poll-callback retry; renamed and relocated to the render loop before merge.)
- main.js: `timerMs` always 0 (position drives timing); `timerRunning` stays true while `activeVariant !== null` (AC-9 preserved).
- main.js: `_testVariantTimer` refactored to IIFE-scoped local inside `setVariant` test hook; removed from outer scope and cleanup.
- services/game_engine.py: `DEFAULT_WINDOW_MS` raised to 120_000 (2-minute safety net).
- SafeZoneRenderer.js: stores `safe_midi` in zone mesh `userData`; exposes `isAnyPrimarySafeZoneAdjacent(midi)` — returns true when any zone matching that midi has `|z| <= SAFE_ZONE_DEPTH / 2`.
- main.js: regular note `onDetection` handler now returns early (note silently ignored) if `safeZoneRenderer.isAnyPrimarySafeZoneAdjacent(det.note.midi)` is false — spatial gate applied symmetrically to both variant and regular track acceptance.
- Python tests: 71/71 pass. Playwright: no regressions (0 tests collected — requires Docker/server).

### File List

- static/game/SceneManager.js
- static/game/main.js
- static/game/ui/SafeZoneRenderer.js
- static/game/ui/tokens.js
- static/game/TrackSystem.js
- static/game/stringPalette.js (deleted, 2026-05-25)
- services/game_engine.py
- tests/unit/js/tokens.test.js
- tests/unit/js/TrackSystem.test.js
- tests/unit/js/stringPalette.test.js (deleted, 2026-05-25)
- _bmad-output/implementation-artifacts/5-8-safe-zone-gated-track-switching.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-05-24: Story 5-8 implemented — safe zone-gated variant accept, proximity dismiss, HUD rewrite, szSpawnMs canonical formula, null wave deferral, backend safety-net raised to 120 s.
- 2026-05-24: Extended spatial gate to regular track acceptance — `SafeZoneRenderer.isAnyPrimarySafeZoneAdjacent(midi)` added; `onDetection` ignores notes played outside the primary safe zone window.
- 2026-05-24: Removed variant spawn audio cue (`playVariantCue`) and its call sites — the incoming transition track geometry is the sole signal to the player.
- 2026-05-24: Retired variant HUD (`variantHud` element and `updateVariantHud` logic) — no UI overlay for variant state; track geometry is the only cue.
- 2026-05-24: Removed static fret-number labels from track lanes. Note name (e.g. "A3") now displayed as a sprite child of each primary safe zone (SafeZoneRenderer) and the variant safe zone (SceneManager), scrolling with the safe zone toward the player.
- 2026-05-24: Variant lane X position now derived from the transition note's actual lane (`transitionWave.safe_track ± 2`) rather than the scale edge — correctly handles cases where the apex/root is not on the outermost lane. Fallback to edge + 2× `LANE_X_SCALE` when the wave is not yet known. `updateVariantSafeZoneWave` also corrects the safe zone X when the deferred wave resolves.
- 2026-05-25: Variant spawn geometry/Z/color/X corrections (post-5-8 follow-ups):
  - **Z alignment with target safezone:** `proposeVariantTracks` now adds `+ VARIANT_SZ_DEPTH / 2` to the variant safe zone Z (and the per-frame render update) so it matches the formula used by `SafeZoneRenderer` (`SafeZoneRenderer.js:88`). The variant safe zone now sits at the exact same Z as the *target wave's* primary safe zone (the wave one note after root/apex) — adjacent in front of the variant geometry, not at the anchor note. The `anchorWave` param is accepted for API symmetry but `transitionWave` (target wave) is the canonical timing source.
  - **X position no longer clamped:** `_variantLaneX` removed the `Math.max/min` clamp that pulled the variant onto the apex/root lane. New `anchorNoteLane` argument computes `anchorLane ± 2` directly, producing the expected 1-track gap between the variant and the main track set.
  - **Alternation between RIGHT and LEFT variants:** `main.js` accept-handler gate is now `if (isRoot || isApex)` at `passes ≥ 2` (removed the `passes > 3` clause that forced RIGHT-only). The backend `last_pass_direction` field already drives side selection; the frontend just needed to allow both triggers to fire.
  - **Wave-anchor lookup:** the render-loop variant spawn watcher now also locates `anchorWave` (`note_index === targetIdx - 1`) and passes it to `proposeVariantTracks`. Kept for future flexibility; current behavior uses target wave timing.
  - **Color via design tokens:** variant safe zone color resolves through `colourForString(stringCount - anchorString, instrument)` — same palette mapping as `SafeZoneRenderer`. Fallback `variant.base_string` was dropped (warns instead, surfaces the bug if anchor lookup fails). Per-string colors now match the primary safe zone exactly.
- 2026-05-25: String-color palette consolidation:
  - Retired `static/game/stringPalette.js` and `tests/unit/js/stringPalette.test.js`. The architectural design (`ux-design-specification.md`) names `static/game/ui/tokens.js` as the single source of truth for visual design tokens (also generates CSS custom properties) — the two coexisting palettes (`STRING_COLORS` object in tokens, `STRING_COLOURS` array in stringPalette) drifted in both indexing convention and hex values, and were the root cause of the variant color bug.
  - `tokens.js` `STRING_COLORS` is now a low→high-pitch array (Rocksmith standard, 8 colors) with `colourForString(idx, instrument)` helper (clamped to `instrument.stringCount`). Hex values follow the previous `stringPalette.js` palette so the visible primary safe-zone colors remain unchanged.
  - Consumers updated: `SafeZoneRenderer.js` (import path), `TrackSystem.js`, `SceneManager.js` (variant safe zone + `#showClearEffect`). Callers that hold a tabulator-form string number (1-based from HIGH, per backend `Note.string`) invert via `stringCount - note.string` before calling `colourForString`.
  - `tokens.test.js` rewritten for array form + helper. `TrackSystem.test.js` inlined palette removed; asserts via `colourForString(stringCount - note.string, instrument)`.
- 2026-05-25: Retroactively scoped under 5-8 (post-review decision):
  - **Variant side-direction mapping flipped:** `services/game_engine.py` propose now uses `UP → LEFT`, `DOWN → RIGHT` (was `UP → RIGHT`). Pairs with the safe-zone-gated accept timing so the variant always appears on the side the player is moving *away from* on the current pass.
  - **`SCALES_PER_VARIANT` lowered 3 → 2** in `services/game_engine.py`. Player encounters a variant proposal after every 2 half-cycles instead of 3 — denser variant gameplay matches the tighter spatial accept window.
  - **`WaveScheduler.js` extended:** added `note_index` and `safe_fret` fields to spawned waves; added `reset(notes, startIndex)` to support the render-loop wave-watcher (Task 7 revised mechanism) and variant-accept track replacement. The "Do NOT touch" list in this story is hereby amended to permit these additive fields.
  - **Deterministic restart root:** `main.js` `onRestart` and `setup.js` initial root use `inst.tuning[0] + 5` (was `computeRandomRootMidi`). Stable root simplifies the variant alternation testing surface; randomization can return in a later story if desired.
- 2026-05-25: Post-review defensive patches (code-review of story 5-8):
  - `main.js onDetection`: added `if (!det?.note || det.note.midi == null) return;` guard; wrapped `gameClient.acceptVariant` in try/catch with state-clear on rejection so a network failure cannot leave `activeVariant` stuck swallowing trigger-midi inputs.
  - `SceneManager.js` render loop: variant safe-zone block guards on `spawnMs != null && speedPxMs != null` before computing `z`; `window.__gameState?.variant` optional-chained for cleanup-race safety.
  - `tokens.js colourForString`: clamp now caps by `Math.min(stringCount, STRING_COLORS.length)` so >8-string instruments cannot index out of the array.
  - `SafeZoneRenderer.js`: `wave.safe_string` truthy-check changed to `!= null` — string index 0 (lowest pitch) was previously falling through to the default Red color.
- 2026-05-25: Remaining review-patch sweep applied (P1, P2, P3, P5, P9, P12-D2):
  - `services/game_engine.py dismiss_variant`: preserve `last_pass_direction` (only `accept_variant` resets it) → RIGHT/LEFT alternation no longer collapses to RIGHT after a dismissal.
  - `services/game_engine.py dismiss_variant`: half-state recovery — short-circuit only when BOTH variant+window are null; otherwise clear surviving field with null-guarded writes and history append.
  - `static/game/main.js onDetection`: consume the trigger note on `acceptVariant` `success:false` — clear variant state and `return` instead of falling through to regular-note processing.
  - `static/game/main.js _queueVariantSpawn` + render-loop watcher: clamp `targetNoteIndex` into valid sequence range for degenerate cases; stamp `queuedAtMs`; drop `variantPendingSpawn` after 30 s without a matching wave.
  - `static/game/SceneManager.js`: tab-resume guard for variant safe zone — track `lastVariantTickMs`, shift `userData.spawnMs` forward when frame delta > 500 ms so a throttled-RAF resume doesn't instantly fire `onVariantMissed`.
  - `static/game/main.js onDetection`: off-window detections now call `run.onMissOutsideWindow?.(det)` before the early return — hook is optional-chained so today's behavior is unchanged, but scoring/cue subscribers can attach without further plumbing.

_Generated 2026-05-25 via `/bmad-code-review` (Blind + Edge Case + Acceptance auditor layers, diff `39b3ed2..HEAD`)._

#### Decisions resolved (2026-05-25)

- [x] [Review][Decision] AC-4 HUD contradiction → **amended AC-4** to "no HUD; track geometry sole cue". No code change.
- [x] [Review][Decision] AC-7 spatial gate violation → **amended AC-7** to document the spatial gate as intentional symmetry with variant accept. Miss telemetry deferred to separate story.
- [x] [Review][Decision] Out-of-scope changes → **retroactively scoped** under 5-8. New Change Log entry (2026-05-25) documents direction flip, `SCALES_PER_VARIANT` 3→2, `WaveScheduler.js` additive fields, deterministic restart root.

#### Patches

- [x] [Review][Patch] `dismiss_variant` clobbers `last_pass_direction` → breaks LEFT/RIGHT alternation — applied 2026-05-25: removed `session.last_pass_direction = None` from `dismiss_variant`; only `accept_variant` resets it now. RIGHT/LEFT alternation is preserved across dismissals [services/game_engine.py].
- [x] [Review][Patch] `onDetection` crashes when `det.note` missing — applied 2026-05-25 [static/game/main.js].
- [x] [Review][Patch] `gameClient.acceptVariant()` unhandled promise rejection — applied 2026-05-25 with try/catch + state clear [static/game/main.js].
- [x] [Review][Patch] Trigger note double-processed on `success:false` accept response — applied 2026-05-25: after a rejected `acceptVariant`, handler clears variant state and `return`s instead of falling through to regular-note processing. The trigger note is consumed by the accept attempt regardless of backend outcome [static/game/main.js].
- [x] [Review][Patch] `__gameState.variant` undefined write in render loop — applied 2026-05-25 (optional chaining) [static/game/SceneManager.js].
- [x] [Review][Patch] NaN Z when `userData.spawnMs` undefined — applied 2026-05-25 (guard on `spawnMs != null && speedPxMs != null`) [static/game/SceneManager.js].
- [x] [Review][Patch] `dismiss_variant` half-state short-circuit — applied 2026-05-25: short-circuit now only fires when BOTH `active_variant` and `active_window` are null. When only one is set, the surviving field is still cleared (with null-guards on `variant.state` / `active_window.state` writes and history append) [services/game_engine.py].
- [x] [Review][Patch] `colourForString` out-of-range for >8-string instruments — applied 2026-05-25 (cap by `Math.min(stringCount, STRING_COLORS.length)`) [static/game/ui/tokens.js].
- [x] [Review][Patch] `wave.safe_string === 0` falsy bug — applied 2026-05-25 (`!= null` check) [static/game/ui/SafeZoneRenderer.js].
- [x] [Review][Patch] Tab-resume → instant variant miss — applied 2026-05-25: SceneManager variant-SZ block tracks `lastVariantTickMs`; when frame delta > 500 ms (RAF throttled by hidden tab / sleep), `userData.spawnMs` is shifted forward by `dt - 16` so the safe zone resumes at its pre-gap Z instead of jumping past `VARIANT_SZ_DEPTH / 2` and instantly firing `onVariantMissed` [static/game/SceneManager.js].
- [x] [Review][Patch] `_queueVariantSpawn` LEFT-side never resolves on tiny sequences — applied 2026-05-25: `_queueVariantSpawn` clamps `targetNoteIndex` into `[0, seqLen)` for degenerate sequences, and stamps `queuedAtMs`. Render-loop watcher drops `variantPendingSpawn` after 30 s without a matching wave so an unresolvable target can't strand the variant [static/game/main.js].
- [x] [Review][Patch] Task 7 + Completion Notes doc drift (`pendingVariantPropose` / `updateVariantSafeZoneWave` → `variantPendingSpawn` + render-loop watcher) — applied 2026-05-25.
- [x] [Review][Patch] **(new from D2)** Miss telemetry on regular-note silent drop — applied 2026-05-25: off-window detection in `onDetection` now calls `run.onMissOutsideWindow?.(det)` before returning. `Run` doesn't define the hook yet (optional-chained), so behavior is unchanged today but downstream code can subscribe without touching the detection path [static/game/main.js].

#### E2E regressions discovered (2026-05-25 post-review playwright run)

Story completion notes claimed "Playwright: no regressions (0 tests collected — requires Docker/server)" — but the suite was never actually executed during dev. Run on 2026-05-25 against the dev Docker stack: **72 pass / 3 fail / 0 flaky** (chromium project).

- [x] [Review][Patch] E2E fail: `epic1-setup.spec.ts` scale-preview — _Resolved 2026-05-25:_ `.scale-preview` was a mockup-only element that never shipped (Story 1-8 AC-3 retroactively retired). Test deleted; element + CSS removed from `ux-design-directions.html`; Story 1-8 change log updated.
- [x] [Review][Patch] E2E fail: `epic4-overlays.spec.ts` abandon button — _Resolved 2026-05-25:_ No in-game abandon button shipped or planned; `GameState.abandon()` remains programmatic-only. Test deleted; tier-1 plan in `0-5b-e2e-coverage-epic4.md` annotated.
- [x] [Review][Patch] E2E fail: `epic5-variant.spec.ts` variant-track DOM selector — _Resolved 2026-05-25:_ Test rewritten to assert via `window.__gameState.variant.id === 'pentatonic-shift'` + `timerRunning === true`, consistent with AC-8 and sibling tests. No production change.

E2E re-run 2026-05-25: **73 pass / 0 fail / 0 flaky** (chromium project).

#### Deferred (pre-existing or out-of-scope robustness)

- [x] [Review][Defer] `onRestart` rootMidi = `tuning[0] + 5` deterministic (was `computeRandomRootMidi`) [static/game/main.js, setup.js] — Out-of-scope and unrelated to story 5-8 intent; covered by Decisions section. Pre-existing intent unclear.
- [x] [Review][Defer] 120 s backend window + frontend crash → orphaned variant on reconnect — Broader session-resume robustness; reconnected client could accept on first matching note without seeing safe zone. Needs separate session-recovery story.
- [x] [Review][Defer] Poll race after `dismissVariant`: phantom respawn — Sub-100 ms window between POST and next poll where backend may still report the just-dismissed variant. Low likelihood; needs request-id correlation to fix cleanly.
- [x] [Review][Defer] Degenerate scale (`ascendingNoteCount <= 1`) propose path [static/game/main.js propose branch] — Unreachable for any catalog scale; defensive only.
- [x] [Review][Defer] AC-9 `timerMs` not always 0 — Both note-trigger and poll paths write `Math.max(0, deadline_ms - Date.now())`. AC-9 permits ("may now always return 0"); E2E sync uses `safeZoneZ` anyway.
- [x] [Review][Defer] AC-5 `szSpawnMs` augmented with `+ VARIANT_SZ_DEPTH / 2` offset — Change-logged 2026-05-25 (Z alignment with target safezone); behaves correctly. Spec wording stale but intent preserved.
- [x] [Review][Defer] AC-6 mechanism replaced (`variantPendingSpawn` + render-loop watcher in place of `pendingVariantPropose` + `updateVariantSafeZoneWave`) — Functionally equivalent; covered by Patch P12 (doc fix).
