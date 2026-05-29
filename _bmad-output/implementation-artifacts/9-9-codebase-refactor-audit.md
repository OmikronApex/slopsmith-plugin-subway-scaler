# Story 9.9: Codebase Refactor Audit — Dead Code, Consolidation & Decomposition Opportunities

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-9
**Story Key:** 9-9-codebase-refactor-audit
**Depends on:** 9-8 (all extractions and deferred-work resolution complete)

---

## Context

Stories 9-1 through 9-8 completed targeted fixes and module extractions. Now that the dust has settled, a full codebase scan is needed to surface remaining modularization opportunities (especially in `main.js` and `SceneManager.js`), dead/unused code, duplicated constants, backend/frontend split concerns, and performance overhead. This story **produces a findings document only** — no production code is changed. The document feeds a follow-on implementation story (Epic 10 or 9-10).

The previous extractions (VariantController, NoteAcceptor, GamePoller) reduced `main.js` from ~1300 lines to ~1169 lines and moved three major concerns out. `SceneManager.js` remains 2247 lines with no decomposition. The backend (`game_engine.py` at 667 lines, `game_router.py` at 328 lines) has never been reviewed for split opportunities.

---

## User Story

As a **developer**,
I want a comprehensive audit document listing all dead code, duplicate constants, further modularization candidates, and performance concerns,
so that a future implementation story has concrete, prioritized findings to act on without re-reading the whole codebase.

---

## Acceptance Criteria

**AC-1 — Dead code inventory complete:**
Given a scan of all files under `static/game/` and `services/`,
When the audit document is produced,
Then every unused import, unused variable, unreachable function, and stub retained for "backward compatibility" is listed with: file path, line number(s), symbol name, and a one-line removal rationale.
Confirmed candidates to start from (verify still present after 9-8 lands):
- `main.js:14` — `quantize` imported from `./notes.js` but never called in `main.js`
- `main.js:51` — `NOTE_NAMES` array declared but never referenced
- `main.js:25` — `DIAG_CROSS_MS = 1200` declared but never read (only `dynamicDiagMs` is used at runtime)
- `main.js:359` — `function updateVariantHud() {}` — explicitly commented "Stub retained for backward compatibility — variant HUD retired"
- `main.js:286-291` — legacy `expectedEl`, `feedbackEl`, `overlay`, `pauseBtn` (old HUD elements) vs. Epic 8 HudShell replacements — verify which, if any, are rendered dead by the HudShell layer
- `services/` — scan for any route handlers, helper functions, or schema fields that exist but are never called from the frontend after the Epic 9 extractions

**AC-2 — Duplicated constants catalogue:**
Given a scan for constants defined more than once across the frontend module graph,
When the audit document is produced,
Then each duplicate is listed with: constant name, value, all files+lines that define it, and a proposed canonical home.
Confirmed duplicates to start from:
- `DIAG_LEN = 45` — defined in both `main.js:28` and `SceneManager.js:23`
- `LANE_W = 1.4` — defined in both `main.js:29` and `SceneManager.js:20`
- `DIAG_CROSS_MS = 1200` — defined in both `main.js:25` and `SceneManager.js:808`
- Any additional numeric literals used with the same value in ≥3 places that should be named constants

**AC-3 — `SceneManager.js` decomposition candidates documented:**
Given a review of `SceneManager.js` (2247 lines, single export `createScene`),
When the audit document is produced,
Then candidate sub-modules are identified and described with:
  - Proposed module name and file path
  - Lines/functions it would contain
  - Public API surface it would expose
  - Dependencies it would need injected
  - Risk level (low / medium / high) for extraction
Suggested candidate clusters to evaluate (not exhaustive):
  - **Floor/tile rendering** — `makeFloorTile`, `FLOOR_*` constants, tile recycling logic (~lines 109–200)
  - **Lamppost pool** — `makeLamppostGroup`, `createLamppostPool`, `createVariantLamppostPool`, `clearVariantLamppostPool`, `_disposeLamppost` (~lines 201–270)
  - **Building pool** — `makeBuildingGroup`, `randomiseBuildingGroup`, `createBuildingPool`, `createVariantBuildingPool`, `clearVariantBuildingPool`, `placeBuildingBehindPool`, `recyclePool`, building-gap/reservation system (~lines 272–530)
  - **Cart/wave rendering** — `makeCart`, `bodyMaterial`, wave mesh create/update/recycle logic
  - **Character/sprite** — `generatePlaceholderFrames`, `initSpriteFrames`, `_frameTimeline`, sprite animation update
  - **Variant track geometry** — `spawnVariantTracks`, `finalizeVariantTransition`, `dismissVariantTracks`, bend piece creation, diagonal mesh management
  - **Camera system** — `setCameraMode`, `setRidingCameraTarget`, `setTargetCameraX`, camera lerp logic in render loop

