import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/compiler/compiler-public.acceptance.test.js'], testTimeout: 30000, hookTimeout: 30000, maxWorkers: 1 } });
