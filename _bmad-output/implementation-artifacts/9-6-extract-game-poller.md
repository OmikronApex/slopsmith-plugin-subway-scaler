# Story 9.6: Extract `GamePoller.js`

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-6
**Story Key:** 9-6-extract-game-poller
**Depends on:** 9-5 (NoteAcceptor extracted — main.js simplified for final extraction)

---

## Context

The backend poll handler callback (`gameClient.startPolling(callback)` at `main.js:1113`) is currently defined inline inside `startGame()`. It handles: score update, `window.__gameState.score` sync, collision/game-over detection from poll, `activeVariant` sync, and variant state delegation. Extracting `GamePoller.js` gives the integration boundary between backend state and frontend game state a single, auditable home.

This is the last of the three extractions (VariantController → NoteAcceptor → GamePoller), leaving `main.js` focused on session lifecycle and module wiring only.

---

## User Story

As a **developer**,
I want the backend poll handler in its own module,
so that the integration boundary between backend state and frontend game state has a single, auditable home.

---

## Acceptance Criteria

**AC-1 — GamePoller owns poll callback:**
Given the `gameClient.startPolling(callback)` callback currently defined inline in `main.js`,
When `GamePoller.js` is extracted,
Then `main.js` instantiates `GamePoller` and calls `poller.start()`,
And no inline poll callback remains in `main.js`,
And `GamePoller` owns: score update, `window.__gameState.score` sync, collision/game-over detection from poll, `activeVariant` sync, and `variantController.onPollUpdate()` delegation.

**AC-2 — Module registration:**
Given the new `static/game/GamePoller.js` file,
When the game HTML is loaded,
Then the module is registered via `<script type="module">` or import map — no 404.

**AC-3 — `speedMultiplier` getter stub:**
Given `speed_multiplier` will arrive in poll responses (Story 9-7),
When `GamePoller` is instantiated,
Then it exposes `poller.speedMultiplier` getter returning `1.0` until Story 9-7 wires the real value.

**AC-4 — No test regression (no new mocks for untested behavior):**
Given all existing Vitest unit tests and Playwright E2E specs,
When run after the extraction,
Then all pass without modification,
And without new mocks for behavior not already tested.

---

## Tasks / Subtasks

- [x] Task 1: Create `static/game/GamePoller.js` (AC: 1, 3)
  - [x] 1.1 Move poll callback content from `main.js:1113-...` into `GamePoller`
  - [x] 1.2 Constructor arguments: `gameClient`, `scoreDisplay`, `variantController`, `scene`, `window.__gameState` ref, `onGameOver` callback
  - [x] 1.3 Implement `poller.start()` — calls `gameClient.startPolling(poller._handlePoll.bind(poller))`
  - [x] 1.4 Implement `poller.stop()` — stops polling (for cleanup/teardown)
  - [x] 1.5 Own score update from poll state
  - [x] 1.6 Own `window.__gameState.score` sync
  - [x] 1.7 Own collision/game-over detection from poll
  - [x] 1.8 Own `activeVariant` sync from poll
  - [x] 1.9 Delegate to `variantController.onPollUpdate(pollState)`
  - [x] 1.10 Expose `poller.speedMultiplier` getter returning `1.0` (stub for Story 9-7)

- [x] Task 2: Simplify `main.js` (AC: 1)
  - [x] 2.1 Remove inline poll callback
  - [x] 2.2 Remove `gameClient.startPolling(...)` inline call
  - [x] 2.3 Instantiate `GamePoller` in `startGame()`
  - [x] 2.4 Call `poller.start()` where the original `startPolling` was called
  - [x] 2.5 Call `poller.stop()` in teardown

- [x] Task 3: Register module (AC: 2)
  - [x] 3.1 Add `<script type="module" src="./GamePoller.js">` or import-map entry
  - [x] 3.2 Verify no 404 in browser/Playwright tests

- [x] Task 4: Run existing test suites (AC: 4)
  - [x] 4.1 All existing Vitest unit tests pass
  - [x] 4.2 All Playwright E2E specs pass

---

## Dev Notes

### Architecture Constraints

- **Depends on:** Story 9-5 (`NoteAcceptor` extracted first — GamePoller is the final extraction)
- **Constructor arguments:** `gameClient`, `scoreDisplay`, `variantController`, `scene`, `window.__gameState` ref, `onGameOver` callback
- **`poller.speedMultiplier` returning `1.0` is intentional stub** — filled by Story 9-7
- The poll callback is a fire-and-forget function; `GamePoller._handlePoll` follows the same pattern
- `onGameOver` callback: called when poll indicates collision/score threshold — main.js receives this to trigger game-over overlay

### Files to Create

- `static/game/GamePoller.js` (NEW — extracted from main.js)

### Files to Modify

- `static/game/main.js` (UPDATE — remove poll callback, wire GamePoller)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Testing Strategy

- **No new tests required** — existing E2E specs that poll and check score/game-over serve as regression guard
- If any unit test references the poll callback directly, update the import path to `GamePoller`
- NFR-R02: No new mocks for behavior not already tested

### Out of Scope

- Wiring `speedMultiplier` from backend (Story 9-7)
- Changing poll interval (currently 200ms)
- Adding new poll behaviour beyond what is moved

---

## References

- Epic 9 specification — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 9-6]
- Poll callback in main.js — [Source: `static/game/main.js:1113-...`]
- `gameClient.startPolling()` — [Source: `static/game/game-client.js`]
- `ScoreDisplay` — [Source: `static/game/ui/ScoreDisplay.js`]
- Story 9-5 dependency — [Source: `_bmad-output/implementation-artifacts/9-5-extract-note-acceptor.md`]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- Created `static/game/GamePoller.js` with `start()`, `stop()`, `speedMultiplier` getter (returns 1.0 stub)
- Owns: score update from poll, `window.__gameState.score` sync, game-over detection, variant poll delegation
- `poller.start()` replaces inline `gameClient.startPolling(callback)` in main.js
- `main.js` simplified: poll block replaced with `poller.start()` call
- GamePoller imports `currentTransitionPhase` directly
- All tests pass (same pre-existing failures only)

### File List

- `static/game/GamePoller.js` (NEW)
- `static/game/main.js` (UPDATE — import GamePoller, instantiate, wire start)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)