# Story 0.2: Playwright Test Harness

Status: review

## Story

As a developer,
I want a configured Playwright test harness with a structured `tests/e2e/` directory and a passing smoke test against the running Slopsmith container,
so that all subsequent E2E stories have a working foundation to build on.

## Acceptance Criteria

1. `@playwright/test` is added to `package.json` devDependencies and installed.
2. `playwright.config.ts` exists at project root configured with:
   - `baseURL: 'http://localhost:8000'`
   - Default project: `chromium` (primary browser)
   - `retries: 1` in CI (`process.env.CI ? 1 : 0`)
   - `reporter: [['list'], ['json', { outputFile: 'tests/e2e/results/report.json' }]]`
   - `use.screenshot: 'only-on-failure'`
   - `use.video: 'on-first-retry'`
3. The following directory structure exists (empty placeholder files acceptable for dirs without content yet):
   ```
   tests/e2e/
     fixtures/       ← Playwright fixtures and page objects
     helpers/        ← Plugin interaction utilities
     specs/          ← Test files
     screenshots/    ← Failure artifacts (gitignored)
     results/        ← JSON report output (gitignored)
   ```
4. A smoke test `tests/e2e/specs/smoke.spec.ts` passes against the running container:
   - Navigates to `http://localhost:8000`
   - Asserts `page.title()` is non-empty (or contains expected plugin name)
   - Asserts no uncaught JS errors on initial load (attach `page.on('pageerror')` listener)
5. `npm run test:e2e` script is added to `package.json` that runs `playwright test`.
6. `npm run test:e2e:headed` script runs `playwright test --headed` for visual debugging.
7. `tests/e2e/screenshots/` and `tests/e2e/results/` are added to `.gitignore`.

## Tasks / Subtasks

- [x] Task 1 — Install Playwright (AC: 1)
  - [x] Add `"@playwright/test": "^1.44.0"` (or latest stable) to `package.json` devDependencies
  - [x] Run `npm install`
  - [x] Run `npx playwright install chromium` — install Chromium browser binary only (Firefox/Safari deferred to CI nightly)

- [x] Task 2 — Create `playwright.config.ts` (AC: 2)
  - [x] Configure `baseURL`, `retries`, `reporter`, `screenshot`, `video` as specified in ACs
  - [x] Define single Chromium project for local/CI primary runs
  - [x] Set `testDir: './tests/e2e/specs'`
  - [x] Set `outputDir: './tests/e2e/screenshots'`

- [x] Task 3 — Create directory structure (AC: 3)
  - [x] Create `tests/e2e/fixtures/`, `helpers/`, `specs/`, `screenshots/`, `results/`
  - [x] Add `.gitkeep` to empty dirs so they are committed

- [x] Task 4 — Write smoke test (AC: 4)
  - [x] Create `tests/e2e/specs/smoke.spec.ts`
  - [x] Attach `pageerror` listener before `page.goto()`
  - [x] Assert title is non-empty
  - [x] Assert zero uncaught errors were collected

- [x] Task 5 — Add npm scripts and gitignore entries (AC: 5, 6, 7)
  - [x] Add `test:e2e` and `test:e2e:headed` to `package.json`
  - [x] Add `tests/e2e/screenshots/` and `tests/e2e/results/` to `.gitignore`

## Dev Notes

### Dependency Chain

This story unblocks:
```
0-2a (fake mic — adds Chromium launch args to playwright.config.ts)
0-2b (WAV injection — adds audio fixture helpers)
0-3 (baseline suite — adds specs in tests/e2e/specs/)
0-4 (CI — wires npm scripts into GitHub Actions)
```

Story 0-2a will add `launchOptions.args` to the Chromium project in `playwright.config.ts`. Write the config so that section is easy to extend (object spread or explicit `args: []` placeholder).

### Existing Tests Must Not Break

The existing test structure is:
```
tests/
  __init__.py
  conftest.py
  unit/
  integration/
  contract/
```
These are **pytest** tests. Do not touch them. The new `tests/e2e/` is Playwright (TypeScript), entirely separate. The existing `package.json` `test` script runs `vitest` — do not replace it. Add `test:e2e` as a separate script.

### TypeScript for Playwright

Use `.ts` files for all Playwright config and test files. The project uses ES modules (`"type": "module"` in package.json) — Playwright handles its own TypeScript compilation independently via `ts-jest` or its built-in transform; no separate `tsconfig.json` is required unless Playwright install creates one.

### Console Error Detection Pattern

```ts
// smoke.spec.ts
import { test, expect } from '@playwright/test';

test('plugin loads without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  expect(errors).toHaveLength(0);
  await expect(page).not.toHaveTitle('');
});
```

### Playwright Version

Use `@playwright/test` 1.44+ (supports all required APIs). Check `https://playwright.dev/docs/release-notes` for latest stable at implementation time.

### References

- [Source: epics.md#Playwright Test Framework Specification]
- [Source: epics.md#NFR-E2E-002, NFR-E2E-007]
- [Source: architecture.md#Stack]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `playwright.config.ts` uses `"type": "module"` project — Playwright handles its own TS compilation, no separate tsconfig needed.
- Chromium `launchOptions.args: []` left as explicit empty array so story 0-2a can push fake mic flags without restructuring the config.
- Smoke test verified discoverable via `npx playwright test --list` (1 test in 1 file).
- `tests/e2e/screenshots/` and `tests/e2e/results/` gitignored; `.gitkeep` files committed for the empty dirs.

### File List

- `package.json` — UPDATE (added @playwright/test dep + test:e2e scripts)
- `playwright.config.ts` — NEW
- `tests/e2e/fixtures/.gitkeep` — NEW
- `tests/e2e/helpers/.gitkeep` — NEW
- `tests/e2e/specs/smoke.spec.ts` — NEW
- `tests/e2e/screenshots/.gitkeep` — NEW
- `tests/e2e/results/.gitkeep` — NEW
- `.gitignore` — UPDATE (added screenshots/ and results/ entries)

### Change Log

- 2026-05-21: Implemented story 0-2 — Playwright harness, smoke test, directory structure, npm scripts, gitignore entries.
