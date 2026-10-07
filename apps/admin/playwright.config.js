import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalTeardown: './tests/browser/teardown.mjs',
  testDir: './tests/browser',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4176', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node tests/browser/server.mjs',
    cwd: import.meta.dirname,
    url: 'http://127.0.0.1:4176/tests/browser/index.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
