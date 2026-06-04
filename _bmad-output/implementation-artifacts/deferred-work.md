# Deferred Work

## Deferred from: code review of 13-2-dedicated-game-sprites-route (2026-06-04)

- `SPRITES_DIR` variable name doesn't match physical directory `static/assets/` — rename variable to `STATIC_ASSETS_DIR` or rename directory when it becomes the sole sprite source; pre-existing layout.
- No `SPRITES_DIR.exists()` check in `setup()` — if `static/assets/` is absent, all sprite requests silently return 404 with no startup warning; pre-existing pattern inherited from old `get_asset`.


## Deferred from: code review of epic-0-5 stories (2026-05-21)

- `waveCount=0` persists if `scene` creation fails silently — pre-existing game init behavior; waveCount=0 is actually accurate for a failed scene so no immediate fix needed.
- Network polling errors swallowed in `startGame()` test helper — pre-existing test infrastructure pattern; would require refactoring the gamePage fixture.
- `waveCount` snapshot lags in backgrounded tab — inherent RAF throttling (browser throttles rAF to 1fps when tab hidden); not caused by Epic 0.5 changes.
- `loop.running = true` set unconditionally before waveCount update — pre-existing main.js RAF loop pattern; full audit of loop ordering is separate work.

## Deferred from: code review of 0-1-docker-development-setup (2026-05-21)

- Broad volume mount exposes full repo root (including `.git`) to container — required for hot-reload; document scope in README when revisiting security posture.
- Healthcheck on `/` passes on redirect — `curl -f` treats 3xx as success; confirmed passing in live test but may mask future redirect changes.

## Deferred from: code review of 0-2-playwright-test-harness (2026-05-21)

- `.gitignore` `specs/` → `/specs/` scope change may track previously-ignored nested `specs/` dirs — intentional trade-off to unblock `tests/e2e/specs/`.
- Volume mount `../../` relative path resolution: confirmed working with Docker Compose v2 locally; revisit when CI is wired in story 0-4.

## Deferred from: code review (epic/0 branch — stories 0-1 through 0-2a) (2026-05-21)

- `streamType` detection uses `trackLabel.toLowerCase().includes('fake')` — undocumented Chromium string; future Chromium rename would silently break `mic-access.spec.ts` streamType assertion.
- `webServer.command` is `docker compose up` (foreground); Playwright kills the process on teardown but container cleanup depends on signal handling — may leave port 8000 occupied between runs. Consider `docker compose up --wait` + teardown wrapper for CI.
- `window.__audioState` fields not reset on `stop()` / `cleanup()` — stale `micActive: true` after audio teardown. Add `micActive: false, pipelineReady: false` to stop() if observable state is used in future assertions. [D1 RESOLVED: AudioDetector.stop() now resets window.__audioState fields.]
- `smoke.spec.ts` only captures `pageerror` events — silent console.error, swallowed fetch rejections, and worklet 404s all pass. Expand smoke coverage in story 0-3 baseline suite.

## Deferred from: code review of 2-2-implement-cartsystem-module (2026-05-21)

- `gameState.runtime.currentNote` coupling: CartSystem reads a field that requires an external writer; undocumented dependency. Future integration story (GameLoop.js) should document this contract explicitly.
- Local `carts` alias diverges from `gameState.scene.carts` after filter reassignment (CartSystem.js:23,49); latent bug if code is added post-filter using the alias. Refactor filter to avoid reference split. [RESOLVED: CartSystem.js removed in 1ac378d — carts logic in SceneManager.js uses no stale alias, no filtered reassignment of gameState.scene.carts exists]
- Static class fields (`_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned`) prevent parallel game sessions. Design trade-off made to match test scaffold. Revisit if multi-session support is needed.
- `BASE_SPEED` constants duplicated in `CartSystem.js` and `DifficultyManager.js`; risk of silent drift. Consider exporting from a shared constants module when both files are stable. [D3 RESOLVED: CartSystem.js removed in 1ac378d — constants live only in DifficultyManager.js, which is no longer used for active game logic. No duplication risk remains.]

## Deferred from: code review of story 4.1 (2026-05-21)

