# Refactor Findings
## Codebase Audit — Dead Code, Consolidation & Decomposition Opportunities
*Story 9-9 · Generated 2026-05-29*

---

## Priority Top-10

Ranked by impact × (1 / risk):

| # | ID | Title | Impact | Risk | Est. LOC Δ |
|---|-----|-------|--------|------|-----------|
| 1 | DC-8 | `SceneManager` static class (Story 3.1 era) orphaned | High | Low | −120 |
| 2 | DC-5/6 | `CartSystem.js` + `DifficultyManager.js` orphaned frontend files | High | Low | −(file sizes) |
| 3 | CONST-6 | `REPOSITION_SLIDE_MS` value mismatch (400 vs 200) across files | High | Low | −5 |
| 4 | DC-9 | 4 cinematic constants dead-declared in `SceneManager.js` | Medium | Low | −6 |
| 5 | DC-3/4 | `DIAG_CROSS_MS` + `updateVariantHud` stub in `main.js` | Medium | Low | −4 |
| 6 | DC-1/2 | `quantize` + `NOTE_NAMES` unused imports/declarations in `main.js` | Low | Low | −2 |
| 7 | BE-2 | `GameState(carts=[])` bloat in `/start` + `/session` responses | Medium | Low | −20 |
| 8 | PERF-6 | 200ms poll interval over-samples state that changes on note events | Medium | Low | +1 |
| 9 | MAIN-5 | Duplicate promote paths: `promoting` listener vs `applyPromoteResponse` | High | Medium | −40 |
| 10 | SM-3 | Building pool extraction from `SceneManager.js` (~260 lines, clear API) | High | Medium | −260 |

---

## DC — Dead Code

### DC-1 — `quantize` unused import in `main.js`
- **File:** `static/game/main.js:14`
- **Symbol:** `quantize` (imported from `./notes.js`)
- **Description:** `quantize` is imported alongside `midiToName` but has zero call sites in `main.js`. It is actively used in `AudioDetector.js:3` which imports it directly from `notes.js`.
- **Recommendation:** Remove `quantize` from the `main.js` import statement; leave `midiToName`.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1

---

### DC-2 — `NOTE_NAMES` array unused in `main.js`
- **File:** `static/game/main.js:51`
- **Symbol:** `NOTE_NAMES`
- **Description:** `NOTE_NAMES = ['C', 'C#', ...]` is declared at module scope with zero references anywhere in `main.js`. An identical array is declared and used at `static/game/ui/FretBox.js:5`.
- **Recommendation:** Remove the `main.js` declaration entirely. If a shared constant is desired, move to `notes.js` or a future `constants.js` and import from there.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1

---

### DC-3 — `DIAG_CROSS_MS` declared but never read in `main.js`
- **File:** `static/game/main.js:25`
- **Symbol:** `DIAG_CROSS_MS = 1200`
- **Description:** Declared as a constant but never referenced in `main.js`. At runtime the diagonal crossing duration is computed dynamically as `DIAG_LEN / (diagSpeedPxMs * 0.5)` stored in `dynamicDiagMs`. The constant is also dead-declared in `SceneManager.js:808` (see DC-9).
- **Recommendation:** Remove from `main.js`. The live value is `dynamicDiagMs` which correctly reflects per-wave speed.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1

---

### DC-4 — `updateVariantHud()` stub in `main.js`
- **File:** `static/game/main.js:359`
- **Symbol:** `updateVariantHud`
- **Description:** Empty function stub with comment "variant HUD retired". Called once per RAF frame at line 880 (`updateVariantHud()`). The Epic 8 HudShell layer replaced this entirely.
- **Recommendation:** Remove the function declaration and the call site at line 880.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −3

---

### DC-5 — `CartSystem.js` orphaned frontend file
- **File:** `static/game/CartSystem.js`
- **Description:** No `import` statement anywhere in `static/game/` references `CartSystem.js`. The cart-rendering logic was absorbed into `SceneManager.js` (`makeCart()`, `bodyMaterial()`). The file was originally created in Epic 2 story 2-2.
- **Recommendation:** Verify file contents, then delete. Confirm no dynamic imports (e.g., `import(./CartSystem)`) exist.
- **Status:** CONFIRMED (zero imports found across all `static/` JS files)
- **Risk:** Low
- **LOC Δ:** −(file size)

---

### DC-6 — `DifficultyManager.js` orphaned frontend file
- **File:** `static/game/DifficultyManager.js`
- **Description:** No `import` statement anywhere in `static/game/` references `DifficultyManager.js`. Difficulty scaling is handled inline in `game_engine.py` (`speed_multiplier *= 1.02`) and via `difficultyToTimePerNoteMs()` in `GameState.js`.
- **Recommendation:** Verify file contents, then delete.
- **Status:** CONFIRMED (zero imports found across all `static/` JS files)
- **Risk:** Low
- **LOC Δ:** −(file size)

