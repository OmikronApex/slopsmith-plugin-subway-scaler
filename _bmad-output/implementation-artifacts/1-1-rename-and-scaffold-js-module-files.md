# Story 1.1: Rename and Scaffold JS Module Files

**Status:** review
**Epic:** 1 — Foundation & Session Setup
**Story ID:** 1.1
**Story Key:** 1-1-rename-and-scaffold-js-module-files

---

## User Story

As a developer,
I want all JS modules renamed to their architectural names and new stub modules created,
So that the codebase structure matches the architecture document and all future epics build on known module paths.

---

## Acceptance Criteria

**AC-1 — Source file renames (content verbatim, no logic changes):**
- `static/game/runState.js` → `static/game/GameState.js`
- `static/game/audio.js` → `static/game/AudioDetector.js`
- `static/game/grid.js` → `static/game/TrackSystem.js`
- `static/game/scene.js` → `static/game/SceneManager.js`
- Original files deleted (no duplicates)

**AC-2 — New stub modules created as empty ES classes:**
- `static/game/GameLoop.js` — `export default class GameLoop { constructor() {} }`
- `static/game/CartSystem.js` — `export default class CartSystem { constructor() {} }`
- `static/game/DifficultyManager.js` — `export default class DifficultyManager { constructor() {} }`

**AC-3 — All import paths updated — no references to old file names remain:**
- `static/game/main.js` imports updated
- `static/game/SceneManager.js` (was `scene.js`) internal import updated
- `static/game/ui/SafeZoneRenderer.js` import updated
- `tests/unit/js/grid.test.js` import updated
- `tests/unit/js/runState.test.js` import updated
- `tests/unit/js/audio.test.js` import updated

**AC-4 — All existing tests continue to pass after renames**

---

## Developer Context

### What this story is and is NOT

This story is **pure mechanical rename + scaffold**. No logic changes, no restructuring of exported APIs, no new behavior. The goal is to get the file layout matching the architecture doc so that Stories 1.2+ can build on stable, correctly-named modules.

