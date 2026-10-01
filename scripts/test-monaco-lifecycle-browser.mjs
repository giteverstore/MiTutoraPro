import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import react from '@vitejs/plugin-react';
import { build, preview } from 'vite';

const outDir = resolve('.tmp-monaco-lifecycle');
await build({
  configFile: false,
  plugins: [react()],
  worker: { format: 'es' },
  build: { emptyOutDir: true, outDir, rollupOptions: { input: resolve('tests/fixtures/monaco-lifecycle.html') } },
});
const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 }, build: { outDir } });
const baseUrl = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true, args: ['--js-flags=--expose-gc'] });
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');

async function metrics() {
  const { metrics: values } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(values.map(({ name, value }) => [name, value]));
}

try {
  await page.goto(new URL('tests/fixtures/monaco-lifecycle.html', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByLabel('Lifecycle editor').waitFor({ timeout: 90_000 });
  const baseline = await page.evaluate(() => monacoLifecycle.modelCount());
  const heapBefore = await page.evaluate(() => monacoLifecycle.heap());
  const workersBefore = page.workers().length;
  const metricsBefore = await metrics();
  const domBefore = await cdp.send('Memory.getDOMCounters');

  const fiftyPaths = Array.from({ length: 50 }, (_, index) => `src/file-${index}.py`);
  for (let index = 0; index < fiftyPaths.length; index += 1) {
    const paths = fiftyPaths.slice(0, index + 1).map((path) => `ycoders-project://project-a/${path}`);
    await page.evaluate(({ path, retained }) => monacoLifecycle.update({ path, retained }), { path: fiftyPaths[index], retained: paths });
  }
  const afterFileOpen = await page.evaluate(() => monacoLifecycle.modelCount());
  assert.equal(afterFileOpen, 50, 'Open project tabs intentionally own one model each.');

  await page.evaluate(() => monacoLifecycle.update({ path: 'src/file-49.py', retained: ['ycoders-project://project-a/src/file-49.py'] }));
  const afterClose = await page.evaluate(() => monacoLifecycle.models());
  assert.deepEqual(afterClose, ['ycoders-project://project-a/src/file-49.py']);

  await page.evaluate(() => monacoLifecycle.update({ path: 'src/renamed.py', retained: ['ycoders-project://project-a/src/renamed.py'] }));
  const afterRename = await page.evaluate(() => monacoLifecycle.models());
  assert.deepEqual(afterRename, ['ycoders-project://project-a/src/renamed.py']);

  for (let index = 0; index < 20; index += 1) {
    const project = `project-${index}`;
    await page.evaluate(({ project }) => monacoLifecycle.update({ project, path: 'main.py', retained: [`ycoders-project://${project}/main.py`] }), { project });
  }
  assert.equal(await page.evaluate(() => monacoLifecycle.modelCount()), 1, 'Project switching must release the previous project model scope.');

  for (let index = 0; index < 20; index += 1) {
    await page.evaluate(() => monacoLifecycle.unmount());
    assert.equal(await page.evaluate(() => monacoLifecycle.modelCount()), 0);
    await page.evaluate(({ index }) => monacoLifecycle.mount({ project: `route-${index}`, path: 'main.py', retained: [`ycoders-project://route-${index}/main.py`] }), { index });
  }
  assert.equal(await page.evaluate(() => monacoLifecycle.modelCount()), 1);

  const languages = ['python', 'javascript', 'typescript', 'c', 'cpp', 'java', 'php', 'r', 'csharp', 'vb', 'sql', 'asm'];
  for (let index = 0; index < 30; index += 1) {
    await page.evaluate((language) => monacoLifecycle.update({ language }), languages[index % languages.length]);
  }
  assert.equal(await page.evaluate(() => monacoLifecycle.modelCount()), 1, 'Language switches must reuse the active file model.');

  await page.evaluate(() => monacoLifecycle.unmount());
  for (let index = 0; index < 50; index += 1) {
    await page.evaluate(({ index, language }) => monacoLifecycle.mount({ scoped: false, value: `cycle ${index}`, language }), { index, language: languages[index % languages.length] });
    assert.equal(await page.evaluate(() => monacoLifecycle.modelCount()), 1, 'A mounted standalone/compiler editor owns one model.');
    await page.evaluate(() => monacoLifecycle.update({ value: '' }));
    await page.evaluate(() => monacoLifecycle.unmount());
    assert.equal(await page.evaluate(() => monacoLifecycle.modelCount()), 0, 'Standalone/compiler unmount must release its model.');
  }
  await cdp.send('HeapProfiler.collectGarbage');
  await page.evaluate(() => { monacoLifecycle.gc(); monacoLifecycle.gc(); });
  const finalCount = await page.evaluate(() => monacoLifecycle.modelCount());
  const heapAfter = await page.evaluate(() => monacoLifecycle.heap());
  const workersAfter = page.workers().length;
  const metricsAfter = await metrics();
  const domAfter = await cdp.send('Memory.getDOMCounters');
  assert.equal(finalCount, 0);
  assert.ok(workersAfter <= workersBefore + 1, 'Monaco workers must remain bounded across the long session.');

  console.log(JSON.stringify({ baseline, afterFileOpen, afterClose: afterClose.length, afterRename: afterRename.length, projectSwitches: 20, routeCycles: 20, languageSwitches: 30, standaloneCompilerCycles: 50, finalCount, workersBefore, workersAfter, heapBefore, heapAfter, domNodesBefore: domBefore.nodes, domNodesAfter: domAfter.nodes, detachedDocumentsBefore: domBefore.documents, detachedDocumentsAfter: domAfter.documents, eventListenersBefore: metricsBefore.JSEventListeners, eventListenersAfter: metricsAfter.JSEventListeners }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
