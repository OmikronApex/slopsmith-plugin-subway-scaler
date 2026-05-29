import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/specs',
  testIgnore: ['**/_template*'],
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
  webServer: {
    command: 'docker compose -f tests/e2e/docker-compose.dev.yml up',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 60000,
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
            '--autoplay-policy=no-user-gesture-required',
            // Enable real GPU rendering instead of SwiftShader software WebGL.
            // Without these, Three.js runs entirely on CPU and saturates it.
            '--enable-gpu',
            '--use-angle=d3d11',          // Windows: ANGLE over Direct3D 11
            '--ignore-gpu-blocklist',
            '--enable-gpu-rasterization',
          ],
        },
      },
    },
    // Nightly targets — run via `npm run test:e2e:nightly`
    // Audio tests skip themselves on non-Chromium via test.skip()
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
