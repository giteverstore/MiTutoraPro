import assert from 'node:assert/strict';
import { detectorConfig } from '../src/exam/config/detectorConfig.js';
import { AudioDetector, AUDIO_STATUS } from '../src/exam/detectors/AudioDetector.js';
import { createExamConfig } from '../src/exam/engine/ExamConfig.js';
import { EventBus } from '../src/exam/engine/EventBus.js';
import { MonitoringSession, MONITORING_VIOLATIONS } from '../src/exam/monitoring/MonitoringSession.js';

class Track extends EventTarget { constructor() { super(); this.enabled = true; this.muted = false; this.readyState = 'live'; } }
class NoopDetector { start() {} stop() {} pause() {} resume() {} reset() {} destroy() {} getStatus() { return { status: 'RUNNING' }; } }
let now = 0; const track = new Track();
const audioService = { health: new Set(), async open() { return { stream: { getAudioTracks: () => [track] } }; }, subscribeHealth(listener) { this.health.add(listener); return () => this.health.delete(listener); }, getDiagnostics() { return null; }, stop() {}, pause() {}, async resume() {}, destroy() {} };
const vad = { runtimeState: 'READY', listeners: new Set(), statuses: new Set(), subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }, subscribeStatus(listener) { this.statuses.add(listener); return () => this.statuses.delete(listener); }, getDiagnostics() { return {}; }, async start() {}, stop() {}, pause() {}, reset() {}, destroy() {}, emit(values) { const result = { speechProbability: 0.05, noiseProbability: 0.05, confidence: 0.9, rms: 0.01, peak: 0.02, clippingRatio: 0, zeroCrossingRate: 0.04, crestFactor: 2, timestamp: now, modelVersion: 'silero-vad-v5', featureVersion: 'acoustic-features-v1', ...values }; this.listeners.forEach((listener) => listener(result)); } };
const config = { ...detectorConfig.audio, probabilitySmoothingWindow: 1, acousticSmoothingWindow: 1, speechPersistence: 100, conversationDuration: 300, mediaPersistence: 0, typingMinimumTransients: 5, typingWindow: 2000, typingPersistence: 800, typingMaximumTransientGap: 350, typingConfidence: 0.7, adaptiveMinimumSamples: 2 };
const bus = new EventBus();
const monitor = new MonitoringSession({ eventBus: bus, detectors: { noop: new NoopDetector() }, config: createExamConfig({ monitoring: { lifecycleUpdateIntervalMs: 100000 } }), clock: () => now });
await monitor.start();
const detector = new AudioDetector({ eventBus: bus, audioService, vadService: vad, config, clock: () => now }); await detector.start();

vad.emit({ rms: 0.012 }); now = 20; vad.emit({ rms: 0.014 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.SILENCE);
assert.ok(detector.getStatus().details.noiseFloor > 0.01, 'Ambient baseline should adapt during silence.');

now = 100; vad.emit({ speechProbability: 0.9, noiseProbability: 0.02, rms: 0.1 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.SILENCE, 'Brief speech must remain ignored.');
now = 250; vad.emit({ speechProbability: 0.9, noiseProbability: 0.02, rms: 0.1 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.CANDIDATE_SPEAKING);
assert.ok(monitor.getSnapshot().activeViolations.some(({ type }) => type === MONITORING_VIOLATIONS.VOICE_ACTIVITY));
now = 450; vad.emit({ speechProbability: 0.9, noiseProbability: 0.02, rms: 0.1 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.CONTINUOUS_CONVERSATION);
assert.equal(monitor.getSnapshot().activeViolations.filter(({ type }) => type === MONITORING_VIOLATIONS.VOICE_ACTIVITY).length, 1, 'Conversation escalation must reuse one lifecycle event.');

now = 500; vad.emit({ speechProbability: 0.05, noiseProbability: 0.85, rms: 0.12, crestFactor: 1.2 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.MUSIC_ESTIMATED);
assert.ok(detector.getStatus().details.acousticEvent.confidence >= config.musicConfidence);

const impulse = { speechProbability: 0.02, noiseProbability: 0.2, rms: 0.08, peak: 0.5, crestFactor: 6, zeroCrossingRate: 0.2 };
now = 550; vad.emit(impulse);
assert.notEqual(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'A single mouse click must be suppressed.');
assert.equal(detector.getStatus().details.transientSuppressed, true);

for (const timestamp of [1000, 1700, 2400]) { now = timestamp; vad.emit(impulse); }
assert.notEqual(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'Repeated isolated mouse clicks must not become typing.');

for (const timestamp of [2800, 2900]) { now = timestamp; vad.emit(impulse); }
assert.notEqual(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'A short keyboard tap must not immediately become typing.');

for (const timestamp of [3200, 3400, 3600, 3800, 4000, 4200]) { now = timestamp; vad.emit(impulse); }
assert.equal(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'Sustained keyboard evidence should pass the configured persistence gate.');
assert.ok(detector.getStatus().details.typingEvidenceDuration >= config.typingPersistence);
assert.equal(monitor.getSnapshot().activeViolations.filter(({ type }) => type === MONITORING_VIOLATIONS.KEYBOARD_ACTIVITY).length, 1, 'Sustained typing must create one evolving violation.');

now = 5000; vad.emit({ speechProbability: 0.45, noiseProbability: 0.05, rms: 0.008, crestFactor: 2, zeroCrossingRate: 0.04 });
assert.notEqual(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'A whisper-like frame must not be classified from volume as typing.');
now = 5100; vad.emit({ speechProbability: 0.9, noiseProbability: 0.02, rms: 0.08 });
now = 5250; vad.emit({ speechProbability: 0.9, noiseProbability: 0.02, rms: 0.08 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.CANDIDATE_SPEAKING, 'Normal speech must remain driven by Silero probability.');
now = 5400; vad.emit({ speechProbability: 0.98, noiseProbability: 0.01, rms: 0.3, peak: 0.6 });
assert.notEqual(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'Loud speech must not become typing.');
now = 6200; vad.emit({ speechProbability: 0.03, noiseProbability: 0.7, rms: 0.06, crestFactor: 1.8, zeroCrossingRate: 0.06 });
assert.notEqual(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'Steady fan noise must not become typing.');
now = 6300; vad.emit({ speechProbability: 0.05, noiseProbability: 0.85, rms: 0.12, crestFactor: 1.2 });
assert.equal(detector.getStatus().status, AUDIO_STATUS.MUSIC_ESTIMATED, 'Tonal media evidence must remain separate from typing and speech.');
now = 7000; vad.emit(impulse);
assert.notEqual(detector.getStatus().status, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, 'A random short impulse must be suppressed.');

track.muted = true; now = 7100; vad.emit({}); assert.equal(detector.getStatus().status, AUDIO_STATUS.MUTED);
track.muted = false; track.readyState = 'ended'; now = 7200; vad.emit({}); assert.equal(detector.getStatus().status, AUDIO_STATUS.DISCONNECTED);
assert.ok(monitor.getSnapshot().timeline.some(({ metadata }) => metadata.evidence), 'Monitoring timeline should retain detector evidence.');

detector.destroy(); monitor.destroy(); bus.clear();
process.stdout.write('Acoustic integrity validation passed: persistence, conversation, media, keyboard, adaptive noise, health, smoothing, evidence, and lifecycle deduplication.\n');