Do NOT:
- Restructure or refactor existing code inside the renamed files
- Change any exported function/class names or signatures
- Add PHASES constants or new GameState shape (that's Story 1.2)
- Implement the AudioDetector adapter pattern (that's Story 3.3)
- Change SafeZoneRenderer behavior

### Test file situation — read carefully

The ATDD skill has already pre-placed red-phase test scaffolds in `tests/unit/js/` for all new module names:
- `GameState.test.js` (ATDD scaffold for Story 1.2 — all `it.skip()`)
- `TrackSystem.test.js` (ATDD scaffold for Stories 3.2 + 5.2 — all `it.skip()`)
- `AudioDetector.test.js` (ATDD scaffold for Story 3.3 — all `it.skip()`)
- `GameLoop.test.js` (ATDD scaffold for Stories 3.4 + 3.5 — all `it.skip()`)
- `CartSystem.test.js` (ATDD scaffold for Story 2.2 — all `it.skip()`)
- `DifficultyManager.test.js` (ATDD scaffold for Story 2.3 — `it.skip()`)

The OLD test files with REAL passing tests still exist and import from old paths:
- `grid.test.js` → imports from `static/game/grid.js` (laneX, rowZ, windowedLanes, cameraFor45Deg, cameraForPitch)
- `runState.test.js` → imports from `static/game/runState.js` (Run, difficultyToTimePerNoteMs)
- `audio.test.js` → imports from `static/game/audio.js` (enumerateInputs)

**Action required for each:** Update the import path in the old test file to point to the new file name. Keep the old test files under their existing names — do NOT rename them (that would collide with the ATDD files). The old test files test utility functions/existing APIs that are preserved verbatim in the renamed files.

Summary:
- `grid.test.js`: change import from `../../../static/game/grid.js` → `../../../static/game/TrackSystem.js`
- `runState.test.js`: change import from `../../../static/game/runState.js` → `../../../static/game/GameState.js`
- `audio.test.js`: change import from `../../../static/game/audio.js` → `../../../static/game/AudioDetector.js`

The ATDD scaffold files require no changes — they're already pointing to the correct (not-yet-implemented) new module paths and will stay skipped until implementation stories.

Note on `AudioDetector.test.js`: it imports `{ AudioDetector, YinDetector, AudioDetectorError }` from `AudioDetector.js`. After this story, `AudioDetector.js` contains the old `audio.js` content which exports none of those names — those imports will be `undefined`. This is expected and correct; Story 3.3 implements them. No action needed here.

---

## Files to Modify / Create

| File | Action | Notes |
|------|--------|-------|
| `static/game/runState.js` | RENAME → `GameState.js` | Content verbatim |
| `static/game/audio.js` | RENAME → `AudioDetector.js` | Content verbatim |
| `static/game/grid.js` | RENAME → `TrackSystem.js` | Content verbatim |
| `static/game/scene.js` | RENAME → `SceneManager.js` | Content verbatim |
| `static/game/GameLoop.js` | CREATE stub | See template below |
| `static/game/CartSystem.js` | CREATE stub | See template below |
| `static/game/DifficultyManager.js` | CREATE stub | See template below |
| `static/game/main.js` | UPDATE imports | 4 imports to change |
| `static/game/SceneManager.js` | UPDATE internal import | `./grid.js` → `./TrackSystem.js` |
| `static/game/ui/SafeZoneRenderer.js` | UPDATE import | `../grid.js` → `../TrackSystem.js` |
| `tests/unit/js/grid.test.js` | UPDATE import path | `grid.js` → `TrackSystem.js` |
| `tests/unit/js/runState.test.js` | UPDATE import path | `runState.js` → `GameState.js` |
| `tests/unit/js/audio.test.js` | UPDATE import path | `audio.js` → `AudioDetector.js` |

---

## Stub Module Templates

All three stubs use **named exports** — this matches how the ATDD test files import them (`import { GameLoop } from '...'`). Do NOT use `export default`:

```js
// GameLoop.js
export class GameLoop {
  constructor() {}
}
```

```js
// CartSystem.js
export class CartSystem {
  constructor() {}
}
```

```js
// DifficultyManager.js
export class DifficultyManager {
  constructor() {}
}
```

No imports, no methods, no constructor body. Future stories fill these in.

---

## Exact Import Changes in main.js

Current `main.js` lines 4–10 (current imports that reference old names):
```js
import { createScene } from './scene.js';
import { startAudio, enumerateInputs } from './audio.js';
import { Run, difficultyToTimePerNoteMs } from './runState.js';
import { quantize, midiToName } from './notes.js';        // unchanged
import { GameClient } from './game-client.js';             // unchanged
import { SafeZoneRenderer } from './ui/SafeZoneRenderer.js'; // unchanged
import { laneX } from './grid.js';
```

Must become:
```js
import { createScene } from './SceneManager.js';
import { startAudio, enumerateInputs } from './AudioDetector.js';
import { Run, difficultyToTimePerNoteMs } from './GameState.js';
import { quantize, midiToName } from './notes.js';
import { GameClient } from './game-client.js';
import { SafeZoneRenderer } from './ui/SafeZoneRenderer.js';
import { laneX } from './TrackSystem.js';
```

The exported names (`createScene`, `startAudio`, `enumerateInputs`, `Run`, `difficultyToTimePerNoteMs`, `laneX`) are unchanged — only the file paths change.

## Internal Import in SceneManager.js (was scene.js)

Line 8 of `scene.js` (will become `SceneManager.js`):
```js
import { laneX, cameraForPitch, SPAWN_Z } from './grid.js';
```
Must become:
```js
import { laneX, cameraForPitch, SPAWN_Z } from './TrackSystem.js';
```

## Import in SafeZoneRenderer.js

Line 3 of `static/game/ui/SafeZoneRenderer.js`:
```js
import { SPAWN_Z } from '../grid.js';
```
Must become:
```js
import { SPAWN_Z } from '../TrackSystem.js';
```

---

## Architecture Guardrails

- **No string literals** for phases — not relevant yet, but do not introduce any
- **No external dependencies** — stub files are vanilla JS only
- **Module naming:** Class name matches file name exactly (`GameLoop.js` exports `class GameLoop`)
- **Test location:** `tests/unit/js/` — all JS tests live here (vitest.config.js confirms this)
- **No bundler** — plain ES modules, no build step needed for renames

---

## Verification Steps

After completing all changes, run:

```bash
rtk vitest
```

Expected outcome: All tests in `grid.test.js`, `runState.test.js`, `audio.test.js` pass (they import from new file names). All ATDD scaffold tests remain skipped (not failures — `it.skip` is different from `it` failure). Zero import errors.

Also verify by grep — must cover both `static/` and `tests/` since old imports exist in test files too:
```bash
rtk grep "grid\.js|runState\.js|scene\.js|audio\.js" static/ tests/
```
All should return no matches.

---

## Known Constraints

- `scene.js` has its own internal import of `grid.js` — this is easy to miss. Update it when renaming.
- `SafeZoneRenderer.js` in `static/game/ui/` also imports from `../grid.js` — easy to miss due to different directory depth.
- The ATDD test files (`TrackSystem.test.js`, `GameState.test.js`, etc.) import from not-yet-existing new modules and will fail at import time if their `it.skip` is removed. Leave them as-is — they are red-phase scaffolds for later stories.
- `game-client.js` does NOT import from any of the old module names — no changes needed there.
- `notes.js`, `yin.js`, `yin-worklet.js`, `stringPalette.js`, `notes.js` — none of these import old names, no changes needed.

---

## Definition of Done

- [x] 4 source files renamed, originals deleted
- [x] 3 stub modules created
- [x] All imports in main.js updated (4 paths)
- [x] SceneManager.js internal import updated (1 path)
- [x] SafeZoneRenderer.js import updated (1 path)
- [x] grid.test.js import updated → tests pass
- [x] runState.test.js import updated → tests pass
- [x] audio.test.js import updated → tests pass
- [x] `rtk vitest` passes with no new failures (2 pre-existing SafeZoneRenderer Z-positioning failures confirmed via git stash; skip != failure)
- [x] No functional references to `grid.js`, `runState.js`, `scene.js`, `audio.js` remain in `static/game/` or `tests/` (one comment-only mention in ATDD scaffold TrackSystem.test.js — left as-is per story instructions)

---

## Dev Agent Record

### Completion Notes

Implemented 2026-05-21. Pure mechanical rename + scaffold, no logic changes.

- Renamed `runState.js` → `GameState.js`, `audio.js` → `AudioDetector.js`, `grid.js` → `TrackSystem.js`, `scene.js` → `SceneManager.js` (verbatim content, originals deleted).
- Created stubs `GameLoop.js`, `CartSystem.js`, `DifficultyManager.js` with named exports (matching ATDD scaffold import style).
- Updated 4 imports in `main.js`, 1 import in `SceneManager.js` (internal grid.js ref), 1 import in `SafeZoneRenderer.js`.
- Updated import paths in `grid.test.js`, `runState.test.js`, `audio.test.js` — all 3 test suites pass.
- 2 pre-existing SafeZoneRenderer Z-positioning test failures confirmed via git stash; not introduced by this story.

---

## File List

- `static/game/GameState.js` (renamed from runState.js)
- `static/game/AudioDetector.js` (renamed from audio.js)
- `static/game/TrackSystem.js` (renamed from grid.js)
- `static/game/SceneManager.js` (renamed from scene.js)
- `static/game/GameLoop.js` (new stub)
- `static/game/CartSystem.js` (new stub)
- `static/game/DifficultyManager.js` (new stub)
- `static/game/runState.js` (deleted)
- `static/game/audio.js` (deleted)
- `static/game/grid.js` (deleted)
- `static/game/scene.js` (deleted)
- `static/game/main.js` (updated imports)
- `static/game/ui/SafeZoneRenderer.js` (updated import)
- `tests/unit/js/grid.test.js` (updated import path)
- `tests/unit/js/runState.test.js` (updated import path)
- `tests/unit/js/audio.test.js` (updated import path)

---

## Change Log

- 2026-05-21: Renamed 4 JS modules to architectural names, created 3 stub modules, updated all import paths. Story 1.1 complete.
