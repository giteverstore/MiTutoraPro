import process from 'node:process';
import { createServer, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';
import { viteAITutorPlugin } from '../server/ai/viteAITutorPlugin.js';

const SMOKE_TOKEN = 'local-ai-smoke-token';

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
    server.middlewares.use('/__ai-tutor-smoke', async (request, response, next) => {
      if (request.url !== '/') return next();
      const html = await server.transformIndexHtml('/__ai-tutor-smoke/', `
        <div id="root"></div>
        <script type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { AITutorPanel } from '/src/ai/AITutorPanel.jsx';
          import { AITutorClient } from '/src/ai/AITutorClient.js';
          import '/src/styles.css';
          const client = new AITutorClient({ tokenProvider: async () => '${SMOKE_TOKEN}' });
          createRoot(document.getElementById('root')).render(React.createElement(AITutorPanel, {
            language: 'python',
            code: 'numbers = [1, 2, 3]\\nprint(numbers)',
            selectedCode: '',
            compilerStatus: 'success',
            lessonContext: 'Python lists',
            client
          }));
        </script>
      `);
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(html);
    });
  },
};

const server = await createServer({
  configFile: false,
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
    }),
  ],
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
let browser;
const startedAt = performance.now();
try {
  await server.listen();
  const baseUrl = server.resolvedUrls?.local?.[0];
  if (!baseUrl) throw new Error('The local AI Tutor smoke server did not expose a URL.');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let apiResult = null;
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === '/api/ai/explain') apiResult = { failed: request.failure()?.errorText ?? 'request failed' };
  });
  await page.goto(new URL('/__ai-tutor-smoke/', baseUrl).href, { waitUntil: 'networkidle' });
  const apiResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/ai/explain');
  await page.getByRole('button', { name: 'Explain full code' }).click();
  const apiResponse = await apiResponsePromise;
  const apiBody = await apiResponse.json().catch(() => ({}));
  apiResult = { status: apiResponse.status(), diagnostic: apiBody?.error?.diagnostic };
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
  await server.close();
}
