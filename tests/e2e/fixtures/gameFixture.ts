import { test as base, type Page } from '@playwright/test';

// Sets window.__TEST_MODE = true before page navigation so _test hooks are wired.
export const test = base.extend<{ gamePage: Page }>({
  gamePage: async ({ page }, use) => {
    await page.addInitScript(() => { (window as any).__TEST_MODE = true; });
    await use(page);
  },
});

export { expect, type Page } from '@playwright/test';
