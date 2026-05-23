# Deferred Work

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
- `window.__audioState` fields not reset on `stop()` / `cleanup()` — stale `micActive: true` after audio teardown. Add `micActive: false, pipelineReady: false` to stop() if observable state is used in future assertions.
- `smoke.spec.ts` only captures `pageerror` events — silent console.error, swallowed fetch rejections, and worklet 404s all pass. Expand smoke coverage in story 0-3 baseline suite.

## Deferred from: code review of 2-2-implement-cartsystem-module (2026-05-21)

- `gameState.runtime.currentNote` coupling: CartSystem reads a field that requires an external writer; undocumented dependency. Future integration story (GameLoop.js) should document this contract explicitly.
- Local `carts` alias diverges from `gameState.scene.carts` after filter reassignment (CartSystem.js:23,49); latent bug if code is added post-filter using the alias. Refactor filter to avoid reference split.
- Static class fields (`_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned`) prevent parallel game sessions. Design trade-off made to match test scaffold. Revisit if multi-session support is needed.
- `BASE_SPEED` constants duplicated in `CartSystem.js` and `DifficultyManager.js`; risk of silent drift. Consider exporting from a shared constants module when both files are stable.

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

- Backend polling loop overwrites `__gameState.variant.id` set by `setVariant` hook every ~200ms — tests pass because Playwright's rapid waitForFunction resolves before the next poll clobbers the value, but could flake on heavily loaded CI; pre-existing test hook design limitation [static/game/main.js].
- `setInterval` timer subject to browser throttling in hidden/backgrounded tabs — not applicable in active Playwright sessions; 3000ms waitForFunction timeout provides headroom; pre-existing design [static/game/main.js:~733].
