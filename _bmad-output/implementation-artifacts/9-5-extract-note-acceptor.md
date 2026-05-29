# Story 9.5: Extract `NoteAcceptor.js`

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-5
**Story Key:** 9-5-extract-note-acceptor
**Depends on:** 9-4 (VariantController exists so NoteAcceptor delegates variant proposal)

---

## Context

The `detectionHandler` async function currently defined inside `startGame()` in `main.js` (~lines 1030-1200) handles audio detection callbacks: safe-zone adjacency check, `run.onDetection()` call, `gameClient.playNote()` call, feedback element update, and variant proposal delegation. This multi-responsibility function is deeply embedded in `main.js` and cannot be unit-tested in isolation.

Extracting `NoteAcceptor.js` makes the path from sound input to score update readable and independently testable.

---

## User Story

As a **developer**,
I want audio detection callback logic and note acceptance handling in their own module,
so that the path from sound input to score update is readable and independently testable.

---

## Acceptance Criteria

**AC-1 — NoteAcceptor owns detection processing:**
Given the `detectionHandler` async function currently defined inside `startGame()` in `main.js`,
When `NoteAcceptor.js` is extracted,
Then `main.js` instantiates `NoteAcceptor` and wires `audio.onDetection(acceptor.handle)`,
And no inline detection callback remains in `main.js`,
And `NoteAcceptor` owns: safe-zone adjacency check, `run.onDetection()` call, `gameClient.playNote()` call, feedback element update, and delegation to `VariantController` for post-note variant proposal.

**AC-2 — Module registration:**
Given the new `static/game/NoteAcceptor.js` file,
When the game HTML is loaded,
Then the module is registered via `<script type="module">` or import map — no 404.

**AC-3 — No test regression (no new mocks for untested behavior):**
Given all existing Vitest unit tests and Playwright E2E specs,
When run after the extraction,
Then all pass without modification,
And without new mocks for behavior not already tested.

---

## Tasks / Subtasks

- [x] Task 1: Create `static/game/NoteAcceptor.js` (AC: 1)
  - [x] 1.1 Move `detectionHandler` function from `main.js` into `NoteAcceptor.handle(det)` method
  - [x] 1.2 Constructor arguments: `run`, `safeZoneRenderer`, `gameClient`, `scene`, `variantController`, `feedbackEl`, `pushGameEvent`
  - [x] 1.3 Move `setExpected()` helper into `NoteAcceptor` or wire as a callback — document choice in code comment
  - [x] 1.4 Own safe-zone adjacency check logic
  - [x] 1.5 Own `run.onDetection()` call
  - [x] 1.6 Own `gameClient.playNote()` call
  - [x] 1.7 Own feedback element update
  - [x] 1.8 Own delegation to `variantController.onNoteAccepted()` for post-note variant proposal

- [x] Task 2: Simplify `main.js` (AC: 1)
  - [x] 2.1 Remove `detectionHandler` function
  - [x] 2.2 Remove `setExpected()` inline declaration
  - [x] 2.3 Instantiate `NoteAcceptor` in `startGame()`
  - [x] 2.4 Wire `audio.onDetection(acceptor.handle.bind(acceptor))`

- [x] Task 3: Register module (AC: 2)
  - [x] 3.1 Add `<script type="module" src="./NoteAcceptor.js">` or import-map entry
  - [x] 3.2 Verify no 404 in browser/Playwright tests

- [x] Task 4: Run existing test suites (AC: 3)
  - [x] 4.1 All existing Vitest unit tests pass
  - [x] 4.2 All Playwright E2E specs pass

---

## Dev Notes

### Architecture Constraints

- **Depends on:** Story 9-4 (`VariantController` must exist — NoteAcceptor delegates variant proposal to it)
- **Public API:** `acceptor.handle(det)` — same signature as the current `detectionHandler`
- **`setExpected()` decision:** If `setExpected()` is used only within the detection path, move it into `NoteAcceptor`. If used elsewhere in `main.js`, pass it as a callback. Document the choice.
- The extracted method must preserve all existing behaviour (score update, variant proposal trigger, feedback flash). The extraction is mechanical — no behavioural changes.

### Files to Create

- `static/game/NoteAcceptor.js` (NEW — extracted from main.js)

### Files to Modify

- `static/game/main.js` (UPDATE — remove detectionHandler, wire NoteAcceptor)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Testing Strategy

- **No new tests required** — existing E2E specs that play notes and verify score/game-over serve as regression guard
- If any existing unit test directly calls `detectionHandler`, update the import path to `NoteAcceptor.handle()`
- NFR-R02: No new mocks for behavior not already tested

### Out of Scope

- Extracting GamePoller (Story 9-6)
- Changing note detection timing or logic
- Changing score calculation or feedback animation

---

## References

- Epic 9 specification — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 9-5]
- `detectionHandler` in main.js — [Source: `static/game/main.js` — ~lines 1030-1200]
- `audio.onDetection()` wiring — [Source: `static/game/main.js` — detection callback registration]
- `Run.onDetection()` — [Source: `static/game/GameState.js`]
- Story 9-4 dependency — [Source: `_bmad-output/implementation-artifacts/9-4-extract-variant-controller.md`]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- Created `static/game/NoteAcceptor.js` with `handle(det)` method owning: safe-zone check, run.onDetection(), gameClient.playNote(), feedback update, variant proposal trigger
- `setExpected` wired as callback `setExpectedFn` (not moved into module — too coupled with main.js closure vars)
- Variant accept gate stays in main.js (needs `runAcceptTransition` closure); NoteAcceptor.delegates to variantController.handleAccept
- All tests pass — no regressions

### File List

- `static/game/NoteAcceptor.js` (NEW)
- `static/game/main.js` (UPDATE — import NoteAcceptor, instantiate, wire detection handler)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)