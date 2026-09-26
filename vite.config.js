import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteAITutorPlugin } from './server/ai/viteAITutorPlugin.js';
import { viteActivityCompletionPlugin } from './server/coins/viteActivityCompletionPlugin.js';
import { viteMySqlPlugin } from './server/mysql/viteMySqlPlugin.js';

export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return ({
  plugins: [react(), viteAITutorPlugin(environment), viteActivityCompletionPlugin(environment), viteMySqlPlugin(environment)],
  build: {
    manifest: true,
  },
  worker: {
    format: 'es',
  },
  assetsInclude: [/\.dat$/, /\.wasm$/, /\.so$/, /\.la$/],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm', '@php-wasm/web-8-4'],
  },
  define: {
    'import.meta.env.VITE_YCODERS_DEPLOYMENT_TARGET': JSON.stringify(environment.YCODERS_DEPLOYMENT_TARGET || ''),
  },
  test: {
    environment: 'jsdom',
    include: ['./tests/batch-{4,5,6,7,8}/**/*.test.{js,jsx}', './tests/compiler/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
  },
  });
});