---

### DC-7 — `Run` unused import in `NoteAcceptor.js`
- **File:** `static/game/NoteAcceptor.js:5`
- **Symbol:** `import { Run } from './GameState.js'`
- **Description:** `Run` is imported but never instantiated or type-checked inside `NoteAcceptor.js`. The `run` instance is passed in via the `handle()` call context, not constructed here.
- **Recommendation:** Remove the import line.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1

---

### DC-8 — `SceneManager` static class orphaned (Story 3.1 era)
- **File:** `static/game/SceneManager.js:2127–2247`
- **Symbol:** `export class SceneManager`
- **Description:** The static `SceneManager` class (120 lines) was written in Story 3.1 as the original scene abstraction. It was superseded by the `createScene()` factory function (closure-based approach) in Story 3.1 or later. No code outside `SceneManager.js` ever calls `SceneManager.init()`, `SceneManager.render()`, or references the class. The only cross-call is `SceneManager.onResize()` called from within `SceneManager.init()` itself. `SafeZoneRenderer.js` imports only `applyWorldCurve` from the module; `main.js` uses only `createScene`.
- **Recommendation:** Delete the entire `SceneManager` class (lines 2127–2247) including its comment header. The export `applyWorldCurve` and `createScene` function are unaffected.
- **Status:** CONFIRMED
- **Risk:** Low — no external callers found
- **LOC Δ:** −120

---

### DC-9 — 4 cinematic constants dead-declared in `SceneManager.js`
- **File:** `static/game/SceneManager.js:807–810`
- **Symbols:** `MAX_BEND_YAW`, `DIAG_CROSS_MS`, `FIRST_WAVE_ARRIVAL_DELAY_MS`, `REPOSITION_SLIDE_MS`
- **Description:** All four constants are declared at module scope inside `createScene()` but never referenced anywhere in `SceneManager.js`. They appear to have been copy-pasted from `main.js` as documentation/reference. The live cinematic logic in `main.js` owns these values. Note: `REPOSITION_SLIDE_MS` value here (200) differs from `main.js` (400) — see CONST-6.
- **Recommendation:** Remove all four declarations from `SceneManager.js`. If any SceneManager function ever needs these values, they should be passed as parameters.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −6

---

### DC-10 — `fail_session()` backend method never called from router
- **File:** `services/game_engine.py:263`
- **Symbol:** `GameEngine.fail_session()`
- **Description:** `fail_session()` sets `session.status = "failed"` and `session.ended_at_ms`. It is never called from `game_router.py` or any other caller. Collision detection is entirely client-side (RAF loop in `main.js`); the backend never fails a session on its own initiative.
- **Recommendation:** Either wire it to a future `/fail` endpoint for server-authoritative failure, or remove it if the single-player design permanently delegates collision to the client.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −5

---

### DC-11 — `/game/notes/{note_id}` endpoint never called from frontend
- **File:** `services/game_router.py:96–104`
- **Route:** `GET /game/notes/{note_id}`
- **Description:** This endpoint returns `timer_window_ms` and `timer_window_tolerance_ms` for a specific note. No `fetch` or API call to this URL exists anywhere in `static/`. Timer window values are embedded in `timing_params` from `/start`.
- **Recommendation:** Remove the endpoint. If per-note timing customisation is ever needed, add it to the `/start` response.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −9

---

### DC-12 — `onGameOver` callback wired to empty function
- **File:** `static/game/main.js:901`, `static/game/GamePoller.js:12`
- **Symbol:** `onGameOver` parameter
- **Description:** `GamePoller` accepts `onGameOver` for server-detected failure (`pollState.status === 'failed'`). The constructor at `main.js:901` passes `(reason) => {}` — an empty no-op. Actual game-over flow is driven by RAF loop collision detection, not the poll path. If the server ever detects a failure condition, it is silently dropped.
- **Recommendation:** Either remove the `onGameOver` callback from `GamePoller` (simplification) or wire it to `overlayMgr.show({ type: 'game-over' })` for server-authoritative game-over support.
- **Status:** CONFIRMED
- **Risk:** Low (no functional impact — server never reports `failed` currently)
- **LOC Δ:** −3 (remove parameter + dead parameter plumbing)

---

## CONST — Duplicated Constants

### CONST-1 — `LANE_W = 1.4` duplicated
- **Files:** `main.js:29`, `SceneManager.js:20`
- **Value:** `1.4`
- **Proposed canonical home:** `static/game/TrackSystem.js` (already exports `laneX`, `SPAWN_Z`, `LANE_X_SCALE`)
- **Status:** CONFIRMED
- **Risk:** Low — both files must be updated in sync
- **LOC Δ:** −1 (one declaration removed, one import added)

