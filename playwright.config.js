import { defineConfig, devices } from '@playwright/test';

const javaBin = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin';

const firebaseEnvironment = {
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-mitutora.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-mitutora',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-mitutora.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:e2e',
  VITE_FIREBASE_USE_EMULATORS: 'true',
  VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: '8080',
  VITE_PRACTICE_CONTENT_SOURCE: 'local',
  VITE_ENABLE_LOCAL_COURSE_FALLBACK: 'true',
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', grepInvert: /@runtime/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npx.cmd firebase-tools emulators:start --only auth,firestore --project demo-mitutora',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: true,
      timeout: 600_000,
      env: { ...process.env, PATH: `${javaBin};${process.env.PATH}` },
    },
    {
      command: 'node scripts/start-e2e-preview.mjs',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 600_000,
      env: firebaseEnvironment,
    },
  ],
});
