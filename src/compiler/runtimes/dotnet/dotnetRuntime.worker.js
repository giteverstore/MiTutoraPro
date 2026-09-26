import { DOTNET_ASSET_BASE_URL } from './dotnetRuntimeConfig.js';

let pendingRequest = null;
self.addEventListener('message', ({ data }) => {
  if (data.type === 'execute') pendingRequest = data;
});

async function waitForRequest() {
  while (!pendingRequest) await new Promise((resolve) => setTimeout(resolve, 0));
  return pendingRequest;
}

async function start() {
  const request = await waitForRequest();
  try {
    const runtimeUrl = new URL(`${DOTNET_ASSET_BASE_URL}_framework/dotnet.js`, self.location.origin);
    const { dotnet } = await import(/* @vite-ignore */ runtimeUrl.href);
    const runtime = await dotnet
      .withDiagnosticTracing(false)
      .create();
    const exports = await runtime.getAssemblyExports('YCoders.DotNetRuntime.dll');
    const execute = exports.YCoders.DotNetRuntime.Program.Execute;
    self.postMessage({ id: request.id, type: 'initialized', timeoutMs: request.timeoutMs });
    const payload = JSON.parse(execute(request.language, request.source, request.stdin));
    self.postMessage({ id: request.id, type: 'execution', ...payload });
  } catch (error) {
    self.postMessage({
      id: request.id,
      type: 'execution',
      status: 'error',
      phase: 'runtime',
      stdout: '',
      stderr: '',
      diagnostics: [],
      warnings: [],
      runtimeError: error?.message || String(error),
      exitCode: null,
      executionTimeMs: 0,
    });
  }
}

start();
