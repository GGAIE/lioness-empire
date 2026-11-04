import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/pages',
  outputDir: 'test-results/root-pages',
  workers: 3,
  use: { baseURL: 'http://127.0.0.1:4183', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/serve-pages.mjs --root-entry',
    url: 'http://127.0.0.1:4183',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'root-desktop', metadata: { rootEntry: true }, use: { ...devices['Desktop Chrome'] } },
    { name: 'root-android', metadata: { rootEntry: true }, use: { ...devices['Pixel 7'] } },
    { name: 'root-iphone', metadata: { rootEntry: true }, use: { ...devices['iPhone 13'] } },
  ],
});