- Focus restoration fires synchronously at `hide()` start rather than after exit animation — immediate focus return is subjectively better UX; revisit if AT feedback suggests otherwise.
- Score not saved to localStorage when player clicks MAIN MENU (only on RESTART) — intentional: menu exit skips persistence to avoid "last score" being a menu-quit.
- Test mock `appendChild` is `vi.fn()` no-op — pre-existing mock pattern across all unit tests. Real append would need DOM tree; current assertions work via direct property references.
- No separate `overlay-manager.js` file — OverlayManager lives in `overlay.js`. Acknowledged architectural deviation; single file reduces import complexity without functional impact.

## Deferred from: code review of 4-1-implement-overlay-container-with-rgb-shift-glitch-animation (2026-05-22)

- `forceCollision` test hook sets `run.state = 'failed'` and calls `cleanup()` directly, potentially racing with an in-flight RAF frame that still holds the run reference. Pre-existing test infrastructure pattern; only affects `__TEST_MODE`.

## Deferred from: code review of 2-3-implement-difficultymanager-module (2026-05-21)

- AC-1 says constructor sets `gameState.runtime.speed` but implementation uses `init(gameState)`. AC-1 is ambiguous; Dev Notes API spec defines `init()` as the correct call. Clarify AC-1 wording in next story review or architecture doc.

## Deferred from: code review of 4-T1-strip-python-wave-queue-and-expose-timing-params (2026-05-23)

- `timing_params` constants (`wave_spacing_factor: 0.4`, `speed_increment_per_note: 0.05`) hardcoded in `game_router.py` with no link to `game_engine.py`'s `speed_multiplier *= 1.05` — silent drift risk if engine changes. Consider extracting shared constants.
- `cleanup_sessions` TTL calculation uses `now_ms - sess.started_at_ms`; `resume_session` shifts `started_at_ms` forward by pause duration, so very long pauses make a session appear younger than its wall-clock age, potentially escaping eviction.
- `fail_session` sets `status = "failed"` unconditionally with no status guard — pre-existing, minor.
- Contract test `test_game_start.py` hardcodes `base_duration_ms == 4000` for easy difficulty without asserting which difficulty the session was created with — minor test fragility.

## Deferred from: code review of 4-2-implement-pause-overlay (2026-05-22)

- W1 — `_pausedAt` set to rAF `now` (one frame after `run.pause()`) → tiny under-compensation of gameStartTime shift per pause. Pre-existing minor timing drift; cosmetic at normal framerates.
- W2 — Score shows 0 in game-over overlay if backend poll hasn't delivered first score update when collision occurs. Pre-existing race condition between collision detection and score polling.
- W3 — `resumeGame()` does not call `overlayMgr.hide()` — by design (overlay self-hides via onResumeClick), but any future external caller would leave overlay visible while game runs. No current broken path.
- W4 — `forceCollision` test hook sets `run.state = 'failed'` directly without `run.abandon()` — test-only hook, bypass is intentional.

## Deferred from: code review of 5-4-backend-variant-direction-logic (2026-05-23)

- Contract and integration tests import `engine` singleton directly via `from services.game_router import engine` — breaks test isolation if router is ever moved out-of-process; tests would silently always see `sess == None`.

## Deferred from: code review of 5-5-scenemanager-visual-refactor-single-lane-peel-transition (2026-05-23)

- Variant geometry not cleaned up if game ends mid-dismiss animation — `cleanup()` in `main.js` calls `dismissVariantTracks()` but not `clearVariantGeom()` directly; if the user quits before the dismiss piece scrolls past, proposal/lane/highlight meshes remain in the Three.js scene until the next `reset()` call. Self-healing, cosmetic only.

## Deferred from: code review of 5-1-wire-variant-observable-state-and-test-hook (2026-05-23)

- DOWN-pass false positive on arbitrary index reset — depends on play_note error handling; likely harmless pending verification of how incorrect notes affect current_note_index.
- `scales.py` octave guard accepts 1-4 but `_build_full_scale_notes` clamps to 3 — silent caller mismatch; callers passing `octaves=4` get silently clamped with no error.
- `game_engine.py` refactors exceed declared "bug fix" scope — `scale_passes_completed`, `last_pass_direction`, `_build_full_scale_notes`, and variant direction redesign bundled into 5-1; process concern, no runtime defect.
- `setVariant(null)` vs `timeoutVariant.then` `timerExpired` write race — theoretical; JS single-threaded but fetch `.then` can queue after `cleanup()` resets the object, leaving `timerExpired: true` on an otherwise zeroed variant state.

