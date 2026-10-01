import { executeJavaScriptSource } from './javascriptExecution.js';
import { lockDownJavaScriptWorker } from './javascriptCapabilityBoundary.js';

const runtimeBridge = Object.freeze({
  addEventListener: self.addEventListener.bind(self),
  postMessage: self.postMessage.bind(self),
});
const capabilityBoundary = lockDownJavaScriptWorker(self);

if (capabilityBoundary.retained.length) {
  throw new Error(`The JavaScript compiler capability boundary could not be established: ${capabilityBoundary.retained.join(', ')}`);
}

function createInteractiveReader(data) {
  if (!data.interactive || !data.controlBuffer || !data.inputBuffer) return undefined;
  const control = new Int32Array(data.controlBuffer);
  const input = new Uint8Array(data.inputBuffer);
  return () => {
    input.fill(0);
    Atomics.store(control, 1, 0);
    Atomics.store(control, 0, 1);
    runtimeBridge.postMessage({ id: data.id, type: 'stdin-request', executionId: data.executionId });
    const state = Atomics.wait(control, 0, 1, data.inputWaitTimeoutMs);
    if (state === 'timed-out') throw new Error('JavaScript input wait exceeded 90 seconds.');
    const value = new TextDecoder().decode(input.slice(0, Atomics.load(control, 1)));
    Atomics.store(control, 0, 0);
    return value.replace(/\r?\n$/, '');
  };
}

runtimeBridge.addEventListener('message', async ({ data }) => {
  if (data.type !== 'execute') return;
  const result = await executeJavaScriptSource({
    ...data,
    requestInput: createInteractiveReader(data),
    onStdout: (value) => runtimeBridge.postMessage({ id: data.id, type: 'stdout', value }),
    onStderr: (value) => runtimeBridge.postMessage({ id: data.id, type: 'stderr', value }),
  });
  runtimeBridge.postMessage({ id: data.id, type: 'execution', ...result });
});
