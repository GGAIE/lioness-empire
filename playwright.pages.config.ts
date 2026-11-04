import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/pages',
  outputDir: 'test-results/pages',
  workers: 3,
  use: { baseURL: 'http://127.0.0.1:4182', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/serve-pages.mjs',
    url: 'http://127.0.0.1:4182',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'pages-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pages-android', use: { ...devices['Pixel 7'] } },
    { name: 'pages-iphone', use: { ...devices['iPhone 13'] } },
  ],
});
