import assert from 'node:assert/strict';
import { detectorConfig } from '../src/exam/config/detectorConfig.js';
import { AudioDetector, AUDIO_STATUS } from '../src/exam/detectors/AudioDetector.js';
import { BackgroundDetector, BACKGROUND_STATUS } from '../src/exam/detectors/BackgroundDetector.js';
import { LightingDetector, LIGHTING_STATUS } from '../src/exam/detectors/LightingDetector.js';
import { createExamConfig } from '../src/exam/engine/ExamConfig.js';
import { EventBus } from '../src/exam/engine/EventBus.js';
import { MonitoringSession, MONITORING_VIOLATIONS } from '../src/exam/monitoring/MonitoringSession.js';

class InferenceFeed { constructor() { this.listeners = new Set(); } subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); } emit(frame) { this.listeners.forEach((listener) => listener({ frame })); } }
class Track { constructor() { this.enabled = true; this.muted = false; this.readyState = 'live'; this.listeners = new Map(); } addEventListener(type, listener) { this.listeners.set(type, listener); } removeEventListener(type) { this.listeners.delete(type); } }
class LifecycleDetector { start() {} stop() {} pause() {} resume() {} reset() {} destroy() {} getStatus() { return { status: 'RUNNING' }; } }

const bus = new EventBus();
const feed = new InferenceFeed();
const lighting = new LightingDetector({ eventBus: bus, inferenceService: feed, config: { ...detectorConfig.lighting, smoothingWindow: 2 } });
const background = new BackgroundDetector({ eventBus: bus, inferenceService: feed, config: { ...detectorConfig.background, smoothingWindow: 2 } });
lighting.start(); background.start();
feed.emit({ brightness: 20, contrast: 20, motion: 0 }); feed.emit({ brightness: 20, contrast: 20, motion: 0 });
assert.equal(lighting.getStatus().status, LIGHTING_STATUS.TOO_DARK);
feed.emit({ brightness: 130, contrast: 20, motion: 0 }); feed.emit({ brightness: 130, contrast: 20, motion: 0 });
assert.equal(lighting.getStatus().status, LIGHTING_STATUS.GOOD);
assert.equal(background.getStatus().status, BACKGROUND_STATUS.GOOD);
feed.emit({ brightness: 245, contrast: 20, motion: 50 }); feed.emit({ brightness: 245, contrast: 20, motion: 50 });
assert.equal(lighting.getStatus().status, LIGHTING_STATUS.TOO_BRIGHT);
assert.equal(background.getStatus().status, BACKGROUND_STATUS.NEEDS_ATTENTION);
feed.emit({ brightness: 3, contrast: 1, motion: 0 }); feed.emit({ brightness: 3, contrast: 1, motion: 0 });
assert.equal(background.getStatus().status, BACKGROUND_STATUS.UNABLE_TO_VERIFY);

let now = 0;
const track = new Track();
const audioService = { health: new Set(), async open() { return { stream: { getAudioTracks: () => [track] } }; }, subscribeHealth(listener) { this.health.add(listener); return () => this.health.delete(listener); }, getDiagnostics() { return null; }, stop() {}, pause() {}, async resume() {}, destroy() {} };
const vadService = { runtimeState: 'READY', listeners: new Set(), statuses: new Set(), subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }, subscribeStatus(listener) { this.statuses.add(listener); return () => this.statuses.delete(listener); }, getDiagnostics() { return {}; }, async start() {}, stop() {}, pause() {}, async resume() {}, reset() {}, destroy() {}, emit(result) { this.listeners.forEach((listener) => listener({ confidence: 0.9, rms: 0.1, peak: 0.2, clippingRatio: 0, zeroCrossingRate: 0.05, crestFactor: 2, timestamp: now, modelVersion: 'silero-vad-v5', featureVersion: 'test', ...result })); } };
const audio = new AudioDetector({ eventBus: bus, audioService, vadService, config: { ...detectorConfig.audio, probabilitySmoothingWindow: 1, speechPersistence: 0 }, clock: () => now });
await audio.start();
vadService.emit({ speechProbability: 0.05, noiseProbability: 0.05 }); assert.equal(audio.getStatus().status, AUDIO_STATUS.SILENCE);
now = 100; vadService.emit({ speechProbability: 0.9, noiseProbability: 0.05 }); assert.equal(audio.getStatus().status, AUDIO_STATUS.SPEECH);
now = 200; vadService.emit({ speechProbability: 0.05, noiseProbability: 0.9, rms: 0.2 }); assert.equal(audio.getStatus().status, AUDIO_STATUS.LOUD_BACKGROUND_NOISE);
track.muted = true; vadService.emit({ speechProbability: 0.05, noiseProbability: 0.05 }); assert.equal(audio.getStatus().status, AUDIO_STATUS.MUTED);

const config = createExamConfig({ monitoring: { lifecycleUpdateIntervalMs: 100000 } });
const monitoring = new MonitoringSession({ eventBus: bus, detectors: { test: new LifecycleDetector() }, config, clock: () => now });
await monitoring.start();
track.muted = false; now = 300; vadService.emit({ speechProbability: 0.9, noiseProbability: 0.05 });
assert.ok(monitoring.getSnapshot().activeViolations.some(({ type }) => type === MONITORING_VIOLATIONS.VOICE_ACTIVITY));
now = 400; vadService.emit({ speechProbability: 0.05, noiseProbability: 0.05 });
assert.ok(!monitoring.getSnapshot().activeViolations.some(({ type }) => type === MONITORING_VIOLATIONS.VOICE_ACTIVITY));

monitoring.destroy(); audio.destroy(); lighting.destroy(); background.destroy(); bus.clear();
process.stdout.write('Secure exam V1 validation passed: stable lighting, background classification, microphone states, audio activity, and monitoring lifecycle.\n');
