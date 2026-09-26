import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/mysql/**/*.integration.test.js'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
