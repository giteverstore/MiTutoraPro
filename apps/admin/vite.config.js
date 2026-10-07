import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ADMIN_LOCAL_SECURITY_HEADERS } from '../../config/adminSecurityHeaderPolicy.mjs';

const pyodideFiles = new Map([
  ['pyodide.mjs', 'text/javascript'],
  ['pyodide.asm.mjs', 'text/javascript'],
  ['pyodide.asm.wasm', 'application/wasm'],
  ['python_stdlib.zip', 'application/zip'],
  ['pyodide-lock.json', 'application/json'],
]);

function adminPyodideAssets() {
  const source = dirname(createRequire(import.meta.url).resolve('pyodide/pyodide.mjs'));
  return {
    name: 'admin-preview-pyodide-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const file = new URL(request.url, 'http://localhost').pathname.replace(/^\/admin-pyodide\//, '');
        if (!request.url.startsWith('/admin-pyodide/') || !pyodideFiles.has(file)) return next();
        response.setHeader('Content-Type', pyodideFiles.get(file));
        response.setHeader('Cache-Control', 'no-store');
        response.end(readFileSync(resolve(source, file)));
      });
    },
    generateBundle() {
      for (const file of pyodideFiles.keys()) this.emitFile({ type: 'asset', fileName: `admin-pyodide/${file}`, source: readFileSync(resolve(source, file)) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  const environment = { ...loadEnv(mode, import.meta.dirname, ''), ...process.env };
  return {
    root: import.meta.dirname,
    envDir: import.meta.dirname,
    plugins: [react(), adminPyodideAssets()],
    resolve: { dedupe: ['react', 'react-dom', 'firebase'] },
    server: {
      port: Number(environment.ADMIN_DEV_PORT || 4174),
      headers: ADMIN_LOCAL_SECURITY_HEADERS,
      fs: { allow: [repositoryRoot] },
    },
    preview: { port: Number(environment.ADMIN_PREVIEW_PORT || 4175), headers: ADMIN_LOCAL_SECURITY_HEADERS },
    worker: { format: 'es' },
    build: { outDir: 'dist', emptyOutDir: true, manifest: true },
  };
});
