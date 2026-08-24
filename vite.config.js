import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    include: ['./tests/batch-{4,5,6,7,8}/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
  },
});
