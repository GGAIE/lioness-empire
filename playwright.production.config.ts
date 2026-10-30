import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/production',
  outputDir: 'test-results/production',
  use: { baseURL: 'http://127.0.0.1:4181' },
  webServer: {
    command: 'npm run preview -- --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181',
  },
  projects: [{ name: 'production-desktop', use: { ...devices['Desktop Chrome'] } }],
});
