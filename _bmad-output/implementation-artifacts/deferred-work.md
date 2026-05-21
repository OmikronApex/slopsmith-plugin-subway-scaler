# Deferred Work

## Deferred from: code review of 2-2-implement-cartsystem-module (2026-05-21)

- `gameState.runtime.currentNote` coupling: CartSystem reads a field that requires an external writer; undocumented dependency. Future integration story (GameLoop.js) should document this contract explicitly.
- Local `carts` alias diverges from `gameState.scene.carts` after filter reassignment (CartSystem.js:23,49); latent bug if code is added post-filter using the alias. Refactor filter to avoid reference split.
- Static class fields (`_nextDeadlineMs`, `_nextWaveNoteIndex`, `_totalWavesSpawned`) prevent parallel game sessions. Design trade-off made to match test scaffold. Revisit if multi-session support is needed.
- `BASE_SPEED` constants duplicated in `CartSystem.js` and `DifficultyManager.js`; risk of silent drift. Consider exporting from a shared constants module when both files are stable.

## Deferred from: code review of 2-3-implement-difficultymanager-module (2026-05-21)

- AC-1 says constructor sets `gameState.runtime.speed` but implementation uses `init(gameState)`. AC-1 is ambiguous; Dev Notes API spec defines `init()` as the correct call. Clarify AC-1 wording in next story review or architecture doc.
