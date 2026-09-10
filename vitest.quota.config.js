import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/firestore/ai-tutor-quota.emulator.test.js'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
