import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const baseUrl = server.resolvedUrls?.local?.[0];
if (!baseUrl) throw new Error('Unable to resolve the local Vite test URL.');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${baseUrl}dotnet/main.js`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const runInteractive = (source, submissions, stdin = '') => page.evaluate(
    async ({ source, submissions, stdin }) => {
      const { WebRClient } = await import('/src/compiler/runtimes/r/WebRClient.js');
      const client = new WebRClient({ timeoutMs: 10_000 });
      const events = [];
      const resumeLatencies = [];
      let index = 0;
      let submittedAt = null;
      const started = performance.now();
      const result = await client.execute({
        source, stdin, executionId: 'r-browser',
        onExecutionEvent: (event) => {
          events.push({ ...event, at: performance.now() });
          if ((event.type === 'stdout' || event.type === 'stderr') && submittedAt !== null) {
            resumeLatencies.push(performance.now() - submittedAt);
            submittedAt = null;
          }
          if (event.type === 'stdin-request') {
            const value = submissions[index++];
            if (value === undefined) throw new Error('R requested more input than supplied.');
            setTimeout(() => {
              submittedAt = performance.now();
              client.submitStdin({ executionId: 'r-browser', value: `${value}\n` });
            }, 10);
          }
        },
      });
      client.dispose();
      return { result, events, resumeLatencies, totalMs: performance.now() - started, isolated: crossOriginIsolated };
    },
    { source, submissions, stdin },
  );

  const basic = await runInteractive('name <- readline("Name: "); cat(name, "\\n")', ['Avi']);
  assert.equal(basic.isolated, true);
  assert.match(basic.result.stdout, /Avi/);
  assert.ok(basic.events.some(({ type, value }) => type === 'stdout' && value === 'Name: '));
  assert.equal(basic.events.filter(({ type }) => type === 'stdin-request').length, 1);

  const multiple = await runInteractive('a <- readline("First: "); b <- readline("Second: "); cat(a, b, "\\n")', ['10', '20']);
  assert.match(multiple.result.stdout, /10 20/);
  assert.equal(multiple.events.filter(({ type }) => type === 'stdin-request').length, 2);

  const loop = await runInteractive('repeat { value <- readline("> "); if (value == "quit") break; cat(value, "\\n") }', ['one', 'two', 'quit']);
  assert.match(loop.result.stdout, /one/);
  assert.match(loop.result.stdout, /two/);
  assert.equal(loop.events.filter(({ type }) => type === 'stdin-request').length, 3);

  const buffered = await runInteractive('a <- readline("First: "); b <- readline("Second: "); cat(a, b, "\\n")', ['20'], '10');
  assert.match(buffered.result.stdout, /10 20/);
  assert.equal(buffered.events.filter(({ type }) => type === 'stdin-request').length, 1);

  const blank = await runInteractive('x <- readline("Value: "); cat(nchar(x), "\\n")', ['']);
  assert.match(blank.result.stdout, /0/);
  const spaces = await runInteractive('x <- readline("Value: "); cat(x, "\\n")', ['Avi Kumar']);
  assert.match(spaces.result.stdout, /Avi Kumar/);
  const unicode = await runInteractive('x <- readline("Value: "); cat(x, "\\n")', ['こんにちは ನಮಸ್ಕಾರ Avi 🚀']);
  assert.match(unicode.result.stdout, /こんにちは ನಮಸ್ಕಾರ Avi 🚀/);

  const scan = await runInteractive('x <- scan(n = 1, quiet = TRUE); cat(x, "\\n")', ['42']);
  assert.match(scan.result.stdout, /42/);
  const readLines = await runInteractive('x <- readLines("stdin", n = 1); cat(x, "\\n")', ['line input']);
  assert.doesNotMatch(readLines.result.stdout, /line input/);
  assert.equal(readLines.events.filter(({ type }) => type === 'stdin-request').length, 0);
  const conditions = await runInteractive('cat("normal\\n"); message("learner message"); warning("learner warning")', []);
  assert.match(conditions.result.stdout, /normal/);
  assert.match(conditions.result.stderr, /learner message/);
  assert.match(conditions.result.stderr, /learner warning/);
  assert.ok(conditions.events.some(({ type, value }) => type === 'stderr' && /learner message|learner warning/.test(value)));

  const recovery = await page.evaluate(async () => {
    const { WebRClient } = await import('/src/compiler/runtimes/r/WebRClient.js');
    const client = new WebRClient({ timeoutMs: 10_000 });
    const controller = new AbortController();
    let cancellationName = '';
    try {
      await client.execute({
        source: 'readline("Cancel: ")', executionId: 'cancel-r', signal: controller.signal,
        onExecutionEvent: (event) => { if (event.type === 'stdin-request') controller.abort(); },
      });
    } catch (error) { cancellationName = error.name; }
    const rerunStarted = performance.now();
    const recovered = await client.execute({
      source: 'cat("recovered\\n")', executionId: 'recover-r',
      onExecutionEvent: () => {},
    });
    const failed = await client.execute({
      source: 'stop("failure")', executionId: 'failed-r',
      onExecutionEvent: () => {},
    });
    const afterError = await client.execute({
      source: 'cat("after-error\\n")', executionId: 'after-error-r',
      onExecutionEvent: () => {},
    });
    client.dispose();
    return { cancellationName, recovered, failed, afterError, rerunMs: performance.now() - rerunStarted };
  });
  assert.equal(recovery.cancellationName, 'AbortError');
  assert.match(recovery.recovered.stdout, /recovered/);
  assert.equal(recovery.failed.status, 'error');
  assert.match(recovery.failed.stderr, /failure/);
  assert.match(recovery.afterError.stdout, /after-error/);

  console.log(JSON.stringify({
    message: 'R interactive browser matrix passed.',
    coldMs: basic.totalMs,
    resumeMs: basic.resumeLatencies,
    rerunAndRecoveryMs: recovery.rerunMs,
    scan: scan.result.stdout,
    readLines: readLines.result.stdout,
  }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