---

### CONST-2 — `DIAG_LEN = 45` duplicated
- **Files:** `main.js:28`, `SceneManager.js:23`
- **Value:** `45`
- **Proposed canonical home:** `static/game/TrackSystem.js` (geometric constant for track layout)
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1

---

### CONST-3 — `DIAG_CROSS_MS = 1200` duplicated (both copies dead)
- **Files:** `main.js:25` (dead — see DC-3), `SceneManager.js:808` (dead — see DC-9)
- **Value:** `1200`
- **Description:** Both copies are dead. The dynamic duration `dynamicDiagMs` replaces this at runtime. After DC-3 and DC-9 are applied, this constant disappears entirely with no need for a canonical home.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −2 (both removed)

---

### CONST-4 — `MAX_BEND_YAW` duplicated (SceneManager copy dead)
- **Files:** `main.js:24` = `Math.PI / 4`, `SceneManager.js:807` = `Math.PI / 4`
- **Description:** The `main.js` copy is active (used at lines 531–532). The `SceneManager.js` copy is dead (see DC-9). After DC-9 is applied, only one copy remains — no further action needed.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1 (SceneManager copy removed via DC-9)

---

### CONST-5 — `FIRST_WAVE_ARRIVAL_DELAY_MS = 500` duplicated (SceneManager copy dead)
- **Files:** `main.js:26`, `SceneManager.js:809`
- **Description:** Same pattern as CONST-4. `main.js` copy active; `SceneManager.js` copy dead. Resolved by DC-9.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1 (via DC-9)

---

### CONST-6 — `REPOSITION_SLIDE_MS` value MISMATCH across files
- **Files:** `main.js:27` = `400`, `SceneManager.js:810` = `200`
- **Description:** **Potential latent bug.** `main.js` uses 400ms for the cinematic exit slide (`scene.startCinematicExit(targetX, REPOSITION_SLIDE_MS)` and the `setTimeout` that fires `applyPromoteResponse`). `SceneManager.js` declares 200ms but the declaration is dead (see DC-9). Both values exist as documentation of intent — and they disagree. If `SceneManager.js` is ever updated to use this constant it would silently animate at half the intended speed.
- **Recommendation:** Delete the `SceneManager.js` copy (via DC-9). Verify the 400ms value in `main.js` matches the visual spec for the post-landing repositioning slide.
- **Status:** CONFIRMED (mismatch)
- **Risk:** Low (SceneManager copy is dead; mismatch only matters if DC-9 is not applied first)
- **LOC Δ:** −1

---

### CONST-7 — `NOTE_NAMES` duplicated (main.js copy dead)
- **Files:** `main.js:51`, `FretBox.js:5`
- **Description:** Same 12-element array in both files. The `main.js` copy is dead (see DC-2). `FretBox.js` owns the only active use via `midiToNoteName()` at line 19.
- **Recommendation:** Remove from `main.js` (DC-2). If shared use emerges, move to `notes.js` alongside `midiToName`.
- **Status:** CONFIRMED
- **Risk:** Low
- **LOC Δ:** −1 (via DC-2)

---

## SM — SceneManager Decomposition Candidates

`SceneManager.js` is 2247 lines with a single `createScene()` factory export. The file has natural internal clusters already grouped by comment blocks. The static `SceneManager` class (DC-8) will reduce it to ~2127 lines when removed.

### SM-1 — Floor/Tile Rendering
- **Proposed module:** `static/game/scene/FloorRenderer.js`
- **Lines/functions:** `makeFloorTile`, `FLOOR_*` constants, tile recycling logic (~lines 108–127, reset block lines 905–915)
- **Public API:** `create(scene)` → `{ tiles, update(delta), reset(), dispose() }`
- **Dependencies:** `THREE`, `applyWorldCurve`, `COLORS`, `FLOOR_*` constants (self-contained)
- **Risk:** Low — no shared mutable state with other clusters; only reads `lastWaveSpeed` (pass as parameter)
- **Est. LOC extracted:** ~50

---

### SM-2 — Lamppost Pool
- **Proposed module:** `static/game/scene/LampostPool.js`
- **Lines/functions:** `makeLamppostGroup`, `createLamppostPool`, `createVariantLamppostPool`, `clearVariantLamppostPool`, `_disposeLamppost`, lamppost scroll/flicker block in `render()` (~lines 201–270, ~1688–1727)
- **Public API:** `create(scene)` → `{ pools, update(delta, offsetX, variantOffsetX, suppressGaps, reservations), commitTransition(variantPools), reset(), dispose() }`
- **Dependencies:** `THREE`, `applyWorldCurve`, `COLORS`, `LAMP_*` constants, `BLDG_*` constants (for spacing), `reservationsFor()` (building gap system — couples lamppost and building modules)
- **Risk:** Medium — lamppost pool and building pool share the gap-reservation system and must coordinate `_commitBuildingTransition`; extraction order matters
- **Est. LOC extracted:** ~120