**AC-4 — `main.js` remaining responsibilities mapped:**
Given the current `main.js` after 9-4/9-5/9-6 extractions,
When the audit document is produced,
Then every distinct responsibility still living in `main.js` is listed as either:
  - `KEEP` — belongs at orchestration level (lifecycle, wiring, setup screen, RAF loop entry point), OR
  - `EXTRACT` — has a clear single-concern home (proposed module name, why it belongs there)
Focus areas:
  - The transition-phase listener registration block (lines ~483–765) — still ~280 lines of inline callbacks; evaluate whether these belong in a `TransitionOrchestrator` module
  - `onDiagComplete` / `applyPromoteResponse` — cinematic handoff logic currently inline as closures; evaluate extraction
  - Bootstrap helpers `el()`, `fetchJson()`, `showOverlay()` — could live in a `ui/bootstrap-utils.js`
  - Test-mode keyboard burst injection (`_burstInjectNote`, `_injectTestNote`) and `__TEST_MODE` wiring blocks — could extract to `test/test-hooks.js` (tree-shaken in production)

**AC-5 — Backend/frontend split evaluation:**
Given a review of `services/game_engine.py`, `services/game_router.py`, and the frontend's API call patterns,
When the audit document is produced,
Then the following questions are answered with a concrete recommendation (keep / move / remove) and rationale:
  - Which pieces of game state are managed server-side that could safely move client-side (reducing round-trips)?
  - Which pieces of client state currently require a server round-trip that could be computed locally?
  - Are there any endpoints polled more frequently than needed given actual state-change rates?
  - Does the session-persistence model (server holds `GameSession` per session_id) provide value beyond what a stateless API + richer client state would provide? Evaluate trade-offs for current scale (single-user plugin).
  - Are there any backend route handlers that are never called from the current frontend?

**AC-6 — Performance overhead candidates documented:**
Given a review of the RAF game loop, audio pipeline, and Three.js scene update path,
When the audit document is produced,
Then each identified overhead item includes: description, estimated impact (low/medium/high), and a proposed mitigation.
Areas to evaluate:
  - `ResizeObserver` on `shell` — fires on every pixel resize; evaluate debounce
  - Per-frame `scene.getActiveWaveCount()` and `scene.getLastCollisionDebug()` — check if these traverse geometry every frame or use cached values
  - `safeZoneRenderer.update()` call signature passes a lane-X closure every frame — check if closure allocation is on the hot path
  - `waveScheduler.tick()` + `waveScheduler.waves` — verify no array copies per frame
  - Three.js `renderer.render()` call — check if any unconditional geometry rebuilds happen inside per frame
  - Backend poll interval vs. actual state-change rate — is 1-second polling over-/under-sampling?
  - `DebugLogger` batching — check if log flush is synchronous on the game loop

**AC-7 — Value/variable consolidation opportunities:**
Given a review of all JS modules and Python services,
When the audit document is produced,
Then variables, flags, or fields that carry the same semantic value under different names across the codebase are listed with a consolidation proposal.
Examples to check:
  - `run.cursor` (frontend) vs. `current_note_index` (backend) — same concept, different names; document where the translation happens and whether it can be unified
  - `gameStartTime` (main.js) vs. `game_now` computed as `_now() - gameStartTime` — check if this offset is re-computed in multiple places
  - `_pauseReason` scoped in `bootstrap` vs. session pause state in `window.__gameState.session` — evaluate single source of truth

