# Story 0.4: Test Integration & Templates

Status: ready-for-dev

## Story

As a developer,
I want E2E tests wired into npm scripts and a GitHub Actions CI workflow, plus a reusable test template for future epics,
so that the test suite runs automatically on every push and future stories have a consistent pattern to follow.

## Acceptance Criteria

1. A GitHub Actions workflow file `.github/workflows/e2e.yml` exists that:
   - Triggers on `push` and `pull_request` to `main`
   - Starts the Slopsmith Docker container via `docker compose -f docker-compose.dev.yml up -d`
   - Waits for the container health check to pass (max 30s)
   - Runs `npm run test:e2e` with `CI=true` set
   - Uploads `tests/e2e/results/report.json` and `tests/e2e/screenshots/` as artifacts on failure
   - Tears down the container with `docker compose -f docker-compose.dev.yml down` in a `always()` step
2. The full E2E suite (all specs in `tests/e2e/specs/`) completes in under 5 minutes on `ubuntu-latest` (Chromium only — no cross-browser in CI primary run).
3. A `tests/e2e/specs/_template.spec.ts` file exists with a documented pattern for future epic stories to follow (see Dev Notes for required template content).
4. `npm run test:e2e:ci` script runs Playwright with `--reporter=json` and `CI=true` (for use in the GitHub Actions step).
5. Firefox and Safari/WebKit are defined as additional Playwright projects in `playwright.config.ts` but are marked with a tag or separate project name (e.g., `chromium-nightly`, `firefox-nightly`) that allows them to be run separately: `npm run test:e2e:nightly` runs all browser targets.
6. The JSON report at `tests/e2e/results/report.json` is machine-readable and includes pass/fail per test, duration, and error messages on failure — confirming NFR-E2E-006.
7. The `README.md` Development section (added in story 0-1) is updated with E2E testing instructions: how to run `npm run test:e2e`, what the CI workflow does, and how to add tests for a new epic.

## Tasks / Subtasks

- [ ] Task 1 — Create GitHub Actions workflow (AC: 1)
  - [ ] Create `.github/workflows/e2e.yml`
  - [ ] Use `ubuntu-latest` runner
  - [ ] Install Node.js (match version used locally — check `.nvmrc` or use `node: 20`)
  - [ ] Run `npm ci` to install dependencies
  - [ ] Run `npx playwright install chromium` to install browser binary in CI
  - [ ] Start Docker container: `docker compose -f docker-compose.dev.yml up -d`
  - [ ] Wait for health: `docker compose -f docker-compose.dev.yml ps` or a `curl` retry loop (max 30s)
  - [ ] Run `npm run test:e2e:ci`
  - [ ] Upload artifacts: `uses: actions/upload-artifact@v4` with `if: failure()` for screenshots and always for report
  - [ ] Always teardown: `docker compose -f docker-compose.dev.yml down`

- [ ] Task 2 — Add `test:e2e:ci` and `test:e2e:nightly` npm scripts (AC: 4, 5)
  - [ ] `"test:e2e:ci": "cross-env CI=true playwright test"`
  - [ ] `"test:e2e:nightly": "playwright test --project=chromium --project=firefox --project=webkit"`
  - [ ] Install `cross-env` as a devDependency for cross-platform CI env var support

- [ ] Task 3 — Add Firefox and WebKit projects to `playwright.config.ts` (AC: 5)
  - [ ] Add `firefox` and `webkit` projects with the same `baseURL`
  - [ ] These projects do NOT include `--use-fake-device-for-media-stream` (audio tests are Chromium-only)
  - [ ] In the default `projects` array used by `npm run test:e2e`, include only `chromium`
  - [ ] Nightly workflow (separate file or matrix) runs all three

- [ ] Task 4 — Create test template (AC: 3)
  - [ ] Create `tests/e2e/specs/_template.spec.ts`
  - [ ] See Dev Notes for required template structure

- [ ] Task 5 — Verify 5-minute budget (AC: 2)
  - [ ] Run the full Chromium suite locally and record total duration
  - [ ] If over 5 minutes: identify the slowest tests (Playwright HTML report shows per-test time)
  - [ ] Optimize: reduce `waitForFunction` timeouts that are too generous, add `test.describe.parallel` where safe

