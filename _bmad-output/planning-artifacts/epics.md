---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - prds/prd-subway-scaler.md
  - architecture.md
  - ux-design-specification.md
  - https://github.com/byrongamatos/slopsmith (official setup documentation)
---

# Subway Scaler - Epic Breakdown (with E2E Testing Infrastructure)

## Overview

This document provides the epic and story breakdown for slopsmith-plugin-subway-scaler, including the new Epic 0 for E2E Testing Infrastructure to support test-driven development across all epics.

---

## Extracted Requirements

### Functional Requirements (E2E Testing Focus)

**FR-E2E-001:** E2E tests must validate that the plugin loads successfully at localhost:8000 in the Slopsmith Docker container

**FR-E2E-002:** E2E tests must verify DOM renders without errors and all required HTML elements are present

**FR-E2E-003:** E2E tests must verify no console errors or warnings during plugin operation

**FR-E2E-004:** E2E tests must validate ARIA attributes are present and correct on all interactive elements

**FR-E2E-005:** E2E tests must validate keyboard navigation (Tab, Enter, Escape) works across all HTML surfaces

**FR-E2E-006:** E2E tests must validate focus management (focus trap, focus restoration) on overlays and forms

**FR-E2E-007:** E2E tests must validate game loop execution, character movement, and score increment

**FR-E2E-008:** E2E tests must validate collision detection triggers game-over overlay with correct final score

**FR-E2E-009:** E2E tests must validate pause/resume overlay functionality and keyboard shortcuts

**FR-E2E-010:** E2E tests must validate variant track rendering and decision window timer behavior

### Non-Functional Requirements (E2E Testing)

**NFR-E2E-001:** Docker development setup must mount local repository at `/app/plugins/subway-scaler` with hot-reloading

**NFR-E2E-002:** E2E test harness must be Playwright-based with configurable browser targets (Chrome, Firefox, Safari, Edge)

**NFR-E2E-003:** Tests must execute within Slopsmith Docker container environment at localhost:8000

**NFR-E2E-004:** Test suite must complete in under 5 minutes for standard baseline tests

**NFR-E2E-005:** Test framework must provide helper utilities for common plugin interactions (setup form, game start, pause, etc.)

**NFR-E2E-006:** Test results must be machine-readable (JSON) for CI/CD integration

**NFR-E2E-007:** Tests must capture screenshots/videos on failure for debugging

### Additional Requirements (Architecture & Docker Integration)

- Docker development environment must support volume mounting from local repository
- Plugin must auto-reload when local files change
- Test harness must be able to interact with Slopsmith UI at localhost:8000
- Tests must validate plugin.json manifest, API routes, and UI rendering
- Tests must support both headless and headed browser execution for debugging
- Test infrastructure must be reusable across all Epics 1-5

### E2E Testing Requirements by Epic

**Standard E2E Test Suite** (applies to every Epic):
- Plugin loads at localhost:8000
- DOM renders without errors
- No console errors or warnings
- ARIA attributes present and correct (accessibility baseline)
- Keyboard navigation functional (Tab, Enter, Escape)
- Focus management working (focus trap, restoration)

**Epic 0 (This Epic):** E2E Testing Infrastructure
- Docker dev setup with local volume mount at `/app/plugins/subway-scaler`
- Playwright test harness and helper library
- Standard baseline test suite
- Test integration into npm scripts and CI/CD

**Epic 1:** Setup form, localStorage persistence, error handling on fetch failure

**Epic 3:** Game loop runs, character moves, score increments, collision triggers game-over

**Epic 4:** Pause overlay appears/disappears, game-over overlay shows correct score/context, keyboard/focus work

**Epic 5:** Variant track renders, decision window timer counts down, variant acceptance transitions smoothly

---

## Docker Development Setup Specification

**Environment:** Slopsmith Docker container with plugin mounted locally

**Volume Mount:**
```
Local Repository Path: {project-root}/
Container Plugin Path: /app/plugins/subway-scaler
```

**Access Point:** http://localhost:8000

**Development Features Required:**
- Hot-reload on file change
- Console error/warning visibility in browser DevTools
- ARIA attribute inspection via DevTools
- Keyboard event inspection and focus tracking

---