**AC-8 — Findings document written and structured:**
Given all findings from AC-1 through AC-7,
When the audit is complete,
Then a file `_bmad-output/implementation-artifacts/refactor-findings.md` exists with:
  - Section per AC area (Dead Code, Duplicated Constants, SceneManager Decomposition, main.js Responsibilities, Backend/Frontend Split, Performance, Consolidation)
  - Each finding numbered (e.g., `DC-1`, `CONST-1`, `SM-1`, `MAIN-1`, `BE-1`, `PERF-1`, `CONS-1`)
  - Each finding includes: file(s), line(s), description, recommendation, risk (low/medium/high), estimated LOC delta
  - A prioritized top-10 list at the top of the document (highest impact × lowest risk)
  - All findings marked as `CONFIRMED` (verified in current code) or `CANDIDATE` (needs verification after 9-8 lands)

**AC-9 — No production code changed:**
Given the scope of this story,
When the story is marked done,
Then zero modifications have been made to any file outside `_bmad-output/implementation-artifacts/`.
This is an audit-only story.

---

## Technical Notes

### Known Dead Code (confirmed before 9-8)

| Symbol | File | Line | Evidence |
|--------|------|------|----------|
| `quantize` | `main.js` | 14 | Imported, zero call sites in file |
| `NOTE_NAMES` | `main.js` | 51 | Declared, zero references in file |
| `DIAG_CROSS_MS` | `main.js` | 25 | Declared, zero read references (only `dynamicDiagMs` used) |
| `updateVariantHud` | `main.js` | 359 | Stub with explicit "variant HUD retired" comment |
| `CartSystem.js` | entire file | — | No frontend import found; may be backend-only or orphaned |
| `DifficultyManager.js` | entire file | — | No frontend import found; same question as CartSystem |

### Confirmed Duplicate Constants

| Constant | Value | Locations |
|----------|-------|-----------|
| `LANE_W` | 1.4 | `main.js:29`, `SceneManager.js:20` |
| `DIAG_LEN` | 45 | `main.js:28`, `SceneManager.js:23` |
| `DIAG_CROSS_MS` | 1200 | `main.js:25`, `SceneManager.js:808` |

Proposed canonical home: `static/game/TrackSystem.js` already exports `laneX` and `SPAWN_Z` — geometry constants belong there. Alternatively a new `static/game/constants.js`.

### SceneManager Scale

`SceneManager.js` is 2247 lines with a single `createScene()` export returning ~40 methods. The file has natural internal clusters (floor, lamppost, buildings, carts, character/sprite, variant tracks, camera, collision, render loop) that are already grouped by comment blocks. Extraction risk is medium overall because the clusters share the Three.js scene object and several shared pools, but these can be passed as constructor arguments.

### Backend/Frontend Split Context

The server holds a `GameSession` object per `session_id` in memory (single-process, no persistence). The frontend polls `/session` every ~1 second for score and speed_multiplier. After Epic 9, the main write operations are: `play_note` (note acceptance + cursor advance), `propose_variant`, `accept_variant`, `promote_variant`. The primary question is whether cursor/score tracking must stay server-side (for multi-device or persistence scenarios) or could be client-only (simplifying the API to stateless note-validation calls).

### Files to Scan

**Frontend:**
- `static/game/main.js` (1169 lines)
- `static/game/SceneManager.js` (2247 lines)
- `static/game/VariantController.js`, `NoteAcceptor.js`, `GamePoller.js` (recently extracted — may have leftover dead code from extraction)
- `static/game/WaveScheduler.js`, `GameState.js`, `TrackSystem.js`, `TransitionPhases.js`
- `static/game/ui/*.js` — especially `SafeZoneRenderer.js`, `overlay.js`, `setup.js`
- `static/game/game-client.js` — verify all methods are called

**Backend:**
- `services/game_engine.py` (667 lines)
- `services/game_router.py` (328 lines)
- `services/schemas.py`, `services/tabulator.py`, `services/scales.py`

---

## Output Artifact

`_bmad-output/implementation-artifacts/refactor-findings.md`

Structure:
```
# Refactor Findings

## Priority Top-10

## DC — Dead Code
## CONST — Duplicated Constants
## SM — SceneManager Decomposition
## MAIN — main.js Remaining Responsibilities
## BE — Backend/Frontend Split
## PERF — Performance Overhead
## CONS — Value/Variable Consolidation
```

---

## Dev Notes

