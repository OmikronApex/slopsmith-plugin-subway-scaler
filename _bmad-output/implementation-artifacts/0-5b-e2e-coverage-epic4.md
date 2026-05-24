# Story 0.5b: E2E Coverage — Epic 4 (Overlays, Keyboard & Accessibility)

Status: done

## Story

As a developer,
I want Playwright E2E tests that verify the pause overlay, game-over overlay, keyboard shortcuts, and ARIA accessibility implemented in Epic 4,
so that regressions in session UX and accessibility are caught automatically.

## Acceptance Criteria

1. A test verifies that pressing `P` during gameplay triggers the pause overlay (`.overlay` becomes visible with "PAUSED" content).
2. A test verifies that pressing `Escape` while paused resumes gameplay (overlay hides, `session.phase` returns to `'playing'`).
3. A test verifies that `_test.forceCollision()` shows a game-over overlay containing text matching `/run failed|game.?over/i` (existing test in epic3-game.spec.ts passes — confirm not broken, do NOT duplicate).
4. A test verifies the game-over overlay contains the final score value (a number ≥ 0).
5. A test verifies the game-over overlay has a "Retry" or "Play Again" button that, when clicked, returns `session.phase` to `'idle'` or starts a new game.
6. A test verifies the pause overlay has `role="dialog"` and `aria-modal="true"` (or equivalent aria attributes per implementation).
7. A test verifies keyboard Tab navigation cycles through focusable elements inside the pause overlay without escaping it (focus trap).
8. All new tests live in `tests/e2e/specs/epic4-overlays.spec.ts` and use the `gamePage` fixture.
9. **Tier 1** tests (currently implemented behavior) pass green in CI. **Tier 2** tests use `test.fail()` and pass in CI as *expected failures* — they report `PASS` when they fail at assertion and will report `FAIL` (unexpected pass) only when Epic 4 ships and the `test.fail()` wrappers need removal. *(Original: "all tests pass in CI" — incompatible with the ATDD scaffold design; revised to reflect two-tier approach.)*

## Tasks / Subtasks

- [x] Task 1 — Audit current overlay implementation (AC: 1–7)
  - [x] Read main.js — no P-key handler; pause via button click only; no aria-modal; no focus trap
  - [x] Epic 4 stories (4-1 through 4-5) all have status ready-for-dev — NOT implemented yet
  - [x] Restructured 0.5b as Tier 1 (currently works) + Tier 2 (ATDD test.fail() scaffolds)

- [x] Task 2 — Write pause overlay tests (AC: 1, 2, 6, 7)
  - [x] Tier 1: Pause button click → phase = 'paused'; Resume → phase = 'playing'. (Abandon-button test retired 2026-05-25 — no in-game abandon UI shipped; `GameState.abandon()` remains as programmatic API only.)
  - [x] Tier 2 (test.fail): ARIA role/aria-modal; RESUME button in overlay; Escape key; focus trap

- [x] Task 3 — Write game-over overlay tests (AC: 3, 4, 5)
  - [x] Tier 1: forceCollision overlay visible with failure text (not duplicating epic3 — just confirms basic overlay)
  - [x] Tier 2 (test.fail): score in overlay; role/aria-modal; Retry button; Retry resets phase

- [x] Task 4 — Run tests and confirm pass (AC: 9)
  - [x] `rtk playwright test tests/e2e/specs/epic4-overlays.spec.ts` — 17/17 pass

## Dev Notes

### Overlay Selector Pattern

The existing `epic3-game.spec.ts` uses:
```ts
const overlay = gamePage.locator(`${ROOT} .overlay:not(.hidden)`);
await expect(overlay).toBeVisible({ timeout: 3000 });
await expect(overlay).toContainText(/run failed|game.?over/i);
```

Use the same approach for pause overlay. Pause-specific text: `"PAUSED"` or `/paused/i`.

### Keyboard Event Pattern

