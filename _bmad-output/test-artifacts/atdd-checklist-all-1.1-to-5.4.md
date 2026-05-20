---
stepsCompleted: [1, 2, 3, 4, "step-04c-aggregate", "step-05-validate-and-complete"]
lastStep: step-05-validate-and-complete
lastSaved: "2026-05-20"
scope: all-stories
stories: "1.1-5.4"
storyKey: all-1.1-to-5.4
storyId: all-1.1-to-5.4
atddChecklistPath: _bmad-output/test-artifacts/atdd-checklist-all-1.1-to-5.4.md
mode: ai-generation
stack: fullstack
generationDate: 2026-05-20
generatedTestFiles:
  - tests/contract/test_game_session_config.py
  - tests/unit/js/GameState.test.js
  - tests/unit/js/tokens.test.js
  - tests/unit/js/setup.test.js
  - tests/unit/js/CartSystem.test.js
  - tests/unit/js/DifficultyManager.test.js
  - tests/unit/js/SceneManager.test.js
  - tests/unit/js/TrackSystem.test.js
  - tests/unit/js/AudioDetector.test.js
  - tests/unit/js/GameLoop.test.js
  - tests/unit/js/score-display.test.js
  - tests/unit/js/overlay.test.js
  - tests/unit/js/aria.test.js
  - tests/unit/js/timer-bar.test.js
  - tests/integration/game_loop.test.js
---

# ATDD Checklist — All Stories 1.1–5.4

## Test Strategy Summary

**Mode:** AI generation (no browser automation — no Playwright installed)
**Stack:** Fullstack — Python/pytest (backend) + JS/vitest (frontend)
**Red-phase:** All scaffolds use skip markers. Tests assert correct behavior but are expected to fail until implementation.

### Skip Markers by Layer

| Layer | Framework | Skip Pattern |
|---|---|---|
| Python contract/integration | pytest | `@pytest.mark.skip(reason="red phase — not yet implemented")` |
| JS unit/integration | vitest | `it.skip(...)` or `describe.skip(...)` |

### Test File Map

| Story | Layer | Test File | Status |
|---|---|---|---|
| 1.1 | — | No new test file (existing tests verify renames pass) | n/a |
| 1.2 | JS unit | `tests/unit/js/GameState.test.js` | scaffold needed |
| 1.3 | JS unit | `tests/unit/js/tokens.test.js` | scaffold needed |
| 1.4 | Python contract | `tests/contract/test_game_session_config.py` | scaffold needed |
| 1.5 | — | No automated test (visual/font presence) | n/a |
| 1.6 | JS unit | `tests/unit/js/setup.test.js` | scaffold needed |
| 1.7 | JS unit | `tests/unit/js/setup.test.js` (same file, fetch-error describe block) | scaffold needed |
| 2.1 | — | No automated test (document analysis deliverable) | n/a |
| 2.2 | JS unit | `tests/unit/js/CartSystem.test.js` | scaffold needed |
| 2.3 | JS unit | `tests/unit/js/DifficultyManager.test.js` | scaffold needed |
| 3.1 | JS unit | `tests/unit/js/SceneManager.test.js` | scaffold needed |
| 3.2 | JS unit | `tests/unit/js/TrackSystem.test.js` | scaffold needed (rename from grid.test.js) |
| 3.3 | JS unit | `tests/unit/js/AudioDetector.test.js` | scaffold needed (rename from audio.test.js) |
| 3.4 | JS unit | `tests/unit/js/GameLoop.test.js` | scaffold needed |
| 3.5 | JS unit | `tests/unit/js/GameLoop.test.js` (tutorial describe block) | scaffold needed |
| 3.6 | JS unit | `tests/unit/js/score-display.test.js` | scaffold needed |
| 3.7 | — | No meaningful unit test (Three.js particle visual) | n/a |
| 3.8 | JS integration | `tests/integration/game_loop.test.js` | scaffold needed |
| 4.1 | JS unit | `tests/unit/js/overlay.test.js` | scaffold needed |
| 4.2 | JS unit | `tests/unit/js/overlay.test.js` (pause describe block) | scaffold needed |
| 4.3 | JS unit | `tests/unit/js/overlay.test.js` (game-over describe block) | scaffold needed |
| 4.4 | JS unit | `tests/unit/js/aria.test.js` | scaffold needed |
| 4.5 | — | No automated unit test (Lighthouse/axe audit manual) | n/a |
| 5.1 | JS unit | `tests/unit/js/DifficultyManager.test.js` (variant-offer describe block) | scaffold needed |
| 5.2 | JS unit | `tests/unit/js/TrackSystem.test.js` (variant-track describe block) | scaffold needed |
| 5.3 | JS unit | `tests/unit/js/timer-bar.test.js` | scaffold needed |
| 5.4 | JS integration | `tests/integration/game_loop.test.js` (variant-acceptance describe block) | scaffold needed |

