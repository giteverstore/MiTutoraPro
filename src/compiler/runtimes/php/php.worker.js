import { PHP, __private__dont__use, loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from '@php-wasm/web-8-4';
import { COMPILER_EXECUTION_EVENTS } from '../../core/interactiveStdinProtocol.js';
import { createPhpStdinReader } from './phpInteractiveChannel.js';

function installLiveOutput(runtime, id) {
  for (const [property, type] of [['onStdout', COMPILER_EXECUTION_EVENTS.STDOUT], ['onStderr', COMPILER_EXECUTION_EVENTS.STDERR]]) {
    let listener;
    const decoder = new TextDecoder();
    Object.defineProperty(runtime, property, {
      configurable: true,
      get: () => listener,
      set: (next) => {
        listener = (chunk) => {
          self.postMessage({ id, type, value: decoder.decode(chunk, { stream: true }) });
          next?.(chunk);
        };
      },
    });
  }
}

function safeFileName(filename) {
  const normalized = String(filename ?? 'main.php').replace(/\\/g, '/');
  const baseName = normalized.split('/').pop();
  return baseName && /^[a-zA-Z0-9._-]+$/.test(baseName) ? baseName : 'main.php';
}

async function executePhp(request) {
  const { source, stdin, filename } = request;
  const startedAt = performance.now();
  try {
    const loaderModule = await getPHPLoaderModule();
    const runtimeId = await loadPHPRuntime(loaderModule, {
      noInitialRun: true,
      stdin: createPhpStdinReader({
        ...request,
        onRequest: (executionId) => self.postMessage({
          id: request.id,
          type: COMPILER_EXECUTION_EVENTS.STDIN_REQUEST,
          executionId,
        }),
      }),
    });
    const php = new PHP(runtimeId);
    installLiveOutput(php[__private__dont__use], request.id);
    const scriptPath = `/tmp/${safeFileName(filename)}`;
    php.writeFile(scriptPath, String(source ?? ''));
    const response = await php.cli(['php', '-d', 'display_errors=0', scriptPath], {
      env: { SCRIPT_PATH: scriptPath },
      cwd: '/tmp',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      response.stdoutText,
      response.stderrText,
      response.exitCode,
    ]);

    return {
      status: exitCode === 0 ? 'success' : 'error',
      stdout,
      stderr,
      exitCode,
      executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
    };
  } catch (error) {
    return {
      status: 'error',
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
    };
  }
}

self.addEventListener('message', async ({ data }) => {
  if (data.type !== 'execute') return;
  self.postMessage({ id: data.id, type: 'initialized', timeoutMs: data.timeoutMs });
  self.postMessage({ id: data.id, type: 'execution', ...await executePhp(data) });
});
