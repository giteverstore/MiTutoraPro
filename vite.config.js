import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteAITutorPlugin } from './server/ai/viteAITutorPlugin.js';
import { viteActivityCompletionPlugin } from './server/coins/viteActivityCompletionPlugin.js';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  return ({
  plugins: [react(), viteAITutorPlugin(environment), viteActivityCompletionPlugin(environment)],
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
});
