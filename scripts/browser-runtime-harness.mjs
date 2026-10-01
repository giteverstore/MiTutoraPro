import { createServer as createNetServer } from 'node:net';
import { createServer as createViteServer } from 'vite';

async function allocatePort() {
  const reservation = createNetServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return port;
}

export async function startBrowserRuntimeServer({ readinessTimeoutMs = 30_000 } = {}) {
  const port = await allocatePort();
  const probePath = '/__browser_runtime_probe__';
  const server = await createViteServer({
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
    plugins: [{
      name: 'ycoders-browser-runtime-probe',
      configureServer(viteServer) {
        viteServer.middlewares.use((request, response, next) => {
          if (request.url !== probePath) return next();
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end('<!doctype html><html><body data-runtime-probe="ready"></body></html>');
        });
      },
    }],
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  try {
    await server.listen();
    const baseUrl = `http://127.0.0.1:${port}/`;
    const deadline = Date.now() + readinessTimeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(new URL(probePath, baseUrl));
        const body = response.ok ? await response.text() : '';
        if (response.ok && body.includes('data-runtime-probe="ready"')) return { server, baseUrl, probeUrl: new URL(probePath, baseUrl).href };
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) { lastError = error; }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Vite runtime harness did not become ready at ${baseUrl}: ${lastError?.message ?? 'unknown error'}`);
  } catch (error) {
    await server.close();
    throw error;
  }
}