## Playwright Test Framework Specification

**Test Runner:** Playwright (supports Chrome, Firefox, Safari, Edge)

**Test Location:** `tests/e2e/` directory with structure:
- `tests/e2e/fixtures/` — Page objects and fixtures
- `tests/e2e/helpers/` — Plugin interaction utilities
- `tests/e2e/specs/` — Individual test files
- `tests/e2e/screenshots/` — Failure artifacts

**Helper Library Functions:**
- `startGame(config)` — Navigate setup, select settings, START
- `pauseGame()` — Trigger pause, verify overlay
- `queryElement(selector)` — Get element + ARIA attributes
- `assertAria(selector, expected)` — Verify ARIA attributes
- `assertDomPresent(selector, attributes)` — Verify DOM structure
- `screenshot(name)` — Capture for debugging

**Test Output:** JSON report for CI/CD integration

---

---

## Epic List

### Epic 0: E2E Testing Infrastructure

Developers can validate the entire plugin user journey (setup → play → pause → variant → game-over) using automated E2E tests within Slopsmith Docker environment.

**User Outcomes:**
- Developers run comprehensive E2E tests locally before committing
- CI/CD validates plugin behavior against Slopsmith UI
- All future epics (1-5) have passing E2E tests as acceptance criteria
- Docker development environment with hot-reload enables rapid iteration

**Stories:**
- 0-1: Docker Development Setup
- 0-2: Playwright Test Harness
- 0-2a: Mocked Audio Input Device
- 0-3: Standard Baseline Test Suite
- 0-4: Test Integration & Templates

**FRs Covered:** FR-E2E-001, FR-E2E-002, FR-E2E-003, FR-E2E-004, FR-E2E-005, FR-E2E-006, FR-E2E-007, FR-E2E-008, FR-E2E-009, FR-E2E-010

**NFRs Covered:** NFR-E2E-001, NFR-E2E-002, NFR-E2E-003, NFR-E2E-004, NFR-E2E-005, NFR-E2E-006, NFR-E2E-007

---

## Requirements Coverage Map

### E2E Testing Requirements → Epic 0

| Requirement | Story | Coverage |
|---|---|---|
| FR-E2E-001 | 0-2, 0-3 | Plugin loads at localhost:8000 |
| FR-E2E-002 | 0-3 | DOM renders without errors |
| FR-E2E-003 | 0-3 | No console errors/warnings |
| FR-E2E-004 | 0-3 | ARIA attributes present and correct |
| FR-E2E-005 | 0-3 | Keyboard navigation functional |
| FR-E2E-006 | 0-3 | Focus management working |
| FR-E2E-007 | 0-2a, 0-3, 0-4 | Game loop runs, character moves, score increments |
| FR-E2E-008 | 0-2a, 0-3, 0-4 | Collision triggers game-over overlay |
| FR-E2E-009 | 0-3, 0-4 | Pause/resume overlay functionality |
| FR-E2E-010 | 0-4 | Variant track and timer testing |
| NFR-E2E-001 | 0-1 | Docker dev setup with `/app/plugins/subway-scaler` mount |
| NFR-E2E-002 | 0-2 | Playwright-based test framework |
| NFR-E2E-003 | 0-1, 0-2 | Tests run in Slopsmith Docker at localhost:8000 |
| NFR-E2E-004 | 0-4 | Tests complete in < 5 minutes |
| NFR-E2E-005 | 0-2 | Helper utilities for plugin interactions |
| NFR-E2E-006 | 0-4 | Machine-readable JSON test results |
| NFR-E2E-007 | 0-2, 0-3, 0-4 | Screenshot/video capture on failure |

---

---

### Epic 0.5: E2E Coverage Review

Developers have comprehensive E2E test coverage for all implemented epics and executable ATDD acceptance tests written in advance for open epics, ensuring regressions are caught automatically and new epics ship with a green test baseline from day one.

**User Outcomes:**
- Regressions in CartSystem, DifficultyManager, overlays, and accessibility are caught by CI before merge
- Epic 5 implementer has executable acceptance tests to work against (ATDD)
- Test gaps from Epics 2 and 4 are filled without duplicating existing Epic 3 coverage

