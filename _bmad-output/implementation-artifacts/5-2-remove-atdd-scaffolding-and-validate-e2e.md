# Story 5-2: Remove ATDD Scaffolding and Validate E2E

**Status:** backlog

**Epic:** 5 — Variant Track System
**Story ID:** 5-2
**Story Key:** 5-2-remove-atdd-scaffolding-and-validate-e2e
**Depends on:** 5-1

---

## Context

Story 0-5c wrote 7 Playwright acceptance tests in `tests/e2e/specs/epic5-variant.spec.ts`, all
wrapped in `test.fail()` (ATDD scaffold pattern). They were expected to fail until Epic 5 shipped.
Story 5-1 implements the observable state and test hook that these tests rely on.

This story removes the `test.fail()` wrappers so the tests run normally, verifies all 7 pass green,
and confirms no regressions in the full suite.

---

## User Story

As a developer,
I want the Epic 5 E2E acceptance tests to run without `test.fail()` wrappers and pass green,
so that CI validates the variant track system on every future commit.

---

## Acceptance Criteria

**AC-1 — No `test.fail()` in epic5-variant.spec.ts:**
All 7 tests in `tests/e2e/specs/epic5-variant.spec.ts` run as normal tests (no `test.fail()`
wrapper). The ATDD scaffold comment at the top of the file is updated or removed.

**AC-2 — All 7 variant tests pass:**
Running `npx playwright test tests/e2e/specs/epic5-variant.spec.ts` results in 7/7 passing tests
(green, not "expected failure").

**AC-3 — Full E2E suite still passes:**
Running the full Playwright suite shows no regressions. All previously-passing tests continue to pass.

**AC-4 — `[data-variant-track]` selector resolves:**
The test that asserts `[data-variant-track]` element is visible passes — confirming the attribute
added in 5-1 is reachable by Playwright.

---

## Tasks / Subtasks

- [ ] Task 1 — Remove `test.fail()` wrappers from epic5-variant.spec.ts
  - Open `tests/e2e/specs/epic5-variant.spec.ts`
  - For each test wrapped as `test.fail('...', async ({ ... }) => { ... })`:
    - Change to `test('...', async ({ ... }) => { ... })`
  - Update the ATDD header comment to remove "expected to fail" language

- [ ] Task 2 — Run the Epic 5 spec and verify 7/7 green
  - `npx playwright test tests/e2e/specs/epic5-variant.spec.ts`
  - Fix any assertion failures if needed (adjust timeouts, selectors, etc.)
  - Document any fixes in Dev Notes

- [ ] Task 3 — Run the full E2E suite and verify no regressions
  - `npx playwright test`
  - All tests that passed before this story must still pass

---

## Dev Notes

### ATDD Scaffold Pattern Reminder

The `test.fail()` wrapper means:
- When the inner test **fails** → Playwright marks the whole test as **passed** (expected failure)
- When the inner test **passes** → Playwright marks the whole test as **failed** (unexpected pass)

After removal, each test asserts normally. A failing assertion is a real failure.

### Timer Precision

The timer countdown test reads `timerMs` twice with a small delay between reads. Ensure the
interval in `_test.setVariant` (50ms tick in 5-1) fires at least once between the two reads.
If the test uses a very short delay (< 100ms), consider adjusting the `waitForFunction` timeout
or the assertion approach.

### Selector for `[data-variant-track]`

The ATDD scaffold used `.variant-track` as a placeholder. Story 5-1 adds `data-variant-track`
attribute to `div.variant-indicator`. Update the selector in the test if needed:
```ts
// Before (scaffold placeholder)
const el = page.locator('.variant-track');
// After (actual implementation)
const el = page.locator('[data-variant-track]');
```

### Reference

- Story 0-5c: `_bmad-output/implementation-artifacts/0-5c-atdd-scaffold-epic5.md` — original scaffold
- `tests/e2e/specs/epic5-variant.spec.ts` — the spec to modify
- Story 5-1: `_bmad-output/implementation-artifacts/5-1-wire-variant-observable-state-and-test-hook.md` — prerequisite

---

## Dev Agent Record

_(filled in by dev agent after implementation)_

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

### Change Log
