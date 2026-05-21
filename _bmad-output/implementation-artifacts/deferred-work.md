# Deferred Work

## Deferred from: code review of 0-1-docker-development-setup (2026-05-21)

- Broad volume mount exposes full repo root (including `.git`) to container — required for hot-reload; document scope in README when revisiting security posture.
- Healthcheck on `/` passes on redirect — `curl -f` treats 3xx as success; confirmed passing in live test but may mask future redirect changes.

## Deferred from: code review of 0-2-playwright-test-harness (2026-05-21)

- `.gitignore` `specs/` → `/specs/` scope change may track previously-ignored nested `specs/` dirs — intentional trade-off to unblock `tests/e2e/specs/`.
- Volume mount `../../` relative path resolution: confirmed working with Docker Compose v2 locally; revisit when CI is wired in story 0-4.

## Deferred from: code review of 2-2-implement-cartsystem-module (2026-05-21)

- `gameState.runtime.currentNote` coupling: CartSystem reads a field that requires an external writer; undocumented dependency. Future integration story (GameLoop.js) should document this contract explicitly.
- Local `carts` alias diverges from `gameState.scene.carts` after filter reassignment (CartSystem.js:23,49); latent bug if code is added post-filter using the alias. Refactor filter to avoid reference split.
- Static class fields (`_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned`) prevent parallel game sessions. Design trade-off made to match test scaffold. Revisit if multi-session support is needed.
- `BASE_SPEED` constants duplicated in `CartSystem.js` and `DifficultyManager.js`; risk of silent drift. Consider exporting from a shared constants module when both files are stable.

## Deferred from: code review of 2-3-implement-difficultymanager-module (2026-05-21)

- AC-1 says constructor sets `gameState.runtime.speed` but implementation uses `init(gameState)`. AC-1 is ambiguous; Dev Notes API spec defines `init()` as the correct call. Clarify AC-1 wording in next story review or architecture doc.
