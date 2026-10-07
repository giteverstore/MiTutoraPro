import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: resolve(import.meta.dirname, '../../node_modules/react') },
      { find: /^react-dom$/, replacement: resolve(import.meta.dirname, '../../node_modules/react-dom') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['./tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
  },
});
