import { TeaVMJavaEngine } from './TeaVMJavaEngine.js';

const engine = new TeaVMJavaEngine();

self.addEventListener('message', async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'initialize') {
      await engine.initialize();
      self.postMessage({ id, type: 'initialized' });
      return;
    }
    if (type === 'reset') {
      engine.reset();
      self.postMessage({ id, type: 'reset' });
      return;
    }
    const startedAt = performance.now();
    const result = await engine.execute(data);
    self.postMessage({
      id,
      type: 'execution',
      ...result,
      executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
    });
  } catch (error) {
    self.postMessage({
      id,
      type: type === 'initialize' ? 'initialization-error' : 'execution',
      status: 'error',
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: 0,
    });
  }
});
