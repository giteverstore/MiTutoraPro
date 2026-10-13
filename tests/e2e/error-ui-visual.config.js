import { defineConfig, devices } from '@playwright/test';

const port = 43127;
export default defineConfig({
  testDir: '.',
  testMatch: ['error-ui-visual.spec.js', 'error-heading-routes.spec.js'],
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/tests/e2e/error-ui-visual.html`,
    cwd: process.cwd(),
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_FIREBASE_API_KEY: 'demo-api-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-mitutora.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-mitutora', VITE_FIREBASE_STORAGE_BUCKET: 'demo-mitutora.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: '1:000000000000:web:e2e',
      VITE_PRACTICE_CONTENT_SOURCE: 'local',
    },
  },
});
