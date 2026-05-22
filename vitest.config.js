import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/js/**/*.test.js', 'tests/integration/**/*.test.js'],
    // Exclude red-phase ATDD scaffolds for stories not yet implemented.
    // Remove each entry here when its story is picked up for development.
    exclude: [
      // timer-bar.js not yet implemented
      'tests/unit/js/timer-bar.test.js',
    ],
  },
});
