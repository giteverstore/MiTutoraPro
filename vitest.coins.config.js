import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      './tests/firestore/coin-ledger.emulator.test.js',
      './tests/firestore/activity-verification.emulator.test.js',
      './tests/firestore/mvp-activity-completion.emulator.test.js',
      './tests/firestore/referral.emulator.test.js',
      './tests/firestore/wallet.emulator.test.js',
      './tests/firestore/withdrawal.emulator.test.js',
      './tests/firestore/m8-financial.emulator.test.js',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