---

### SM-3 — Building Pool
- **Proposed module:** `static/game/scene/BuildingPool.js`
- **Lines/functions:** `makeBuildingGroup`, `randomiseBuildingGroup`, `createBuildingPool`, `createVariantBuildingPool`, `clearVariantBuildingPool`, `placeBuildingBehindPool`, `recyclePool`, building gap reservation system, retiring building logic, debug visualiser (~lines 272–530, ~1647–1682)
- **Public API:** `create(scene)` → `{ pools, update(delta, offsetX, variantOffsetX, suppressGaps), commitTransition(variantPools, worldOffsetX), setGap(id, spec), clearGap(id), reset(), dispose() }`
- **Dependencies:** `THREE`, `applyWorldCurve`, `COLORS`, `BLDG_*` constants
- **Risk:** Medium — building gap reservations are also read by lamppost pool (see SM-2); the `_commitBuildingTransition` function touches both pools and must remain coordinated
- **Est. LOC extracted:** ~260

---

### SM-4 — Cart/Wave Rendering
- **Proposed module:** `static/game/scene/WaveRenderer.js`
- **Lines/functions:** `makeCart`, `bodyMaterial`, `bodyMatByColour` map, wave create/update/recycle/ghost logic in `setWaves()` and wave scroll block in `render()` (~lines 584–604, 1321–1359, 1481–1489)
- **Public API:** `create(scene)` → `{ setWaves(waves, nowMs, gameStartTime, worldOffsetX, numLanes), getActiveWaveCount(), ghostExistingWaves(currentOffsetX), clearWaves(), clearWavesForTesting() }`
- **Dependencies:** `THREE`, `applyWorldCurve`, `COLORS`, `laneX`, `SPAWN_Z`, `FRONT_Z`
- **Risk:** Medium — `activeWaves` map is also read by `checkCollision()` and the wave-scroll block
- **Est. LOC extracted:** ~80

---

### SM-5 — Character/Sprite Animation
- **Proposed module:** `static/game/scene/CharacterSprite.js`
- **Lines/functions:** `generatePlaceholderFrames`, `initSpriteFrames`, `_frameTimeline`, `updateCharacterSprite`, `_spriteFrames*` state, `character` mesh, `CHAR_FOOT_Y` constant (~lines 642–773)
- **Public API:** `create(scene, camera)` → `{ mesh, update(nowGameMs, gameStartTime), reset(), setPositionX(x), getPositionX(), getPositionZ(), billboardToCamera(camera) }`
- **Dependencies:** `THREE`, `parseGifFrames`, `CHARACTER_*` token constants
- **Risk:** Low — self-contained; only shared state is `character.position.x` (pass as reference or expose getter/setter)
- **Est. LOC extracted:** ~130

---

### SM-6 — Variant Track Geometry
- **Proposed module:** `static/game/scene/VariantGeometry.js`
- **Lines/functions:** `buildVariantTrackGroup`, `clearVariantGeom`, `proposeVariantTracks`, `dismissVariantTracks`, `acceptVariantTracks`, `spawnVariantTracks`, `finalizeVariantTransition`, `_variantLaneX`, safe zone mesh create/scroll/dismiss, `areTracksLanded`, `setOnTracksLanded`, `isVariantSafeZoneAdjacent`, `getActiveSafeZones`, `clearVariantSafeZone`, `disableVariantMissCallback`, `isOutgoingCornerAtPlayer`, `getVariantInfo`, `_registerDismissGap`, `isBendMidpointReached` (~lines 972–1312, 1801–1874)
- **Public API:** large surface already exposed via `createScene()` return object; extraction keeps the same surface but groups it
- **Dependencies:** `THREE`, `applyWorldCurve`, building/lamppost pool (gap registration), `laneX`, `SPAWN_Z`, `DIAG_LEN`, `STRAIGHT_LEN`, `LANE_W`, `STRING_*` colors
- **Risk:** High — this cluster is the most deeply entangled with building gaps, lamppost positions, character traversal state (`_charTraversal`), pending tracks, and the `render()` scroll blocks; must be extracted after SM-2/SM-3 establish the gap API
- **Est. LOC extracted:** ~400

---

