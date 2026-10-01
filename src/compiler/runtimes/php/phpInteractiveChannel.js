import { INTERACTIVE_STDIN_BUFFER_BYTES, INTERACTIVE_STDIN_WAIT_TIMEOUT_MS } from '../../core/interactiveStdinProtocol.js';

const IDLE = 0;
const WAITING = 1;
const SUBMITTED = 2;

export function createPhpStdinReader({ stdin = '', interactive, controlBuffer, inputBuffer, executionId, onRequest }) {
  const initial = String(stdin ?? '').replace(/\r\n?/g, '\n');
  const normalized = initial && !initial.endsWith('\n') ? `${initial}\n` : initial;
  let queued = Array.from(new TextEncoder().encode(normalized));
  let boundaryPending = queued.length > 0;

  const refill = () => {
    if (!interactive || !controlBuffer || !inputBuffer) return false;
    const control = new Int32Array(controlBuffer);
    Atomics.store(control, 1, 0);
    Atomics.store(control, 0, WAITING);
    onRequest(executionId);
    const state = Atomics.wait(control, 0, WAITING, INTERACTIVE_STDIN_WAIT_TIMEOUT_MS);
    if (state === 'timed-out' || Atomics.load(control, 0) !== SUBMITTED) {
      throw new Error('PHP input wait exceeded 90 seconds.');
    }
    queued.push(...new Uint8Array(inputBuffer).slice(0, Atomics.load(control, 1)));
    boundaryPending = true;
    Atomics.store(control, 0, IDLE);
    return true;
  };

  return () => {
    if (!queued.length && boundaryPending) {
      boundaryPending = false;
      return null;
    }
    if (!queued.length && !refill()) return null;
    return queued.shift();
  };
}

export function createPhpInputBuffers() {
  return {
    controlBuffer: new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2),
    inputBuffer: new SharedArrayBuffer(INTERACTIVE_STDIN_BUFFER_BYTES),
  };
}

export function submitPhpInput(active, executionId, value) {
  if (!active?.controlBuffer || active.executionId !== String(executionId ?? '')) return false;
  const control = new Int32Array(active.controlBuffer);
  if (Atomics.load(control, 0) !== WAITING) return false;
  const bytes = new TextEncoder().encode(String(value ?? ''));
  if (bytes.byteLength > active.inputBuffer.byteLength) throw new Error('Interactive input is too large.');
  const target = new Uint8Array(active.inputBuffer);
  target.fill(0);
  target.set(bytes);
  Atomics.store(control, 1, bytes.byteLength);
  Atomics.store(control, 0, SUBMITTED);
  Atomics.notify(control, 0, 1);
  return true;
}