**Stories:**
- 0.5a: E2E Coverage — Epic 2 (CartSystem & DifficultyManager observable behavior)
- 0.5b: E2E Coverage — Epic 4 (Overlays, keyboard shortcuts, ARIA accessibility)
- 0.5c: ATDD Scaffold — Epic 5 (Variant track & decision window — written to fail until Epic 5 ships)

**Coverage rationale:**
- Epic 1: ✅ Already covered by `epic1-setup.spec.ts` and `ux-design-audit.spec.ts`
- Epic 2: ❌ No dedicated spec — CartSystem and DifficultyManager have no E2E tests → Story 0.5a
- Epic 3: ✅ Well covered by `epic3-game.spec.ts`, `epic3-score.spec.ts`, `audio-injection.spec.ts`, `mic-access.spec.ts`, `canvas-overlay-alignment.spec.ts`
- Epic 4: ❌ No dedicated spec — Overlays, keyboard shortcuts, and ARIA untested → Story 0.5b
- Epic 5: ⏳ Not yet implemented → ATDD scaffold → Story 0.5c

---

## Requirements Coverage Map

### E2E Testing Requirements → Epic 0

| Requirement | Story | Coverage |
|---|---|---|
| FR-E2E-001 | 0-2, 0-3 | Plugin loads at localhost:8000 |
| FR-E2E-002 | 0-3 | DOM renders without errors |
| FR-E2E-003 | 0-3 | No console errors/warnings |
| FR-E2E-004 | 0-3 | ARIA attributes present and correct |
| FR-E2E-005 | 0-3, 0.5b | Keyboard navigation functional |
| FR-E2E-006 | 0-3, 0.5b | Focus management working |
| FR-E2E-007 | 0-2a, 0-3, 0-4, 0.5a | Game loop runs, character moves, score increments |
| FR-E2E-008 | 0-2a, 0-3, 0-4, 0.5a | Collision triggers game-over overlay |
| FR-E2E-009 | 0-3, 0-4, 0.5b | Pause/resume overlay functionality |
| FR-E2E-010 | 0-4, 0.5c | Variant track and timer testing |
| NFR-E2E-001 | 0-1 | Docker dev setup with `/app/plugins/subway-scaler` mount |
| NFR-E2E-002 | 0-2 | Playwright-based test framework |
| NFR-E2E-003 | 0-1, 0-2 | Tests run in Slopsmith Docker at localhost:8000 |
| NFR-E2E-004 | 0-4 | Tests complete in < 5 minutes |
| NFR-E2E-005 | 0-2 | Helper utilities for plugin interactions |
| NFR-E2E-006 | 0-4 | Machine-readable JSON test results |
| NFR-E2E-007 | 0-2, 0-3, 0-4 | Screenshot/video capture on failure |

---

## Epic 4: Session UX & Accessibility

### Story Sequence (with prerequisites)

**Timing Refactor Stories (MUST complete before 4-2):**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 4-1 | Implement Overlay Container with RGB-Shift Glitch Animation | done | — |
| 4-T1 | Strip Python Wave Queue and Expose timing_params | todo | — |
| 4-T2 | Implement WaveScheduler.js | todo | 4-T1 |
| 4-T3 | Rework CartSystem.js and SafeZoneRenderer.js to Consume WaveScheduler | todo | 4-T2 |
| 4-T4 | Wire WaveScheduler into GameLoop and Simplify main.js | todo | 4-T3 |

**Remaining Epic 4 Stories (require 4-T1 through 4-T4):**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 4-2 | Implement Pause Overlay | review | 4-T4 |
| 4-3 | Implement Game Over Overlay | todo | 4-T4 |
| 4-4 | Implement ARIA Roles and Keyboard Navigation | todo | 4-T4 |
| 4-5 | Implement Touch Targets and Final Accessibility Audit | todo | 4-4 |

**Rationale for 4-T prerequisite block:**
Stories 4-T1 through 4-T4 eliminate the dual-clock instability between Python's `time.time()` and
JS's `performance.now()`. Pause/resume timing, wave delivery lag, and cart pop-in are all symptoms
of this split. Story 4-2 (pause overlay) depends on reliable pause/resume; without the timing
refactor it would ship on top of a broken foundation. See `architecture.md` amendment (2026-05-22).