### SM-7 — Camera System
- **Proposed module:** `static/game/scene/CameraController.js`
- **Lines/functions:** `setCameraMode`, `setRidingCameraTarget`, `setTargetCameraX`, `getCharacterX`, camera lerp/ease/orbit logic in `render()` (~lines 1729–1795, 1838–1926)
- **Public API:** `create(camera, camBase, CAMERA_*_constants)` → `{ setCameraMode(mode), setTargetX(x), setRidingTarget(yaw, durMs), startCinematicExit(targetX, durMs), clearCinematicExit(), update(nowMs, currentCamX) → effectiveYaw }`
- **Dependencies:** `THREE` camera reference, `CAMERA_PITCH`, `CAMERA_DISTANCE`, `CAMERA_*` constants, `_easeInOutCubic`
- **Risk:** Medium — camera references `_charTraversal` indirectly via `_commitBuildingTransition` call; otherwise reasonably self-contained
- **Est. LOC extracted:** ~100

---

## MAIN — main.js Remaining Responsibilities

Current `main.js` after Epic 9 extractions: ~1169 lines.

### MAIN-1 — Transition-phase listener block should move to `TransitionOrchestrator`
- **Lines:** ~483–765 (~280 lines of inline `setTransitionPhaseListener` callbacks)
- **Classification:** EXTRACT → `static/game/TransitionOrchestrator.js`
- **Rationale:** The 7 phase listeners (`accepted`, `riding`, `breather`, `promoting`, `active`, `idle` + cleanup) form a self-contained state machine. They close over `scene`, `waveScheduler`, `variantController`, `fretBox`, `run`, and `gameClient` — all injectable. Extracting them would reduce `main.js` to ~900 lines and make the phase logic unit-testable.
- **Risk:** Medium — closures reference `notesResp`, `gameStartTime`, `_variantBreatherMs`, `poller` which are defined in `start()`; must be passed as a context object
- **Est. LOC Δ:** −260 (main.js) / +280 (new module)

---

### MAIN-2 — `onDiagComplete` / `applyPromoteResponse` cinematic handoff closures
- **Lines:** `onDiagComplete` ~593–622, `applyPromoteResponse` ~624–671
- **Classification:** EXTRACT → candidate for `TransitionOrchestrator.js` (see MAIN-1)
- **Rationale:** These two functions are the cinematic post-diagonal logic. They are currently defined as nested closures inside `start()` and could be promoted to module-level functions or moved to `TransitionOrchestrator`.
- **Risk:** Medium — same closure dependency concern as MAIN-1
- **Est. LOC Δ:** included in MAIN-1 estimate

---

### MAIN-3 — Bootstrap helpers should move to `ui/bootstrap-utils.js`
- **Lines:** `el()` ~53–65, `fetchJson()` ~67–72, `showOverlay()` ~1015–1023
- **Classification:** EXTRACT → `static/game/ui/bootstrap-utils.js`
- **Rationale:** These three helpers are generic DOM/fetch utilities with no game-logic dependencies. `el()` in particular is a mini-DSL that could benefit other UI modules. Currently none are exported, making them untestable.
- **Risk:** Low — pure functions, no side effects
- **Est. LOC Δ:** −15 (main.js) / +20 (new module with exports)

---

### MAIN-4 — Test-mode keyboard burst injection and `__TEST_MODE` wiring
- **Lines:** `_burstInjectNote` ~1136–1147, `_injectTestNote` ~1132–1135, keyboard listener ~1117–1131, `window.__gameState._test` block ~1026–1107
- **Classification:** EXTRACT → `static/game/test/test-hooks.js` (tree-shakeable in production)
- **Rationale:** Test infrastructure mixed into production bootstrap. Tree-shaking requires bundler support but at minimum a conditional import (`if (TEST_MODE) import('./test/test-hooks.js')`) isolates ~90 lines of test code.
- **Risk:** Low — no runtime impact; test functionality is gated on `TEST_MODE`
- **Est. LOC Δ:** −90 (main.js) / +95 (new module)

---

### MAIN-5 — Duplicate promote paths (promoting listener vs applyPromoteResponse)
- **Lines:** Promoting listener ~705–752 (~47 lines), `applyPromoteResponse` ~624–671 (~47 lines)
- **Classification:** EXTRACT (consolidate) — duplicate logic
- **Description:** Both paths call `gameClient.promoteVariant()`, update `run.sequence/cursor`, `ascendingNoteCount`, `rootNote/apexNote`, `scene.moveToTrack`, `scene.setLaneGeometry`, `fretBox.render`, `pushGameEvent`, `_debugLogger.log`, and `setTransitionPhase('active')`. The `applyPromoteResponse` path (riding→promoting skipped) additionally calls `scene.clearCinematicExit`, `scene.setTargetCameraX`, `scene.ghostExistingWaves`, `scene.finalizeVariantTransition`, and `safeZoneRenderer.reset()`. The structural duplication should be collapsed into a single `_applyPromoteRespShared(resp, ctx)` helper called by both paths.
- **Risk:** Medium — subtle path differences (safeZoneRenderer reset in breather path but not riding path) must be preserved; careful extraction needed
- **Est. LOC Δ:** −40

