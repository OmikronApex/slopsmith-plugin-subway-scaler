# Story 0.5c: ATDD Scaffold — Epic 5 (Variant Track & Decision Window)

Status: done

## Story

As a developer,
I want Playwright E2E tests written in advance for Epic 5's variant track system,
so that acceptance criteria are executable and implementation can be validated against them from day one (ATDD — Acceptance Test-Driven Development).

**Note:** These tests are expected to FAIL until Epic 5 is implemented. They serve as living acceptance criteria for the implementer.

## Acceptance Criteria

1. A test file `tests/e2e/specs/epic5-variant.spec.ts` exists with all tests marked `test.fail()` (ATDD scaffold — expected to fail).
2. A test verifies that `_test.setVariant(id)` (once implemented) sets `window.__gameState.variant.id` to the given id within 1000ms.
3. A test verifies that after a variant is set, `window.__gameState.variant.timerRunning` becomes `true` within 1000ms (decision window timer starts).
4. A test verifies that `window.__gameState.variant.timerMs` counts down (second read < first read) when a variant is active.
5. A test verifies that when `timerMs` reaches 0, `window.__gameState.variant.timerExpired` becomes `true` (auto-reject on timeout).
6. A test verifies that a visible "variant track" element appears in the DOM when a variant is active (selector TBD in implementation — use `[data-variant-track]` or `.variant-track` as placeholder).
7. A test verifies that after variant expiry or rejection, `window.__gameState.variant.id` returns to `null` and `timerRunning` returns to `false`.
8. All tests use `test.fail()` wrapper so they: (a) fail red now, (b) automatically turn green when implementation satisfies the AC, (c) produce a CI error if they unexpectedly pass before Epic 5 ships (prevents silent skip).
9. When Epic 5 is implemented, the `test.fail()` wrappers are removed as part of that epic's story — this story only writes the scaffold.

## Tasks / Subtasks

- [x] Task 1 — Read Epic 5 PRD requirements (AC: 2–7)
  - [x] Confirmed variant fields in window.__gameState: id, timerMs, timerRunning, timerExpired
  - [x] _test.setVariant = null in current main.js (not implemented)

- [x] Task 2 — Create ATDD scaffold file (AC: 1, 8, 9)
  - [x] Created `tests/e2e/specs/epic5-variant.spec.ts`
  - [x] ATDD header comment explaining test.fail() intent

- [x] Task 3 — Write variant activation tests (AC: 2, 3, 6)
  - [x] setVariant sets variant.id, timerRunning, DOM element — all test.fail()

- [x] Task 4 — Write timer countdown tests (AC: 4, 5)
  - [x] timerMs decreases, timerExpired on zero — all test.fail()

- [x] Task 5 — Write variant reset test (AC: 7)
  - [x] variant.id → null after expiry — test.fail()

- [x] Task 6 — Confirm tests fail as expected (AC: 1, 8)
  - [x] `rtk playwright test tests/e2e/specs/epic5-variant.spec.ts` — 7/7 pass (all expected failures)

## Dev Notes

### ATDD Pattern with `test.fail()`

Playwright's `test.fail()` marks a test as "expected to fail." The test:
- Passes in CI when it **does** fail (expected outcome)
- Fails in CI when it **passes** (unexpected — signals implementation landed and wrappers need removal)

```ts
test.fail('variant timer starts', async ({ gamePage }) => {
  await startGame(gamePage);
  await gamePage.evaluate(() => (window as any).__gameState._test.setVariant('pentatonic-shift'));
  await gamePage.waitForFunction(
    () => (window as any).__gameState?.variant?.timerRunning === true,
    { timeout: 1000 }
  );
  const running = await gamePage.evaluate(() => (window as any).__gameState.variant.timerRunning);
  expect(running).toBe(true);
});
```

### `window.__gameState.variant` Interface (from Story 0-5)

```ts
variant: {
  id: string | null;       // current variant id, null when none active
  timerMs: number;         // countdown ms remaining
  timerRunning: boolean;   // true while decision window open
  timerExpired: boolean;   // true if timeout (auto-reject)
}
```

### DOM Selector Placeholder

Epic 5 implementation will decide the exact selector. Use `.variant-track` as placeholder — update to actual selector when Epic 5 is implemented (part of removing `test.fail()` wrappers).

### `_test.setVariant(id)` Hook

Defined in story 0-5 but implementation in GameLoop/VariantSwitcher is Epic 5 work:
```ts
await gamePage.evaluate(() => 
  (window as any).__gameState._test.setVariant('pentatonic-shift')
);
```

### Decision Window Timer

Per PRD FR-008: "Switch root note mid-session." The decision window gives the player time to accept or reject the variant. Timer duration comes from session config or difficulty setting (TBD in Epic 5).

### Removing Scaffolds When Epic 5 Ships

The Epic 5 implementation story should include a task: "Remove `test.fail()` wrappers from `epic5-variant.spec.ts` and confirm all tests pass green." This story (0.5c) only writes the scaffold.

### References

- PRD FR-008: Variant Switching feature requirement
- Story 0-5: `window.__gameState.variant` interface fields
- `tests/e2e/specs/epic3-game.spec.ts`: reference for gamePage fixture and _test hook usage
- Playwright docs: `test.fail()` — https://playwright.dev/docs/api/class-test#test-fail

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- _test.setVariant = null in main.js (Epic 5 not implemented). All variant.* fields are initialized to defaults (id: null, timerMs: 0, timerRunning: false, timerExpired: false). setVariant being null means calling it throws — which is a failing assertion for test.fail().

### Completion Notes List

- Created `tests/e2e/specs/epic5-variant.spec.ts` with 7 ATDD scaffold tests
- All 7 pass as expected failures (test.fail())
- Full suite: 75/75 pass

### File List

- `tests/e2e/specs/epic5-variant.spec.ts` — NEW

### Review Findings

- [x] [Review][Patch] Fix timer tests using 60s `waitForFunction` timeout — these will CI-timeout (`timedOut`) instead of assertion-fail; use 500ms assertion timeout pattern instead [tests/e2e/specs/epic5-variant.spec.ts]
- [x] [Review][Patch] Extract `startGame()` helper to shared fixture [tests/e2e/fixtures/] — duplicated across epic2, epic4, epic5 specs

### Change Log

- 2026-05-21: Implemented story 0.5c — Epic 5 ATDD scaffold. 7 variant tests all registered as expected failures. 75/75 full suite pass.
- 2026-05-21: Code review — 2 patch findings (timer timeout fix critical for CI).
