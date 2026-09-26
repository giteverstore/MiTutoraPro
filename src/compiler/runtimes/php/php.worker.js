import { PHP, loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from '@php-wasm/web-8-4';

function createStdinReader(stdin) {
  const bytes = new TextEncoder().encode(String(stdin ?? ''));
  let index = 0;
  return () => index < bytes.length ? bytes[index++] : null;
}

function safeFileName(filename) {
  const normalized = String(filename ?? 'main.php').replace(/\\/g, '/');
  const baseName = normalized.split('/').pop();
  return baseName && /^[a-zA-Z0-9._-]+$/.test(baseName) ? baseName : 'main.php';
}

async function executePhp({ source, stdin, filename }) {
  const startedAt = performance.now();
  try {
    const loaderModule = await getPHPLoaderModule();
    const runtimeId = await loadPHPRuntime(loaderModule, {
      noInitialRun: true,
      stdin: createStdinReader(stdin),
    });
    const php = new PHP(runtimeId);
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
  self.postMessage({ type: 'execution', ...await executePhp(data) });
});