---

### MAIN-6 — Dual pause UI (`pauseBtn` vs `pauseButton`)
- **Lines:** `pauseBtn` DOM element ~287–290, `pauseButton` HudShell instance ~299
- **Classification:** KEEP both for now — but document the split
- **Description:** `pauseBtn` (class `pause-btn`) is a legacy DOM button inside `hud` div, used by the blur handler and keyboard nav. `pauseButton` is the Epic 8 HudShell `PauseButton` component. Both call `pauseGame()` on click. The user sees two pause mechanisms that must stay in sync (both call `pauseBtn.textContent = 'Resume'` etc.). A future cleanup story should consolidate to the HudShell `PauseButton` exclusively and remove the old `pauseBtn` DOM element.
- **Risk:** Medium — blur handler (`window.blur`) still uses `pauseBtn.textContent` directly; must audit all references before removal
- **Est. LOC Δ:** −15 (after consolidation)

---

## BE — Backend/Frontend Split

### BE-1 — `/session-config` endpoint overlaps with `/start` response
- **Files:** `services/game_router.py:19–93`, `static/game/ui/setup.js:268–275`, `services/game_router.py:107–163`
- **Description:** `/session-config` is called during setup to pre-validate the scale/instrument combination and display note names. `/start` then regenerates the same note sequence server-side. Both endpoints run `Tabulator.encode_scale` independently. The `/session-config` result is used only for the fret-box preview and range validation in `renderSetupScreen` — not retained for gameplay.
- **Recommendation:** KEEP both — they serve distinct UX purposes (preview vs. session initialization). But consider making `/start` accept an optional `session_config` token to avoid the double computation.
- **Risk:** Low (current design correct but slightly redundant)

---

### BE-2 — `GameState(carts=[])` bloat in `/start` and `/session` responses
- **Files:** `services/game_router.py:129–162`, `services/game_router.py:200–209`
- **Description:** Both `/start` and `/session` construct a `GameState(carts=[], track=Track(...), speed_multiplier=SpeedMultiplier(...))` and serialize it. The frontend never reads `response.game_state.carts` or `response.game_state.track` from these endpoints. The `speed_multiplier` is read from `response.speed_multiplier` directly (top-level), not from `response.game_state.speed_multiplier`. The `Track` and `SpeedMultiplier` pydantic models appear vestigial from an earlier API design.
- **Recommendation:** REMOVE `game_state` key from `/start` and `/session` responses. Retain `speed_multiplier` as a top-level field. Remove `GameState`, `Track`, `SpeedMultiplier` pydantic model definitions if unused elsewhere.
- **Risk:** Low (verify no test assertions read `response.game_state.track`)
- **Est. LOC Δ:** −20 (router) + −25 (schemas.py)

---

### BE-3 — `current_note_index` is dual-tracked (client + server)
- **Files:** `static/game/main.js` (`run.cursor`), `services/game_engine.py` (`session.current_note_index`)
- **Description:** `run.cursor` (frontend, 0-indexed) and `session.current_note_index` (backend, 0-indexed) track the same concept. They are kept in sync via explicit assignments: `run.cursor = resp.current_note_index ?? 0` after promote/accept. Translation point is `play_note` response (`session.current_note_index` advances) but the frontend independently advances `run.cursor` on correct detection — the two are reconciled only at variant boundaries.
- **Recommendation:** KEEP dual tracking for current architecture — the backend cursor is authoritative for variant logic and scoring; the client cursor drives collision/wave scheduling without a round-trip. Document the reconciliation contract (reconcile only at promote/start).
- **Risk:** Low (status quo is correct)

---

### BE-4 — Backend poll interval vs. state-change rate
- **Files:** `static/game/GamePoller.js:25`, `static/game/game-client.js:64`
- **Description:** The poller runs at 200ms intervals by default. Server state changes only on: `play_note` (per-note), `pause`/`resume`, `variant/*` calls. For a player hitting 1 note per ~2.5 seconds (medium difficulty), the poll is ~12× faster than meaningful state changes. The score update, which is the primary display value, could be pushed via the `play_note` response (already includes `score`) eliminating the need to poll for score at all.
- **Recommendation:** Increase poll interval to 1000ms (matches original 1-second design intent). Wire `play_note` response score directly to `ScoreDisplay.update()` (already done via `NoteAcceptor` — verify `poller` score path is then redundant). Consider removing score from poll response to reduce payload.
- **Risk:** Low
- **Est. LOC Δ:** +1 (change interval default)

---

