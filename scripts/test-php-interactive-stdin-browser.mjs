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
      const { PhpWorkerClient } = await import('/src/compiler/runtimes/php/PhpWorkerClient.js');
      const client = new PhpWorkerClient({ timeoutMs: 10_000 });
      const events = [];
      const resumeLatencies = [];
      let submissionIndex = 0;
      let submittedAt = null;
      const started = performance.now();
      const result = await client.execute({
        source, stdin, executionId: 'php-interactive',
        onExecutionEvent: (event) => {
          events.push({ ...event, at: performance.now() });
          if ((event.type === 'stdout' || event.type === 'stderr') && submittedAt !== null) {
            resumeLatencies.push(performance.now() - submittedAt);
            submittedAt = null;
          }
          if (event.type === 'stdin-request') {
            const value = submissions[submissionIndex++];
            if (value === undefined) throw new Error('PHP requested more interactive submissions than expected.');
            queueMicrotask(() => {
              submittedAt = performance.now();
              client.submitStdin({ executionId: 'php-interactive', value: `${value}\n` });
            });
          }
        },
      });
      client.dispose();
      return { result, events, resumeLatencies, totalMs: performance.now() - started, isolated: crossOriginIsolated };
    },
    { source, submissions, stdin },
  );

  const fgetc = await runInteractive('<?php $c = fgetc(STDIN); echo $c;', ['A']);
  assert.equal(fgetc.isolated, true);
  assert.equal(fgetc.result.stdout, 'A');
  assert.equal(fgetc.events.filter(({ type }) => type === 'stdin-request').length, 1);

  const basic = await runInteractive(`<?php
echo "Name: ";
fflush(STDOUT);
$name = trim(fgets(STDIN));
echo $name;`, ['Avi']);
  assert.equal(basic.result.stdout, 'Name: Avi');
  const promptIndex = basic.events.findIndex(({ type, value }) => type === 'stdout' && value === 'Name: ');
  const inputIndex = basic.events.findIndex(({ type }) => type === 'stdin-request');
  assert.ok(promptIndex >= 0 && promptIndex < inputIndex);

  const multiple = await runInteractive(`<?php
echo "First: "; fflush(STDOUT); $a = trim(fgets(STDIN));
echo "Second: "; fflush(STDOUT); $b = trim(fgets(STDIN));
echo "$a $b";`, ['one', 'two']);
  assert.equal(multiple.result.stdout, 'First: Second: one two');
  assert.equal(multiple.events.filter(({ type }) => type === 'stdin-request').length, 2);

  const loop = await runInteractive(`<?php
while (true) {
 echo "> "; fflush(STDOUT); $value = trim(fgets(STDIN));
 if ($value === "quit") break;
 echo $value . PHP_EOL;
}`, ['one', 'two', 'quit']);
  assert.equal(loop.result.stdout, '> one\n> two\n> ');
  assert.equal(loop.events.filter(({ type }) => type === 'stdin-request').length, 3);

  const streamedLine = await runInteractive('<?php echo stream_get_line(STDIN, 1024, "\\n");', ['streamed']);
  assert.equal(streamedLine.result.stdout, 'streamed');

  const buffered = await runInteractive(`<?php
$a = trim(fgets(STDIN));
$b = trim(fgets(STDIN));
echo "$a $b";`, ['20'], '10');
  assert.equal(buffered.result.stdout, '10 20');
  assert.equal(buffered.events.filter(({ type }) => type === 'stdin-request').length, 1);

  const unicode = await runInteractive('<?php echo trim(fgets(STDIN));', ['こんにちは ನಮಸ್ಕಾರ Avi 🚀']);
  assert.equal(unicode.result.stdout, 'こんにちは ನಮಸ್ಕಾರ Avi 🚀');

  const stderr = await runInteractive(`<?php
fwrite(STDERR, "warning-before-input\\n");
$value = trim(fgets(STDIN));
fwrite(STDERR, "warning-after-$value\\n");`, ['Avi']);
  assert.equal(stderr.result.stderr, 'warning-before-input\nwarning-after-Avi\n');
  assert.ok(stderr.events.some(({ type, value }) => type === 'stderr' && value.includes('warning-before-input')));

  const cancellation = await page.evaluate(async () => {
    const { PhpWorkerClient } = await import('/src/compiler/runtimes/php/PhpWorkerClient.js');
    const client = new PhpWorkerClient({ timeoutMs: 10_000 });
    const controller = new AbortController();
    let cancellationName = '';
    try {
      await client.execute({
        source: '<?php fgets(STDIN);', executionId: 'cancel-php', signal: controller.signal,
        onExecutionEvent: (event) => { if (event.type === 'stdin-request') controller.abort(); },
      });
    } catch (error) { cancellationName = error.name; }
    const rerunStarted = performance.now();
    const recovered = await client.execute({ source: '<?php echo "recovered";', executionId: 'recover-php', onExecutionEvent: () => {} });
    const rerunMs = performance.now() - rerunStarted;
    client.dispose();
    return { cancellationName, recovered, rerunMs };
  });
  assert.equal(cancellation.cancellationName, 'AbortError');
  assert.equal(cancellation.recovered.stdout, 'recovered');

  const fatalRecovery = await page.evaluate(async () => {
    const { PhpWorkerClient } = await import('/src/compiler/runtimes/php/PhpWorkerClient.js');
    const client = new PhpWorkerClient({ timeoutMs: 10_000 });
    const warning = await client.execute({ source: '<?php trigger_error("learner warning", E_USER_WARNING);' });
    const failed = await client.execute({ source: '<?php undefined_function();' });
    const recovered = await client.execute({ source: '<?php echo "after-error";' });
    client.dispose();
    return { warning, failed, recovered };
  });
  assert.match(fatalRecovery.warning.stderr, /learner warning|Warning/i);
  assert.notEqual(fatalRecovery.failed.exitCode, 0);
  assert.match(fatalRecovery.failed.stderr, /undefined_function|Fatal error/i);
  assert.equal(fatalRecovery.recovered.stdout, 'after-error');

  console.log(JSON.stringify({
    message: 'PHP interactive browser matrix passed.',
    coldMs: basic.totalMs,
    resumeMs: basic.resumeLatencies,
    rerunMs: cancellation.rerunMs,
  }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