- [ ] Task 6 — Update README (AC: 7)
  - [ ] Add E2E commands and CI explanation to the `## Development` section in `README.md`

## Dev Notes

### Required `_template.spec.ts` Content

```ts
/**
 * Epic N Story N-M: [Story Title]
 *
 * Tests the [feature description] user journey.
 * Depends on: window.__gameState (story 0-5), gamePage fixture (story 0-5)
 *
 * Baseline tests (DOM, ARIA, keyboard nav) are NOT repeated here.
 * This file tests only the story's specific acceptance criteria.
 */
import { test, expect, Browser } from '@playwright/test';
import { injectAudioFile } from '../helpers/audioHelper';

// Replace with story-specific selectors
const SELECTORS = {
  // exampleButton: '#start-button',
};

// Use gamePage fixture for tests that need window.__gameState
// Use raw { page } for tests that don't need audio or game state
test.describe('Epic N: [Feature Name]', () => {

  // Example: test that does NOT need audio
  test('feature renders correctly', async ({ page }) => {
    await page.goto('/');
    // assertions here
  });

  // Example: test that needs window.__gameState
  test('game state reflects action', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__TEST_MODE = true; });
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__gameState != null);
    // assertions here
  });

  // Example: test that needs audio injection (Chromium only)
  test('note detection works', async ({ browserName, browser }: { browserName: string, browser: Browser }) => {
    test.skip(browserName !== 'chromium', 'audio injection requires Chromium');
    const ctx = await injectAudioFile(browser, 'tests/e2e/fixtures/audio/A4_440hz.wav');
    const page = await ctx.newPage();
    await page.addInitScript(() => { (window as any).__TEST_MODE = true; });
    await page.goto('/');
    // assertions here
    await ctx.close();
  });
});
```

### Container Health Wait in CI

Docker Compose's `--wait` flag (Compose v2.1+) blocks until all health checks pass:
```yaml
- run: docker compose -f docker-compose.dev.yml up -d --wait
  timeout-minutes: 2
```

If Compose version in CI is older, use a manual retry:
```yaml
- name: Wait for container
  run: |
    for i in {1..10}; do
      curl -sf http://localhost:8000 && break || sleep 3
    done
```

### `cross-env` Note

`cross-env` is needed for Windows local dev (the `CI=true` prefix syntax doesn't work in PowerShell). Since the dev environment is Windows (project runs on Win32), add it as a devDependency.

### Playwright Config — Final Structure

After all stories (0-2, 0-2a, 0-5), `playwright.config.ts` will look like:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/specs',
  outputDir: './tests/e2e/screenshots',
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/e2e/results/report.json' }],
  ],
  use: {
    baseURL: 'http://localhost:8000',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
    // Nightly only:
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

The `--use-file-for-fake-audio-capture` flag is NOT in the default Chromium config — it is set per-test in `audioHelper.ts` via individual `browser.launch()` calls (as documented in story 0-2b).

### NFR-E2E-004: Under 5 Minutes

Budget per test category on `ubuntu-latest` (estimates):
- Smoke: ~5s
- Mic access: ~10s
- Game state observable: ~15s
- Audio injection (2 tests × separate browser launch): ~30s
- Baseline suite: ~30s
Total est.: ~90s. Well within 5 minutes. If audio injection tests take longer, they can be moved to the nightly run.

### References

- [Source: epics.md#NFR-E2E-004, NFR-E2E-006, NFR-E2E-007]
- [Source: epics.md#Test Integration into npm scripts and CI/CD]
- [Roundtable: Murat's browser tier strategy — Chromium primary, others nightly]
- [Roundtable: Amelia's < 5 min AC must specify ubuntu-latest hardware baseline]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `.github/workflows/e2e.yml` — NEW
- `package.json` — UPDATE (add test:e2e:ci, test:e2e:nightly, cross-env dep)
- `playwright.config.ts` — UPDATE (add firefox + webkit projects)
- `tests/e2e/specs/_template.spec.ts` — NEW
- `README.md` — UPDATE (add E2E testing section)