### BE-5 — `fail_session()` never called — collision is client-only
- **Files:** `services/game_engine.py:263`, `services/game_router.py` (no call site)
- **Description:** Collision detection is 100% client-side (RAF loop in `main.js`). The server has no mechanism to fail a session. For the current single-user plugin this is correct and appropriate. See also DC-10.
- **Recommendation:** For current scale (single-user, no cheating concern): REMOVE `fail_session()` and document that collision is client-authoritative. If multi-user/anti-cheat is added in a future epic, re-introduce server-side failure with a `/fail` endpoint.
- **Risk:** Low

---

### BE-6 — Session persistence model evaluation
- **Description:** `GameEngine.sessions` holds `GameSession` objects in a Python dict (process memory). A `cleanup_sessions(ttl=3600)` GC fires at each `create_session`. For single-user (one session at a time), this is correct and has negligible overhead. A stateless API + richer client state would eliminate all `/session` polling and `/pause`/`/resume` round-trips, but would break variant server-side tracking (which currently validates `trigger_midi` and manages `active_variant` state). Evaluation: **Keep server-side state** for variant tracking integrity; it provides a natural place to add multi-device sync if needed. The polling overhead is the cost to optimize (see BE-4).
- **Recommendation:** KEEP current model. Address polling overhead separately (BE-4).

---

## PERF — Performance Overhead

### PERF-1 — `ResizeObserver` on `shell` fires on setup screen resize
- **File:** `static/game/main.js:311–316`
- **Description:** `new ResizeObserver(...).observe(shell)` fires on every pixel change to `shell`, which contains both the setup screen and the game container. During setup, resize events call `scene.resize(width, height)` even though the canvas isn't visible. The resize itself is cheap (no geometry rebuild) but the observer fires on any layout shift.
- **Impact:** Low — `scene.resize` is cheap; no geometry rebuild. Observable only during frequent setup-screen layout changes (e.g., browser zoom, mobile resize).
- **Recommendation:** Debounce with a 16ms `requestAnimationFrame` gate, or observe `canvas` directly instead of `shell`. Moving to `gameWrap` would prevent firing during setup.
- **Risk:** Low

---

### PERF-2 — `scene.getActiveWaveCount()` — O(1) Map size, not a traversal
- **File:** `static/game/main.js:808`, `static/game/SceneManager.js:2057`
- **Description:** `getActiveWaveCount()` returns `activeWaves.size` — an O(1) property on `Map`. Not a geometry traversal. Called 2× per RAF frame (loop collision log + wave count sync). No optimization needed.
- **Impact:** None
- **Recommendation:** KEEP as-is.

---

### PERF-3 — `safeZoneRenderer.update()` closure allocated every frame
- **File:** `static/game/main.js:865`
- **Code:** `(track) => laneX(track, _safeZoneLanes) + _safeZoneOffset`
- **Description:** A new arrow function is allocated on every RAF frame. `_safeZoneLanes` and `_safeZoneOffset` are local variables that change on variant transitions. The allocation (~1 object per frame at 60fps = ~60 short-lived closures/sec) is within V8's minor GC budget.
- **Impact:** Low — V8 young-gen GC handles this without frame drops. Only notable on very low-memory devices.
- **Recommendation:** CANDIDATE for optimization — extract to a persistent closure that reads the locals via stable references if profiling ever reveals GC pressure on low-end hardware.

---

### PERF-4 — `waveScheduler.waves` getter returns reference, not copy
- **File:** `static/game/WaveScheduler.js:77–79`
- **Description:** `get waves() { return this._waves; }` returns the internal array by reference. No per-frame copy. Safe.
- **Impact:** None
- **Recommendation:** KEEP as-is.

---

### PERF-5 — `renderer.render()` — no unconditional geometry rebuilds
- **File:** `static/game/SceneManager.js:1795`
- **Description:** Code scan of the `render()` function found no unconditional geometry (`new THREE.*Geometry`) construction in the hot path. Geometry is created only at wave creation, track rebuild, and variant proposal — all event-driven.
- **Impact:** None
- **Recommendation:** KEEP as-is.

---

### PERF-6 — 200ms poll interval over-samples vs. state-change rate
- **File:** `static/game/GamePoller.js:25`, `static/game/game-client.js:64`
- **Description:** See BE-4. Poll fires 5× per second; meaningful state changes happen ~0.4× per second at medium difficulty. ~12× over-sampling.
- **Impact:** Medium — 5 unnecessary HTTP round-trips per second to a local service. On a loaded desktop this is negligible; on a Raspberry Pi / low-power device it wastes CPU and increases battery draw.
- **Recommendation:** Increase to 1000ms (see BE-4).

---

### PERF-7 — `DebugLogger` batches asynchronously — no game-loop impact
- **File:** `static/game/DebugLogger.js:14`
- **Description:** `setInterval(() => this._flush(), 2000)` — flush runs on a 2-second timer, completely separate from the RAF loop. Log writes (`this._buffer.push(...)`) are synchronous array appends — O(1).
- **Impact:** None on the game loop.
- **Recommendation:** KEEP as-is.

