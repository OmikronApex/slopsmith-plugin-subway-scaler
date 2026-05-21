import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/js/**/*.test.js', 'tests/integration/**/*.test.js'],
    // Exclude red-phase ATDD scaffolds for stories not yet implemented.
    // Remove each entry here when its story is picked up for development.
    exclude: [
      // Epic 4 — overlay.js and timer-bar.js don't exist yet (stories 4-1 to 4-5)
      'tests/unit/js/overlay.test.js',
      'tests/unit/js/timer-bar.test.js',
      'tests/unit/js/aria.test.js',
    ],
  },
});
