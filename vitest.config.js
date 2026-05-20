import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/js/**/*.test.js', 'tests/integration/**/*.test.js'],
  },
});
