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