---

### PERF-8 — `updateCharacterSprite()` creates `CanvasTexture` on each frame change
- **File:** `static/game/SceneManager.js:766`
- **Code:** `const tex = new THREE.CanvasTexture(_spriteFrames[frameIdx]); character.material.map = tex;`
- **Description:** Every sprite frame change creates a new `CanvasTexture` and assigns it. The previous texture is not explicitly disposed — it relies on JS GC to collect the old `CanvasTexture` object, but the GPU texture upload (VRAM) is only freed when the material's map is replaced AND the old texture has no other references. At 8fps sprite animation this creates ~8 textures/second that linger until the next GC cycle.
- **Impact:** Medium — on long play sessions (10+ minutes) accumulated VRAM from unreleased textures can total several MB. On desktop GPUs this is unnoticeable; on mobile/integrated GPUs it can cause incremental slowdown.
- **Recommendation:** Cache `CanvasTexture` objects per frame index (pre-create on `initSpriteFrames`), then reuse them each frame instead of constructing new ones. Dispose only when frames are replaced (on asset load).
- **Risk:** Low (optimization, no behavior change)
- **Est. LOC Δ:** +15

---

## CONS — Value/Variable Consolidation

### CONS-1 — `run.cursor` (frontend) vs `current_note_index` (backend) — documented translation contract
- **Description:** `run.cursor` is the frontend's authoritative cursor for wave-collision and safe-zone logic. `session.current_note_index` is the backend's authoritative cursor for scoring, variant-eligibility, and scale-progress tracking. Both are 0-indexed integers over the same note sequence.
- **Translation point:** `play_note` response advances the backend cursor; the frontend advances `run.cursor` independently on `Run.tick()` success. They are reconciled at `variant.promote` response via `run.cursor = resp.current_note_index ?? 0`.
- **Consolidation proposal:** For current single-user architecture — KEEP dual tracking. Document the contract: frontend cursor is the source-of-truth for collision; backend cursor is the source-of-truth for scoring and variant gating; reconcile only at promote/start boundaries.
- **Risk:** N/A (no change recommended)

---

### CONS-2 — `game_now = _now() - gameStartTime` recomputed inline 6+ times
- **File:** `static/game/main.js` (~lines 560, 602, 710, 727, 749, 854)
- **Description:** The expression `_now() - gameStartTime` is the canonical "game-relative time in ms". It is computed inline at 6+ call sites with different local variable names (`game_now`, `gameNow`, `landingGameNow` = variant thereof). The RAF loop assigns it to `game_now` at line 854 but inner closures recompute it ad-hoc.
- **Recommendation:** Within `start()`, expose a `gameNow()` helper closure: `const gameNow = () => _now() - gameStartTime;`. Replace all inline `_now() - gameStartTime` with `gameNow()`. This makes the relationship explicit and prevents drift if `gameStartTime` semantics change.
- **Risk:** Low
- **Est. LOC Δ:** +1 declaration, −5 inline repetitions (net −4)

---

### CONS-3 — Pause state tracked in two places (`_pauseReason` + `__gameState.session.phase`)
- **Files:** `static/game/main.js:345` (`_pauseReason`), `static/game/main.js:168` (`window.__gameState.session.phase`)
- **Description:** `_pauseReason` (module-level string: `'normal'` | `'audio-error'`) tracks *why* the game is paused, used to decide whether to attempt `audio.switchInput` on resume. `window.__gameState.session.phase` (`'paused'` | `'playing'` | ...) tracks *that* the game is paused, used by E2E tests and the HUD.
- **These serve different purposes** and should not be consolidated. However, `pauseGame()` sets both — they are well-coordinated.
- **Recommendation:** KEEP both. Add a comment at `_pauseReason` declaration clarifying it is not a duplicate of `session.phase` but carries the pause reason for the resume handler.
- **Risk:** N/A (no change to logic; documentation only)

---

## Summary of File-Level Impact

| File | Findings | Est. LOC Removed |
|------|---------|----------------|
| `static/game/main.js` | DC-1–4, CONST-1–7, MAIN-1–6, CONS-2–3 | ~370 (after MAIN extractions) |
| `static/game/SceneManager.js` | DC-8–9, CONST-1–6, SM-1–7 | ~460 (after class removal + constant cleanup) |
| `static/game/NoteAcceptor.js` | DC-7 | −1 |
| `static/game/CartSystem.js` | DC-5 | −(entire file) |
| `static/game/DifficultyManager.js` | DC-6 | −(entire file) |
| `services/game_engine.py` | DC-10, BE-5 | −8 |
| `services/game_router.py` | DC-11, BE-2 | −30 |
| `services/schemas.py` | BE-2 | −25 |
