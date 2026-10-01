import process from 'node:process';
import { createServer as createNetServer } from 'node:net';
import { createServer, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';
import { viteAITutorPlugin } from '../server/ai/viteAITutorPlugin.js';

const SMOKE_TOKEN = 'local-ai-smoke-token';

const reservePort = () => new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close((error) => error ? reject(error) : resolve(port));
  });
});

const environment = loadEnv('development', process.cwd(), '');
if (environment.AI_PROVIDER !== 'huggingface') {
  throw new Error('Set AI_PROVIDER=huggingface in the local .env before running the AI Tutor smoke test.');
}
if (!environment.HF_TOKEN) {
  throw new Error('HF_TOKEN is not configured in the local server environment.');
}
if (!environment.AI_MODEL) {
  throw new Error('AI_MODEL is not configured in the local server environment.');
}

const smokePlugin = {
  name: 'mi-tutora-ai-smoke-page',
  configureServer(server) {
    server.middlewares.use('/__ai-tutor-smoke', (_request, response) => {
      const html = `
        <div id="root"></div>
        <script type="module">
          import RefreshRuntime from '/@react-refresh';
          RefreshRuntime.injectIntoGlobalHook(window);
          window.$RefreshReg$ = () => {};
          window.$RefreshSig$ = () => (type) => type;
          window.__vite_plugin_react_preamble_installed__ = true;
        </script>
        <script type="module" src="/scripts/fixtures/ai-tutor-smoke.jsx"></script>
      `;
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(html);
    });
  },
};

const smokePort = await reservePort();
const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  plugins: [
    react(),
    smokePlugin,
    viteAITutorPlugin(environment, {
      authenticator: {
        authenticate: async (request) => {
          if (request.headers.authorization !== `Bearer ${SMOKE_TOKEN}`) throw new Error('Invalid local smoke identity.');
          return { uid: 'local-ai-smoke-user' };
        },
      },
      premiumAccessGuard: { assertPremium: async () => undefined },
      featureGate: {
        assertEnabled: async () => ({ enabled: true, state: 'smoke', bucket: null, version: 'local-smoke' }),
      },
      quotaGuard: {
        assertAllowed: async ({ requestId = 'local-ai-smoke', usageEstimate, usageMaximum }) => ({
          requestId,
          estimate: usageEstimate,
          maximum: usageMaximum,
        }),
        settle: async () => true,
      },
    }),
  ],
  server: { host: '127.0.0.1', port: smokePort, strictPort: true },
});
let browser;
const startedAt = performance.now();
try {
  await server.listen();
  console.log('AI Tutor smoke: Vite server listening.');
  const baseUrl = server.resolvedUrls?.local?.[0];
  if (!baseUrl) throw new Error('The local AI Tutor smoke server did not expose a URL.');
  const smokeUrl = new URL('/__ai-tutor-smoke/', baseUrl).href;
  const readiness = await fetch(smokeUrl, { signal: AbortSignal.timeout(5_000) });
  console.log('AI Tutor smoke: page endpoint ready.');
  if (!readiness.ok) throw new Error(`The local AI Tutor smoke page was not ready (${readiness.status}).`);
  browser = await chromium.launch({ headless: true });
  console.log('AI Tutor smoke: Chromium launched.');
  const page = await browser.newPage();
  page.on('console', (message) => { if (message.type() === 'error') console.error(`AI Tutor smoke console: ${message.text()}`); });
  page.on('pageerror', (error) => console.error(`AI Tutor smoke page error: ${error.message}`));
  page.on('requestfailed', (request) => console.error(`AI Tutor smoke request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`));
  let apiResult = null;
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === '/api/ai/explain') apiResult = { failed: request.failure()?.errorText ?? 'request failed' };
  });
  await page.goto(smokeUrl, { waitUntil: 'commit' });
  console.log('AI Tutor smoke: panel page loaded.');
  try {
    await page.getByRole('button', { name: 'Explain full code' }).waitFor({ state: 'visible', timeout: 30_000 });
  } catch (error) {
    console.error(`AI Tutor smoke markup after load failure: ${(await page.locator('body').innerText().catch(() => '')).slice(0, 1_000)}`);
    throw error;
  }
  const apiResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/ai/explain',
    { timeout: 120_000 },
  );
  await page.getByRole('button', { name: 'Explain full code' }).click();
  const apiResponse = await apiResponsePromise;
  const apiBody = await apiResponse.json().catch(() => ({}));
  apiResult = {
    status: apiResponse.status(),
    code: apiBody?.error?.code,
    diagnostic: apiBody?.error?.diagnostic,
  };
  const outcome = page.locator('.ai-tutor-structured-response, .ai-tutor-error');
  await outcome.waitFor({ state: 'visible', timeout: 60_000 });
  if (await page.locator('.ai-tutor-error').count()) {
    throw new Error(`The local endpoint returned a sanitized failure (${JSON.stringify(apiResult)}): ${await page.locator('.ai-tutor-error').innerText()}`);
  }
  const renderedText = (await page.locator('.ai-tutor-structured-response').innerText()).trim();
  if (!renderedText) throw new Error('The AI Tutor panel rendered an empty model response.');
  console.log(JSON.stringify({
    provider: 'huggingface',
    model: environment.AI_MODEL,
    endpoint: '/api/ai/explain',
    structuredResponseValidated: true,
    panelRendered: true,
    responseCharacters: renderedText.length,
    latencyMs: Math.round(performance.now() - startedAt),
  }, null, 2));
} finally {
  await browser?.close();
  server.httpServer?.closeAllConnections?.();
  await Promise.race([
    server.close(),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, 5_000);
      timer.unref?.();
    }),
  ]);
}

// Provider transports can retain an idle keep-alive socket after a successful
// one-shot smoke. All owned browser/server resources are closed above.
process.exit(0);
