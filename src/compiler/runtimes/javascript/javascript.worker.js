import { executeJavaScriptSource } from './javascriptExecution.js';

function createInteractiveReader(data) {
  if (!data.interactive || !data.controlBuffer || !data.inputBuffer) return undefined;
  const control = new Int32Array(data.controlBuffer);
  const input = new Uint8Array(data.inputBuffer);
  return () => {
    input.fill(0);
    Atomics.store(control, 1, 0);
    Atomics.store(control, 0, 1);
    self.postMessage({ id: data.id, type: 'stdin-request', executionId: data.executionId });
    const state = Atomics.wait(control, 0, 1, data.inputWaitTimeoutMs);
    if (state === 'timed-out') throw new Error('JavaScript input wait exceeded 90 seconds.');
    const value = new TextDecoder().decode(input.slice(0, Atomics.load(control, 1)));
    Atomics.store(control, 0, 0);
    return value.replace(/\r?\n$/, '');
  };
}

self.addEventListener('message', async ({ data }) => {
  if (data.type !== 'execute') return;
  const result = await executeJavaScriptSource({
    ...data,
    requestInput: createInteractiveReader(data),
    onStdout: (value) => self.postMessage({ id: data.id, type: 'stdout', value }),
    onStderr: (value) => self.postMessage({ id: data.id, type: 'stderr', value }),
  });
  self.postMessage({ id: data.id, type: 'execution', ...result });
});