### Note on Integration Test Discovery

Vitest config currently includes only `tests/unit/js/**/*.test.js`. The integration test at `tests/integration/game_loop.test.js` requires a config update to be picked up by `npm test`. Add to `vitest.config.js`:
```js
include: ['tests/unit/js/**/*.test.js', 'tests/integration/**/*.test.js'],
```

### Stories with No Automated Scaffolds

- **1.1** — File renames verified by running existing tests after rename; no new scaffold
- **1.5** — Vendored font + CSS breakpoints; verified visually; no unit scaffold
- **2.1** — Document deliverable; no test
- **3.7** — Three.js particle effect; no meaningful headless unit test
- **4.5** — Lighthouse/axe audit; manual verification documented in story completion notes

## Step 4 Aggregate — Generated Files (TDD Red Phase)

**Execution mode:** sequential (AI-generated directly, no subagent workers)
**TDD phase:** RED — all tests use `it.skip()` / `@pytest.mark.skip()` and assert expected behavior

### TDD Red Phase Compliance

- All JS tests: `it.skip(...)` ✅
- All Python tests: `@pytest.mark.skip(reason="red phase — not yet implemented")` ✅
- No placeholder assertions (`expect(true).toBe(true)`) ✅
- Activated tests will FAIL until feature implemented ✅

### Generated Test Files

| File | Stories | Tests | Status |
|---|---|---|---|
| `tests/contract/test_game_session_config.py` | 1.4 | ~5 | RED ✅ |
| `tests/unit/js/GameState.test.js` | 1.2 | ~8 | RED ✅ |
| `tests/unit/js/tokens.test.js` | 1.3 | ~8 | RED ✅ |
| `tests/unit/js/setup.test.js` | 1.6, 1.7 | ~12 | RED ✅ |
| `tests/unit/js/CartSystem.test.js` | 2.2 | 8 | RED ✅ |
| `tests/unit/js/DifficultyManager.test.js` | 2.3, 5.1 | ~10 | RED ✅ |
| `tests/unit/js/SceneManager.test.js` | 3.1 | ~6 | RED ✅ |
| `tests/unit/js/TrackSystem.test.js` | 3.2, 5.2 | ~10 | RED ✅ |
| `tests/unit/js/AudioDetector.test.js` | 3.3 | ~5 | RED ✅ |
| `tests/unit/js/GameLoop.test.js` | 3.4, 3.5 | 15 | RED ✅ |
| `tests/unit/js/score-display.test.js` | 3.6 | 5 | RED ✅ |
| `tests/unit/js/overlay.test.js` | 4.1, 4.2, 4.3 | 18 | RED ✅ |
| `tests/unit/js/aria.test.js` | 4.4 | 15 | RED ✅ |
| `tests/unit/js/timer-bar.test.js` | 5.3 | 9 | RED ✅ |
| `tests/integration/game_loop.test.js` | 3.8, 5.4 | 11 | RED ✅ |

**vitest.config.js updated** to include `tests/integration/**/*.test.js` ✅

### Acceptance Criteria Coverage