- Do **not** fix anything. Every finding goes into `refactor-findings.md`.
- For dead code findings, confirm the symbol has zero call sites across the entire `static/` tree (not just the file it's declared in) before marking `CONFIRMED`.
- For `CartSystem.js` and `DifficultyManager.js` — these appear to be frontend files with no import in the current module graph. Verify by searching all `import` statements across `static/game/`. If confirmed orphaned, mark as `DC` findings with HIGH removal confidence.
- The `promotingPhase` listener block in `main.js` (~lines 705–752) duplicates logic from `applyPromoteResponse` (~lines 624–671). Note this as a `MAIN` finding — both paths do a promote but one is the cinematic path (riding → promoting skipped) and one is the breather path. The duplication should be documented for consolidation.
- For performance findings, prefer evidence from code structure (e.g., object allocation in hot path) over speculation. Flag items as `CANDIDATE` if profiling is needed to confirm.

---

## Dev Agent Record

### Completion Notes

Audit completed 2026-05-29. All 9 ACs satisfied:

- **AC-1 (Dead code):** 12 confirmed dead-code findings (DC-1 through DC-12) including `quantize` import, `NOTE_NAMES`, `DIAG_CROSS_MS`, `updateVariantHud` stub, orphaned `CartSystem.js` and `DifficultyManager.js`, unused `Run` import in NoteAcceptor, orphaned `SceneManager` static class, 4 dead cinematic constants in SceneManager, `fail_session()` backend method, unused `/notes/{note_id}` endpoint, and empty `onGameOver` handler.
- **AC-2 (Duplicated constants):** 7 CONST findings including `LANE_W`, `DIAG_LEN`, `DIAG_CROSS_MS` (both dead), `MAX_BEND_YAW`, `FIRST_WAVE_ARRIVAL_DELAY_MS`, `REPOSITION_SLIDE_MS` (value mismatch 400 vs 200 flagged), `NOTE_NAMES`.
- **AC-3 (SceneManager decomposition):** 7 candidate sub-modules documented (SM-1 through SM-7): Floor, Lamppost, Building, Cart/Wave, Character/Sprite, Variant Geometry, Camera. Risk levels, API surfaces, and dependency injections specified for each.
- **AC-4 (main.js responsibilities):** 6 MAIN findings: TransitionOrchestrator extraction, cinematic closure consolidation, bootstrap-utils extraction, test-hooks extraction, duplicate promote paths, dual pause UI.
- **AC-5 (Backend/frontend split):** 6 BE findings including session-config overlap evaluation, vestigial `GameState(carts=[])` in responses, cursor dual-tracking contract, poll interval over-sampling, `fail_session` dead method, session persistence model evaluation.
- **AC-6 (Performance):** 8 PERF findings. Confirmed: ResizeObserver fires on setup screen (debounce recommended), CanvasTexture per-frame allocation for sprite (cache recommended), 200ms poll 12× over-sampled. Confirmed safe: getActiveWaveCount O(1), waves getter returns reference, no geometry rebuilds in render loop, DebugLogger async flush.
- **AC-7 (Consolidation):** 3 CONS findings: cursor dual-tracking contract (keep documented), `game_now` recomputed inline 6+ times (helper closure recommended), pause state split (keep, document).
- **AC-8 (Findings document written):** `_bmad-output/implementation-artifacts/refactor-findings.md` produced with all sections, numbered findings, CONFIRMED/CANDIDATE status, risk levels, LOC estimates, and prioritized top-10.
- **AC-9 (No production code changed):** Zero modifications to any file outside `_bmad-output/implementation-artifacts/`.

### Notable findings

- `REPOSITION_SLIDE_MS` value mismatch (400ms in `main.js` vs 200ms in `SceneManager.js`) flagged as latent bug risk — SceneManager copy is dead but the values disagree.
- `SceneManager` static class (2127–2247) is a full 120-line orphan — never imported or instantiated anywhere in the current module graph.
- `CartSystem.js` and `DifficultyManager.js` are confirmed orphaned frontend files — zero imports found across all `static/game/*.js`.

---

## File List

- `_bmad-output/implementation-artifacts/refactor-findings.md` (created)
- `_bmad-output/implementation-artifacts/9-9-codebase-refactor-audit.md` (status updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status updated)

---

## Change Log

- 2026-05-29: Story implemented — codebase audit complete, `refactor-findings.md` produced with 12 DC findings, 7 CONST findings, 7 SM decomposition candidates, 6 MAIN findings, 6 BE findings, 8 PERF findings, 3 CONS findings, prioritized top-10 list.
