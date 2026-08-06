import assert from 'node:assert/strict';
import { detectorConfig } from '../src/exam/config/detectorConfig.js';
import { AudioService } from '../src/exam/services/AudioService.js';
import { VadInferenceService, VAD_RUNTIME_STATE } from '../src/exam/services/VadInferenceService.js';

class Target { constructor() { this.listeners = new Map(); } addEventListener(type, listener) { this.listeners.set(type, listener); } removeEventListener(type) { this.listeners.delete(type); } dispatch(type) { return this.listeners.get(type)?.(); } }
class Track extends Target { constructor() { super(); this.readyState = 'live'; this.enabled = true; this.muted = false; this.label = 'Test microphone'; } getSettings() { return { deviceId: 'mic-1', channelCount: 1 }; } stop() { this.readyState = 'ended'; } }
class Node { connect() {} disconnect() {} }
class Context {
  constructor() { this.state = 'suspended'; this.sampleRate = 48000; this.destination = {}; this.onstatechange = null; }
  async resume() { this.state = 'running'; this.onstatechange?.(); }
  async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
  async close() { this.state = 'closed'; this.onstatechange?.(); }
  createAnalyser() { return Object.assign(new Node(), { fftSize: 0, smoothingTimeConstant: 0 }); }
  createMediaStreamSource() { return new Node(); }
  createScriptProcessor() { return Object.assign(new Node(), { onaudioprocess: null }); }
  createGain() { return Object.assign(new Node(), { gain: { value: 1 } }); }
}
const immediateScheduler = { setTimeout(callback) { callback(); return 1; }, clearTimeout() {}, setInterval(callback) { this.interval = callback; return 2; }, clearInterval() {} };
const config = { ...detectorConfig.audio, maxRetries: 1 };

let attempts = 0; const track = new Track(); const stream = { active: true, getAudioTracks: () => [track], getTracks: () => [track] };
const devices = new Target(); devices.getUserMedia = async () => { attempts += 1; if (attempts === 1) throw Object.assign(new Error('temporary'), { name: 'NotReadableError' }); return stream; };
const documentTarget = new Target(); documentTarget.hidden = false;
const audio = new AudioService({ mediaDevices: devices, permissions: null, documentObject: documentTarget, AudioContextClass: Context, scheduler: immediateScheduler, userAgent: 'Firefox', development: true });
const session = await audio.open(config);
assert.equal(attempts, 2, 'Microphone acquisition should retry transient failures.');
assert.equal(session.context.state, 'running', 'Suspended AudioContext should resume during initialization.');
assert.equal(audio.getDiagnostics().deviceId, 'mic-1');
await session.context.suspend();
assert.equal(session.context.state, 'running', 'AudioContext state changes should trigger automatic resume.');
assert.equal(devices.listeners.has('devicechange'), true);
await devices.dispatch('devicechange');
assert.equal(attempts, 3, 'Device changes should reacquire the microphone once.');
assert.equal(audio.getDiagnostics().recoveryAttempts, 1);

let deniedCalls = 0; const deniedDevices = new Target(); deniedDevices.getUserMedia = async () => { deniedCalls += 1; throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); };
const denied = new AudioService({ mediaDevices: deniedDevices, AudioContextClass: Context, scheduler: immediateScheduler, development: true });
await assert.rejects(() => denied.open(config), (error) => error.code === 'PERMISSION_DENIED');
assert.equal(deniedCalls, 1, 'Permission denial must not be retried.');

class Tensor { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; } dispose() {} }
const fakeOrt = { env: { wasm: {} }, Tensor, InferenceSession: {} };
let modelAttempts = 0; const inferenceOutputs = [];
const vad = new VadInferenceService({ audioService: audio, config, scheduler: immediateScheduler, runtimeLoader: async () => ({ ort: fakeOrt, modelUrl: 'model.onnx' }), sessionFactory: async () => { modelAttempts += 1; if (modelAttempts === 1) throw new Error('model unavailable'); return { async run({ input }) { assert.deepEqual(input.dims, [1, 512]); return { stateN: new Tensor('float32', new Float32Array(256), [2, 1, 128]), output: new Tensor('float32', new Float32Array([0.8]), [1, 1]) }; }, async release() {} }; } });
vad.subscribe((result) => inferenceOutputs.push(result));
await vad.start();
assert.equal(modelAttempts, 2, 'Model initialization should retry.');
assert.equal(vad.runtimeState, VAD_RUNTIME_STATE.READY);
vad.acceptAudio(new Float32Array(1536).fill(0.05), 48000);
await vad.queue;
assert.equal(inferenceOutputs.length, 1);
assert.equal(inferenceOutputs[0].speechProbability, 0.800000011920929);
assert.ok(vad.getDiagnostics().lastInference !== null);

await vad.destroy(); await audio.destroy(); await denied.destroy();
assert.equal(audio.context, null); assert.equal(audio.stream, null); assert.equal(audio.frameListeners.size, 0);
process.stdout.write('Audio stability validation passed: permission handling, retry, AudioContext recovery, device monitoring, VAD initialization, inference, diagnostics, and cleanup.\n');