| AC | Story | Test File |
|---|---|---|
| session-config 200 + shape | 1.4 | test_game_session_config.py |
| session-config 404 unknown scale | 1.4 | test_game_session_config.py |
| session-config 422 invalid root_midi | 1.4 | test_game_session_config.py |
| snake_case fields only | 1.4 | test_game_session_config.py |
| GameState exports + PHASES | 1.2 | GameState.test.js |
| PHASES values correct | 1.2 | GameState.test.js |
| tokens.js palette injection | 1.3 | tokens.test.js |
| STRING_COLORS hex values | 1.3 | tokens.test.js |
| Setup form ARIA roles | 1.6, 4.4 | aria.test.js |
| toggle groups role=radiogroup | 4.4 | aria.test.js |
| overlay role=dialog + focus trap | 4.4 | aria.test.js |
| cart movement + removal | 2.2 | CartSystem.test.js |
| collision → GAME_OVER | 2.2 | CartSystem.test.js |
| score += 100 * multiplier | 2.2 | CartSystem.test.js |
| speed increment tick(true) | 2.3 | DifficultyManager.test.js |
| speed cap enforcement | 2.3 | DifficultyManager.test.js |
| variant offer at loop interval | 5.1 | DifficultyManager.test.js |
| SceneManager init + resize | 3.1 | SceneManager.test.js |
| SceneManager read-only GameState | 3.1 | SceneManager.test.js |
| TrackSystem init from session-config | 3.2 | TrackSystem.test.js |
| VARIANT_DIRECTION constants | 3.2 | TrackSystem.test.js |
| variant track slide in/out | 5.2 | TrackSystem.test.js |
| AudioDetector interface + error propagation | 3.3 | AudioDetector.test.js |
| GameLoop phase transitions | 3.4 | GameLoop.test.js |
| tick order: detect → cart → dm → render | 3.4 | GameLoop.test.js |
| tutorial hint + dismissal | 3.5 | GameLoop.test.js |
| score display aria-live=polite | 3.6 | score-display.test.js |
| score pulse animation | 3.6 | score-display.test.js |
| overlay entering/exiting classes | 4.1 | overlay.test.js |
| overlay ARIA attributes | 4.1 | overlay.test.js |
| prefers-reduced-motion fallback | 4.1 | overlay.test.js |
| pause heading normal / audio-error | 4.2 | overlay.test.js |
| Escape → resume | 4.2 | overlay.test.js |
| game-over score + context line | 4.3 | overlay.test.js |
| Escape does nothing in game-over | 4.3 | overlay.test.js |
| keyboard nav Arrow keys | 4.4 | aria.test.js |
| timer bar 100%→0% transition | 5.3 | timer-bar.test.js |
| timer bar color-accent | 5.3 | timer-bar.test.js |
| transitionend → hideVariant | 5.3 | timer-bar.test.js |
| prefers-reduced-motion static bar | 5.3 | timer-bar.test.js |
| session-config → score E2E (3 ticks) | 3.8 | game_loop.test.js |
| cart positions updated each tick | 3.8 | game_loop.test.js |
| phase stays PLAYING (no collision) | 3.8 | game_loop.test.js |
| variant acceptance → re-fetch | 5.4 | game_loop.test.js |
| rootMidi updated after variant | 5.4 | game_loop.test.js |
| speed reset after variant | 5.4 | game_loop.test.js |

### Next Steps — TDD Activation (Per Task)

When implementing each story, activate tests task-by-task:

1. Remove `it.skip(...)` / `@pytest.mark.skip(...)` from the relevant describe block
2. Run `npm test` (JS) or `.venv/Scripts/pytest` (Python)
3. Verify the activated test FAILS (confirms it targets real behavior)
4. Implement the feature
5. Verify the activated test PASSES (green phase)
6. Commit passing tests

### Pre-existing Test Failures (Not from ATDD scaffolds)

`tests/unit/js/SafeZoneRenderer.test.js` has 2 failing Z-positioning tests that pre-date this ATDD run. These are unrelated to the ATDD scaffold work and should be addressed separately.

---

## Step 5 — Validation & Completion Report

**Validated:** 2026-05-20  
**Stack adaptation:** vitest (JS unit/integration) + pytest (Python contract). Playwright-specific checklist items are N/A — this project has no browser automation layer.

### File Presence Verification

All 15 generated test files confirmed on disk:

| File | Confirmed |
|---|---|
| `tests/contract/test_game_session_config.py` | ✅ |
| `tests/unit/js/GameState.test.js` | ✅ |
| `tests/unit/js/tokens.test.js` | ✅ |
| `tests/unit/js/setup.test.js` | ✅ |
| `tests/unit/js/CartSystem.test.js` | ✅ |
| `tests/unit/js/DifficultyManager.test.js` | ✅ |
| `tests/unit/js/SceneManager.test.js` | ✅ |
| `tests/unit/js/TrackSystem.test.js` | ✅ |
| `tests/unit/js/AudioDetector.test.js` | ✅ |
| `tests/unit/js/GameLoop.test.js` | ✅ |
| `tests/unit/js/score-display.test.js` | ✅ |
| `tests/unit/js/overlay.test.js` | ✅ |
| `tests/unit/js/aria.test.js` | ✅ |
| `tests/unit/js/timer-bar.test.js` | ✅ |
| `tests/integration/game_loop.test.js` | ✅ |

### Skip Marker Compliance

- JS unit tests: all use `it.skip(...)` — ✅
- Python contract tests: all use `@pytest.mark.skip(reason="red phase — not yet implemented")` — ✅
- No placeholder assertions (`expect(true).toBe(true)`) — ✅
- Red phase confirmed: all scaffold files fail with "module not found" (implementation absent) — ✅

### AC Coverage Completeness

All acceptance criteria from epics.md stories 1.1–5.4 mapped to tests. Stories with no automated test (1.1, 1.5, 2.1, 3.7, 4.5) explicitly documented as N/A with rationale.

### Config Update

`vitest.config.js` updated — integration tests now discoverable:
```js
include: ['tests/unit/js/**/*.test.js', 'tests/integration/**/*.test.js']
```

### Checklist Items — Adapted Assessment

| Checklist Criterion | Status |
|---|---|
| Story ACs identified and mapped | ✅ |
| Test levels selected per AC | ✅ (JS unit / Python contract / JS integration) |
| Red-phase scaffolds generated | ✅ (15 files) |
| All tests skip-marked | ✅ |
| No passing tests before implementation | ✅ |
| Activation guidance documented | ✅ (Next Steps section) |
| Data factories (faker) | N/A — vitest unit tests use inline vi.fn() mocks |
| Playwright fixtures | N/A — no Playwright in this project |
| data-testid attributes | N/A — Three.js canvas, no DOM data-testid selectors |
| Execution commands provided | ✅ (`npm test`, `.venv/Scripts/pytest`) |
| Output file at correct path | ✅ |
| Pre-existing failures isolated | ✅ (SafeZoneRenderer documented separately) |

### Risks and Assumptions

1. **Implementation modules absent** — All scaffold imports reference modules that don't exist yet (`static/game/GameState.js`, `static/game/ui/overlay.js`, etc.). This is correct red-phase behavior. Tests will surface "module not found" until green phase begins.
2. **vitest node environment** — DOM interactions use `vi.stubGlobal('document', ...)` mocks. If implementation relies on browser APIs not covered by mocks, additional mock surface may be needed when activating tests.
3. **Integration test isolation** — `tests/integration/game_loop.test.js` uses `vi.stubGlobal('fetch', ...)` to mock network. Full integration against a live FastAPI server is out of scope for these scaffolds.
4. **SafeZoneRenderer Z-position failures** — 2 pre-existing failures unrelated to ATDD work. Should be fixed independently before merging.

### Completion Summary

| Metric | Value |
|---|---|
| Stories covered | 1.1–5.4 (18 automated, 5 N/A) |
| Test files generated | 15 |
| JS unit tests (it.skip) | ~130 |
| Python contract tests | ~5 |
| JS integration tests | ~11 |
| vitest config updated | Yes |
| Pre-existing failures | 2 (SafeZoneRenderer, pre-date ATDD) |
| Checklist output | `_bmad-output/test-artifacts/atdd-checklist-all-1.1-to-5.4.md` |

### Next Recommended Workflow

**`dev-story`** — Implement stories one at a time, activating tests task-by-task per the TDD activation sequence in the "Next Steps" section above.

Start with Story 1.2 (GameState module) — it is a foundational dependency for multiple other stories and its tests are the simplest to green.