```ts
// Trigger P key pause
await gamePage.keyboard.press('p');

// Trigger Escape resume
await gamePage.keyboard.press('Escape');
```

For `_test.triggerPause()` alternative:
```ts
await gamePage.evaluate(() => (window as any).__gameState._test.triggerPause());
```

### ARIA Test Pattern

```ts
const pauseOverlay = gamePage.locator('.overlay:not(.hidden)');
await expect(pauseOverlay).toHaveAttribute('role', 'dialog');
await expect(pauseOverlay).toHaveAttribute('aria-modal', 'true');
```

### Focus Trap Test Pattern

```ts
// Tab through all focusable elements; assert focus stays inside overlay
const overlay = gamePage.locator('.overlay:not(.hidden)');
const focusable = overlay.locator('button, [href], input, [tabindex]:not([tabindex="-1"])');
const count = await focusable.count();
// Press Tab count+1 times; first focused element should match again
for (let i = 0; i <= count; i++) {
  await gamePage.keyboard.press('Tab');
}
const activeId = await gamePage.evaluate(() => document.activeElement?.id ?? document.activeElement?.className);
// Assert it's still inside the overlay
```

### Score in Game-Over Overlay

The game-over overlay should display `__gameState.score.current`. Locate the score element:
```ts
const scoreEl = gamePage.locator(`${ROOT} .overlay:not(.hidden) .score, ${ROOT} .overlay:not(.hidden) [data-score]`);
// or look for a number inside the overlay
const text = await gamePage.locator(`${ROOT} .overlay:not(.hidden)`).textContent();
expect(text).toMatch(/\d+/); // overlay contains at least one number (the score)
```

### References

- Story 4-1 through 4-5: Epic 4 overlay implementation stories
- Story 0-5: `window.__gameState` interface (session.phase, score.current, _test hooks)
- `tests/e2e/specs/epic3-game.spec.ts`: forceCollision test (do not duplicate AC-3)
- `tests/e2e/specs/canvas-overlay-alignment.spec.ts`: overlay bounding rect tests

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Epic 4 (all 5 stories) has status ready-for-dev — no P-key handler, no aria-modal, no focus trap, no RESUME button in overlay. Tier 1 tests cover what IS implemented; Tier 2 uses test.fail() ATDD pattern.
- test.fail() in Playwright only catches assertion failures (status:'failed'), NOT test timeouts (status:'timedOut'). ATDD tests must fail quickly at assertions with short timeouts (500ms), not via waitForFunction polls.
- Pause via _test.triggerPause() is reliable but the triggerPause hook does NOT update window.__gameState.session.phase directly (only the RAF loop does). Used waitForFunction with 3s timeout to catch the sync.

### Completion Notes List

- Created `tests/e2e/specs/epic4-overlays.spec.ts` with 17 tests (4 Tier 1, 13 Tier 2 ATDD)
- All 17 tests pass in Chromium: Tier 1 pass normally; Tier 2 fail-at-assertion → test.fail() reports as PASS
- Full suite: 75/75 pass

### File List

- `tests/e2e/specs/epic4-overlays.spec.ts` — NEW

### Review Findings

- [x] [Review][Patch] Revise AC9 ("all tests pass in CI") to reflect test.fail() Tier 2 design — current wording contradicts the ATDD scaffold approach [0-5b-e2e-coverage-epic4.md]
- [x] [Review][Patch] Extract `startGame()` helper to shared fixture [tests/e2e/fixtures/] — duplicated across epic2, epic4, epic5 specs
- [x] [Review][Defer] `waveCount` snapshot lags in backgrounded tab — deferred, inherent RAF throttling, pre-existing

### Change Log

- 2026-05-21: Implemented story 0.5b — Epic 4 E2E coverage. Tier 1 + Tier 2 ATDD scaffolds. 17/17 pass.
- 2026-05-21: Code review — 2 patch findings, 1 deferred.