## Deferred from: code review of 5-2-remove-atdd-scaffolding-and-validate-e2e (2026-05-23)

- Backend polling loop overwrites `__gameState.variant.id` set by `setVariant` hook every ~200ms — tests pass because Playwright's rapid waitForFunction resolves before the next poll clobbers the value, but could flake on heavily loaded CI; pre-existing test hook design limitation [static/game/main.js]. [D2 DECISION: Race window bounded. setVariant writes synchronously in test hook; poll callback is async + ~1ms after fetch resolves. waitForFunction timeout (3000ms) >> poll interval (200ms). Zero observed flake in CI across all Epic 5-8 E2E runs. Risk accepted — no guard needed.]
- `setInterval` timer subject to browser throttling in hidden/backgrounded tabs — not applicable in active Playwright sessions; 3000ms waitForFunction timeout provides headroom; pre-existing design [static/game/main.js:~733].

## Deferred from: code review of 5-8-safe-zone-gated-track-switching (2026-05-25)

- `onRestart` rootMidi hardcoded to `tuning[0] + 5` (was `computeRandomRootMidi`) [static/game/main.js, setup.js] — out-of-scope behavior change shipped under 5-8; pre-existing intent unclear, see Decisions section of 5-8.
- 120 s backend window + frontend crash → orphaned variant on reconnect — reconnected client could accept on first matching note without seeing safe zone; needs session-recovery story.
- Poll race after `dismissVariant`: phantom variant respawn — sub-100 ms window between POST and next poll where backend may still report the just-dismissed variant; needs request-id correlation.
- Degenerate scale (`ascendingNoteCount <= 1`) propose path [static/game/main.js] — unreachable for any catalog scale; defensive only.
- AC-9 `timerMs` not always 0 — both note-trigger and poll paths write `Math.max(0, deadline_ms - Date.now())`; AC-9 permits the deviation and E2E sync uses `safeZoneZ`.
- AC-5 `szSpawnMs` augmented with `+ VARIANT_SZ_DEPTH / 2` offset — change-logged 2026-05-25; spec wording stale but intent preserved.
- AC-6 mechanism replaced (`variantPendingSpawn` + render-loop watcher vs spec's `pendingVariantPropose` + `updateVariantSafeZoneWave`) — functionally equivalent; doc fix is Patch P12 in 5-8 review.

## Deferred from: code review of 7-0-visual-conformance-tracks-carts-safe-zones (2026-05-27)

- `SafeZoneRenderer.this.geometry` has no disposal path on permanent renderer teardown — shared `PlaneGeometry` leaks GPU allocation if the renderer is GC'd without `reset()` being called; pre-existing architecture gap [SafeZoneRenderer.js].
- `paletteIdx=0` fallback when `anchorString` is null ignores available `transitionWave.safe_string` — variant SZ always renders with red (index 0) for null-anchor case; consider using `transitionWave.safe_string` as a better fallback [SceneManager.js:388].
- `paletteIdx` conversion (`stringCount - string`) duplicated in both `SceneManager.js` and `SafeZoneRenderer.js` without a shared utility — if string indexing convention changes, both sites must be updated independently [SceneManager.js:388, SafeZoneRenderer.js:109].
- Stale-zone cleanup intentionally skips `fill.geometry.dispose()` (it's the shared `this.geometry`) but no comment explains this invariant — future refactor could accidentally add the dispose call and corrupt all remaining zones [SafeZoneRenderer.js:95].

## Deferred from: code review of 7-1-floor-plane-ground-surface-beneath-tracks (2026-05-27)

- Use-after-free risk: `floorMat.dispose()` called in `reset()` could theoretically race a mid-flight render frame — JS is single-threaded so RAF frames never interleave; theoretical only [SceneManager.js].
- `makeFloorTile` closure captures `floorMat` by variable reference; correctness depends on `floorMat` being reassigned before `makeFloorTile()` is called in `reset()` — fragile to reordering; consider extracting a `createFloorTiles()` helper [SceneManager.js].

## Deferred from: code review of 7-2-procedural-building-generation-main-track-skyline (2026-05-28)

- `geometry.parameters.depth` unguarded — multiple sites access `g.children[0].geometry.parameters.depth` assuming BoxGeometry. Safe while invariant holds but fragile to refactoring. [SceneManager.js]
- Sequential transitions accumulate retirees — if two transitions occur <~6.6s apart, two sets of retirees scroll at different X offsets simultaneously. Unlikely in practice. [SceneManager.js]
- Propose-piece despawn no clock compensation — `despawnAtMs = nowMs + 500` uses wall clock; backgrounded tab RAF throttling makes the piece linger longer. Pre-existing behavior. [SceneManager.js]
- No E2E tests for buildings — zero E2E tests verify any building behavior (AC-1 through AC-14). Pre-existing scope decision (visual-only testing).
- `PlaneGeometry(400, 300, 32, 32)` alloc/dealloc on every `reset()` — 1024 quads × 2 tiles recreated each call; on low-end hardware or rapid resets this causes GPU memory churn; tiles could be repositioned instead of destroyed [SceneManager.js].

## Triage (Story 9-8 — Epic 9 deferred work resolution)

### Epic 0-5
- [THEORETICAL — waveCount=0 on failed scene is accurate]
- [PUNTED: Epic 10 — gamePage fixture refactor]
- [THEORETICAL — RAF throttling in backgrounded tab]
- [PUNTED: Epic 10 — RAF loop ordering audit]

### Docker/CI
- [COSMETIC — volume mount scope; documented trade-off]
- [COSMETIC — redirect healthcheck passes in practice]
- [COSMETIC — .gitignore scope change intentional]
- [PUNTED: Epic 10 — CI wiring]

### Audio
- [D1 RESOLVED — AudioDetector.stop() resets state]
- [PUNTED: Epic 10 — smoke spec expansion]

### CartSystem/DifficultyManager (removed)
- [PUNTED: Epic 10 — currentNote coupling doc]
- [RESOLVED — CartSystem removed]
- [THEORETICAL — static class fields; multi-session not needed]
- [D3 RESOLVED — CartSystem removed, BASE_SPEED constants no issue]

### Overlay/UI
- [COSMETIC — focus restoration subjective]
- [COSMETIC — score save on menu exit intentional]
- [COSMETIC — test mock pattern pre-existing]
- [COSMETIC — OverlayManager architectural deviation acknowledged]
- [THEORETICAL — forceCollision test hook race; test-only]
- [PUNTED: Epic 10 — AC-1 wording clarification]

### Timing params
- [PUNTED: Epic 10 — shared constants for timing_params]
- [THEORETICAL — cleanup_sessions TTL with long pauses]
- [COSMETIC — fail_session unconditional; minor]
- [COSMETIC — test fragility in contract test]

### Pause overlay
- [COSMETIC — _pausedAt timing drift; sub-frame]
- [COSMETIC — score 0 race; pre-existing]
- [COSMETIC — resumeGame overlay hiding; by design]
- [COSMETIC — forceCollision bypass; intentional]

### Variant logic
- [PUNTED: Epic 10 — engine singleton test isolation]
- [COSMETIC — variant geometry cleanup self-healing]
- [THEORETICAL — DOWN-pass false positive]
- [PUNTED: Epic 10 — scales.py octave guard clamping]
- [COSMETIC — process concern no runtime defect]
- [THEORETICAL — setVariant/timeout race; single-threaded guard]
- [D2 DECISION — race window bounded, zero CI flake]
- [THEORETICAL — setInterval throttling in backgrounded tab]
- [PUNTED: Epic 10 — rootMidi hardcoded intent unclear]
- [PUNTED: Epic 10 — session-recovery story needed]
- [PUNTED: Epic 10 — variant poll race request-id correlation]
- [THEORETICAL — degenerate scale propose path unreachable]
- [COSMETIC — AC-9/AC-5/AC-6 spec drift; functionally correct]

### Visual polish
- [PUNTED: Epic 10 — SafeZoneRenderer geometry disposal]
- [COSMETIC — paletteIdx fallback cosmetic; variant SZ always red acceptable]
- [RESOLVED — stringToLaneIndex extraction (Story 9-3)]
- [COSMETIC — stale-zone cleanup comment gap]
- [THEORETICAL — floorMat dispose race; single-threaded]
- [COSMETIC — makeFloorTile closure; fragile but stable]
- [PUNTED: Epic 10 — geometry.parameters.depth guard]
- [THEORETICAL — sequential transitions <6.6s; unlikely]
- [COSMETIC — propose-piece despawn pre-existing]
- [PUNTED: Epic 10 — building E2E tests]
- [PUNTED: Epic 10 — PlaneGeometry churn on reset]
