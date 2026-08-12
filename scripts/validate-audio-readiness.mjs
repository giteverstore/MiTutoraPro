import assert from 'node:assert/strict';
import { detectorConfig } from '../src/exam/config/detectorConfig.js';
import { AudioDetector, AUDIO_HEALTH, AUDIO_STATUS } from '../src/exam/detectors/AudioDetector.js';
import { EventBus } from '../src/exam/engine/EventBus.js';

class Track extends EventTarget {
  constructor() { super(); this.enabled = true; this.muted = false; this.readyState = 'live'; }
}

let now = 0;
const track = new Track();
const healthListeners = new Set();
const audioService = {
  async open() { return { stream: { getAudioTracks: () => [track] } }; },
  subscribeHealth(listener) { healthListeners.add(listener); return () => healthListeners.delete(listener); },
  getDiagnostics() { return {}; }, stop() {}, destroy() {},
};
const vad = {
  runtimeState: 'READY', listeners: new Set(), statuses: new Set(),
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); },
  subscribeStatus(listener) { this.statuses.add(listener); return () => this.statuses.delete(listener); },
  getDiagnostics() { return {}; }, async start() {}, stop() {}, reset() {}, destroy() {},
  emit(values) { const result = { speechProbability: 0, noiseProbability: 0, confidence: 1, rms: 0, peak: 0, clippingRatio: 0, zeroCrossingRate: 0, crestFactor: 0, timestamp: now, featureVersion: 'test', ...values }; this.listeners.forEach((listener) => listener(result)); },
};
const detector = new AudioDetector({ eventBus: new EventBus(), audioService, vadService: vad, config: { ...detectorConfig.audio, probabilitySmoothingWindow: 1, acousticSmoothingWindow: 1, zeroInputDuration: 10 }, clock: () => now });
await detector.start();

vad.emit({}); now = 1000; vad.emit({});
assert.equal(detector.getStatus().status, AUDIO_STATUS.SILENCE);
assert.equal(detector.getStatus().details.audioHealth, AUDIO_HEALTH.READY);
assert.equal(detector.getStatus().details.audioActivity, 'SILENT');
assert.equal(detector.getStatus().quality, 100);

now = 1100; vad.emit({ speechProbability: 0.9, rms: 0.08 });
assert.equal(detector.getStatus().details.audioHealth, AUDIO_HEALTH.READY);
now = 4000; vad.emit({ speechProbability: 0.9, rms: 0.08 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.CANDIDATE_SPEAKING);
assert.equal(detector.getStatus().details.audioHealth, AUDIO_HEALTH.READY);
now = 4100; vad.emit({});
assert.equal(detector.getStatus().details.audioHealth, AUDIO_HEALTH.READY);

track.readyState = 'ended'; now = 4200; vad.emit({});
assert.equal(detector.getStatus().status, AUDIO_STATUS.DISCONNECTED);
assert.equal(detector.getStatus().details.audioHealth, AUDIO_HEALTH.DISCONNECTED);

track.readyState = 'live';
healthListeners.forEach((listener) => listener({ type: 'RECOVERED', session: { stream: { getAudioTracks: () => [track] } } }));
now = 4300; vad.emit({});
assert.equal(detector.getStatus().details.audioHealth, AUDIO_HEALTH.READY);

healthListeners.forEach((listener) => listener({ type: 'FAILED', error: { message: 'Pipeline failed.' } }));
assert.equal(detector.getStatus().status, AUDIO_STATUS.UNAVAILABLE);
assert.equal(detector.getStatus().details.audioHealth, AUDIO_HEALTH.FAILED);

detector.destroy();
process.stdout.write('Audio readiness validation passed: silence and activity remain healthy; disconnect, recovery, and pipeline failure remain distinct.\n');
