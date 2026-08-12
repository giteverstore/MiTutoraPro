import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorEvidence } from '../models/DetectorEvidence.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';
import { AUDIO_PIPELINE_STATE } from '../services/AudioService.js';
import { VAD_RUNTIME_STATE } from '../services/VadInferenceService.js';
import { AcousticEvent } from '../models/AcousticEvent.js';

export const AUDIO_STATUS = Object.freeze({ INITIALIZING: 'INITIALIZING', SILENCE: 'SILENCE', QUIET: 'SILENCE', CANDIDATE_SPEAKING: 'CANDIDATE_SPEAKING', SPEECH: 'CANDIDATE_SPEAKING', TALKING: 'CANDIDATE_SPEAKING', OTHER_SPEAKER_ESTIMATED: 'OTHER_SPEAKER_ESTIMATED', CONTINUOUS_CONVERSATION: 'CONTINUOUS_CONVERSATION', MUSIC_ESTIMATED: 'MUSIC_ESTIMATED', MEDIA_PLAYBACK_ESTIMATED: 'MEDIA_PLAYBACK_ESTIMATED', KEYBOARD_TYPING_ESTIMATED: 'KEYBOARD_TYPING_ESTIMATED', LOUD_BACKGROUND_NOISE: 'LOUD_BACKGROUND_NOISE', AMBIENT_NOISE: 'LOUD_BACKGROUND_NOISE', LOUD_NOISE: 'LOUD_BACKGROUND_NOISE', ZERO_INPUT: 'ZERO_INPUT', SATURATED: 'SATURATED', UNKNOWN_AUDIO: 'UNKNOWN_AUDIO', MUTED: 'MUTED', DISCONNECTED: 'DISCONNECTED', UNAVAILABLE: 'UNAVAILABLE' });
export const AUDIO_HEALTH = Object.freeze({ INITIALIZING: 'INITIALIZING', READY: 'READY', RECOVERING: 'RECOVERING', PERMISSION_DENIED: 'PERMISSION_DENIED', DISCONNECTED: 'DISCONNECTED', FAILED: 'FAILED', UNAVAILABLE: 'UNAVAILABLE' });
const states = {
  [AUDIO_STATUS.INITIALIZING]: ['Loading local voice activity model…', DETECTOR_SEVERITY.PENDING],
  [AUDIO_STATUS.SILENCE]: ['Microphone is connected; no sustained voice activity.', DETECTOR_SEVERITY.SUCCESS],
  [AUDIO_STATUS.CANDIDATE_SPEAKING]: ['Conversation detected. Please remain silent.', DETECTOR_SEVERITY.WARNING],
  [AUDIO_STATUS.OTHER_SPEAKER_ESTIMATED]: ['Another speaker may be audible. Please ensure the room is private.', DETECTOR_SEVERITY.WARNING],
  [AUDIO_STATUS.CONTINUOUS_CONVERSATION]: ['Continuous conversation detected. Please remain silent.', DETECTOR_SEVERITY.ERROR],
  [AUDIO_STATUS.MUSIC_ESTIMATED]: ['Music detected. Turn off background media.', DETECTOR_SEVERITY.WARNING],
  [AUDIO_STATUS.MEDIA_PLAYBACK_ESTIMATED]: ['Television or media playback may be active. Turn off background media.', DETECTOR_SEVERITY.WARNING],
  [AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED]: ['Keyboard activity detected. Avoid typing during the exam.', DETECTOR_SEVERITY.WARNING],
  [AUDIO_STATUS.LOUD_BACKGROUND_NOISE]: ['Loud background noise detected. Move to a quieter location.', DETECTOR_SEVERITY.WARNING],
  [AUDIO_STATUS.ZERO_INPUT]: ['The microphone has no usable input. Check the microphone level.', DETECTOR_SEVERITY.ERROR],
  [AUDIO_STATUS.SATURATED]: ['The microphone input is clipping. Reduce microphone gain.', DETECTOR_SEVERITY.ERROR],
  [AUDIO_STATUS.UNKNOWN_AUDIO]: ['Unclassified audio activity detected.', DETECTOR_SEVERITY.WARNING],
  [AUDIO_STATUS.MUTED]: ['Microphone is muted.', DETECTOR_SEVERITY.ERROR],
  [AUDIO_STATUS.DISCONNECTED]: ['Microphone was disconnected.', DETECTOR_SEVERITY.ERROR],
  [AUDIO_STATUS.UNAVAILABLE]: ['Microphone or local voice analysis is unavailable.', DETECTOR_SEVERITY.ERROR],
};
export function createAudioStatus(status, quality = status === AUDIO_STATUS.SILENCE ? 100 : 0, details = {}) { const [defaultMessage, severity] = states[status]; return new DetectorStatus({ status, message: details.message ?? defaultMessage, severity, quality, details }); }

export function audioHealthFor({ pipelineState, status, track } = {}) {
  if (pipelineState === AUDIO_PIPELINE_STATE.PERMISSION_DENIED) return AUDIO_HEALTH.PERMISSION_DENIED;
  if (pipelineState === AUDIO_PIPELINE_STATE.FAILED || status === AUDIO_STATUS.UNAVAILABLE) return AUDIO_HEALTH.FAILED;
  if (pipelineState === AUDIO_PIPELINE_STATE.RECOVERING) return AUDIO_HEALTH.RECOVERING;
  if (status === AUDIO_STATUS.DISCONNECTED || track?.readyState === 'ended') return AUDIO_HEALTH.DISCONNECTED;
  if (pipelineState === AUDIO_PIPELINE_STATE.READY && track?.readyState === 'live' && track.enabled && !track.muted) return AUDIO_HEALTH.READY;
  return AUDIO_HEALTH.INITIALIZING;
}

export class AudioDetector {
  constructor({ eventBus, audioService, vadService, config, clock = () => Date.now() }) {
    this.id = 'audio'; this.eventBus = eventBus; this.audioService = audioService; this.vadService = vadService; this.config = config; this.clock = clock;
    this.status = createAudioStatus(AUDIO_STATUS.INITIALIZING); this.pipelineState = AUDIO_PIPELINE_STATE.UNINITIALIZED; this.unsubscribe = null; this.unsubscribeHealth = null; this.unsubscribeVadStatus = null; this.track = null; this.trackHandlers = null; this.samples = []; this.currentState = null; this.stateSince = null; this.observedSpeechSince = null; this.lastSpeechAt = null; this.zeroInputSince = null; this.transients = []; this.transientState = this.emptyTransientState(); this.noiseFloor = config.initialNoiseFloor; this.noiseFloorSamples = 0; this.activeAcousticEvent = null; this.active = false; this.lastError = null;
  }
  async start() {
    if (this.active) return; this.active = true; this.transition(AUDIO_PIPELINE_STATE.REQUESTING_PERMISSION); this.publish(AUDIO_STATUS.INITIALIZING);
    this.unsubscribeHealth ??= this.audioService.subscribeHealth((event) => this.handleAudioHealth(event));
    this.unsubscribeVadStatus ??= this.vadService.subscribeStatus((event) => this.handleVadStatus(event));
    try { const session = await this.audioService.open(this.config); this.transition(AUDIO_PIPELINE_STATE.INITIALIZING_AUDIO_CONTEXT); this.attachTrack(session.stream.getAudioTracks()[0]); this.unsubscribe ??= this.vadService.subscribe((result) => this.handleResult(result)); this.transition(AUDIO_PIPELINE_STATE.INITIALIZING_VAD); await this.vadService.start(); this.transition(AUDIO_PIPELINE_STATE.READY); }
    catch (error) { this.lastError = error; const denied = error?.code === 'PERMISSION_DENIED'; this.transition(denied ? AUDIO_PIPELINE_STATE.PERMISSION_DENIED : AUDIO_PIPELINE_STATE.FAILED); this.publish(AUDIO_STATUS.UNAVAILABLE, 0, { error, message: error?.message }); }
  }
  handleResult(result) {
    if (!this.track || this.track.readyState === 'ended') { this.publish(AUDIO_STATUS.DISCONNECTED); return; }
    if (!this.track.enabled || this.track.muted) { this.publish(AUDIO_STATUS.MUTED); return; }
    this.samples.push(result); if (this.samples.length > this.config.probabilitySmoothingWindow) this.samples.shift();
    const average = (key) => this.samples.reduce((sum, sample) => sum + sample[key], 0) / this.samples.length;
    const speechProbability = average('speechProbability'); const noiseProbability = average('noiseProbability'); const confidence = average('confidence');
    const now = this.clock(); this.updateNoiseFloor(result, speechProbability); this.transientState = this.updateTransients(result, now);
    const classification = this.classify(result, { speechProbability, noiseProbability, confidence }, now); const next = classification.type;
    let previousEvent = null; if (next !== this.currentState) { previousEvent = this.activeAcousticEvent?.close(now) ?? null; this.currentState = next; this.stateSince = now; this.activeAcousticEvent = null; }
    const durationMs = Math.max(0, now - this.stateSince);
    const stability = classification.stability; const severity = states[next][1];
    this.activeAcousticEvent = new AcousticEvent({ type: next, confidence: classification.confidence, duration: durationMs, startTime: this.stateSince, severity, metadata: classification.metadata });
    const details = { audioHealth: audioHealthFor({ pipelineState: this.pipelineState, status: next, track: this.track }), audioActivity: next === AUDIO_STATUS.SILENCE ? 'SILENT' : 'ACTIVE', speechProbability, noiseProbability, confidence: classification.confidence, voiceDuration: this.observedSpeechSince ? now - this.observedSpeechSince : 0, noiseDuration: [AUDIO_STATUS.LOUD_BACKGROUND_NOISE, AUDIO_STATUS.MUSIC_ESTIMATED, AUDIO_STATUS.MEDIA_PLAYBACK_ESTIMATED].includes(next) ? durationMs : 0, conversationDuration: next === AUDIO_STATUS.CONTINUOUS_CONVERSATION ? durationMs : 0, musicLikelihood: classification.metadata.musicLikelihood, mediaLikelihood: classification.metadata.mediaLikelihood, typingLikelihood: classification.metadata.typingLikelihood, typingEvidenceDuration: this.transientState.durationMs, typingConfidence: classification.metadata.typingLikelihood, typingPersistent: this.transientState.persistent, transientDetected: this.transientState.detected, transientSuppressed: this.transientState.suppressed, noiseFloor: this.noiseFloor, ambientLevel: result.rms, vadState: next, acousticEvent: this.activeAcousticEvent, previousAcousticEvent: previousEvent, pipelineState: this.pipelineState, diagnostics: this.diagnostics(result), evidence: new DetectorEvidence({ detectorId: this.id, type: next, timestamp: result.timestamp, confidence: classification.confidence, stability, duration: durationMs, quality: Math.round(classification.confidence * 100), version: result.featureVersion, metadata: classification.metadata }) };
    this.publish(next, Math.round(confidence * 100), details);
  }
  updateNoiseFloor(result, speechProbability) { if (speechProbability >= this.config.speechConfidence || result.clippingRatio >= this.config.clippingRatio || result.rms > this.noiseFloor * this.config.loudNoiseMultiplier) return; const rate = this.noiseFloorSamples < this.config.adaptiveMinimumSamples ? 1 / (this.noiseFloorSamples + 1) : this.config.adaptiveLearningRate; this.noiseFloor += (result.rms - this.noiseFloor) * rate; this.noiseFloorSamples += 1; }
  emptyTransientState() { return { detected: false, suppressed: false, durationMs: 0, persistent: false, count: 0 }; }
  updateTransients(result, now) {
    const detected = result.crestFactor >= this.config.transientCrestFactor
      && result.zeroCrossingRate >= this.config.transientZeroCrossingRate
      && result.rms > this.noiseFloor * 1.5;
    if (detected) {
      const last = this.transients.at(-1);
      if (last != null && now - last > this.config.typingMaximumTransientGap) this.transients = [];
      this.transients.push(now);
    }
    this.transients = this.transients.filter((timestamp) => now - timestamp <= this.config.typingWindow);
    const durationMs = this.transients.length > 1 ? this.transients.at(-1) - this.transients[0] : 0;
    const persistent = this.transients.length >= this.config.typingMinimumTransients
      && durationMs >= this.config.typingPersistence
      && now - this.transients.at(-1) <= this.config.typingRecoveryMs;
    return { detected, suppressed: detected && !persistent && durationMs <= this.config.transientSuppressionMs, durationMs, persistent, count: this.transients.length };
  }
  classify(result, probabilities, now) {
    const smooth = (key) => this.samples.slice(-this.config.acousticSmoothingWindow).reduce((sum, sample) => sum + (sample[key] ?? 0), 0) / Math.min(this.samples.length, this.config.acousticSmoothingWindow);
    const speech = probabilities.speechProbability; const noise = probabilities.noiseProbability; const transientCountConfidence = Math.min(1, this.transientState.count / this.config.typingMinimumTransients); const persistenceConfidence = Math.min(1, this.transientState.durationMs / this.config.typingPersistence); const typingLikelihood = transientCountConfidence * persistenceConfidence;
    const tonalStability = Math.max(0, 1 - smooth('crestFactor') / this.config.transientCrestFactor); const musicLikelihood = Math.min(1, noise * 0.55 + tonalStability * 0.45); const mediaLikelihood = Math.min(1, speech * 0.45 + noise * 0.35 + tonalStability * 0.2);
    if (result.clippingRatio >= this.config.clippingRatio || result.peak >= this.config.saturatedLevel) return this.result(AUDIO_STATUS.SATURATED, Math.max(result.clippingRatio, result.peak), { typingLikelihood, musicLikelihood, mediaLikelihood, clippingRatio: result.clippingRatio });
    if (result.rms <= this.config.zeroInputLevel) this.zeroInputSince ??= now; else this.zeroInputSince = null;
    if (this.transientState.persistent && typingLikelihood >= this.config.typingConfidence) return this.result(AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, typingLikelihood, { typingLikelihood, musicLikelihood, mediaLikelihood, transientCount: this.transientState.count, typingEvidenceDuration: this.transientState.durationMs, transientSuppressed: false });
    if (musicLikelihood >= this.config.musicConfidence && now - (this.stateSince ?? now) >= this.config.mediaPersistence) return this.result(AUDIO_STATUS.MUSIC_ESTIMATED, musicLikelihood, { typingLikelihood, musicLikelihood, mediaLikelihood });
    if (mediaLikelihood >= this.config.mediaConfidence && noise >= this.config.noiseConfidence && now - (this.stateSince ?? now) >= this.config.mediaPersistence) return this.result(AUDIO_STATUS.MEDIA_PLAYBACK_ESTIMATED, mediaLikelihood, { typingLikelihood, musicLikelihood, mediaLikelihood });
    if (speech >= this.config.speechConfidence) { this.observedSpeechSince ??= now; this.lastSpeechAt = now; const speechDuration = now - this.observedSpeechSince; if (speechDuration < this.config.speechPersistence) return this.result(AUDIO_STATUS.SILENCE, 1 - speech, { typingLikelihood, musicLikelihood, mediaLikelihood, speechPending: true }); if (speechDuration >= this.config.conversationDuration) return this.result(AUDIO_STATUS.CONTINUOUS_CONVERSATION, speech, { typingLikelihood, musicLikelihood, mediaLikelihood, speechDuration }); if (result.rms <= this.config.remoteSpeechMaxLevel && speech >= this.config.otherSpeakerConfidence) return this.result(AUDIO_STATUS.OTHER_SPEAKER_ESTIMATED, speech * 0.8, { typingLikelihood, musicLikelihood, mediaLikelihood, attribution: 'estimated-remote', speechDuration }); return this.result(AUDIO_STATUS.CANDIDATE_SPEAKING, speech, { typingLikelihood, musicLikelihood, mediaLikelihood, speechDuration }); }
    if (this.observedSpeechSince && this.lastSpeechAt && now - this.lastSpeechAt < this.config.conversationRecoveryTimeout && result.rms < this.noiseFloor * this.config.loudNoiseMultiplier && noise < this.config.noiseConfidence && [AUDIO_STATUS.CANDIDATE_SPEAKING, AUDIO_STATUS.OTHER_SPEAKER_ESTIMATED, AUDIO_STATUS.CONTINUOUS_CONVERSATION].includes(this.currentState)) return this.result(this.currentState, Math.max(speech, 0.5), { typingLikelihood, musicLikelihood, mediaLikelihood, recoveringSpeech: true });
    this.observedSpeechSince = null; this.lastSpeechAt = null;
    if (result.rms >= this.noiseFloor * this.config.loudNoiseMultiplier && noise >= this.config.noiseConfidence) return this.result(AUDIO_STATUS.LOUD_BACKGROUND_NOISE, noise, { typingLikelihood, musicLikelihood, mediaLikelihood });
    if (result.rms > this.noiseFloor * 2 && probabilities.confidence < this.config.unknownConfidence) return this.result(AUDIO_STATUS.UNKNOWN_AUDIO, 1 - probabilities.confidence, { typingLikelihood, musicLikelihood, mediaLikelihood });
    return this.result(AUDIO_STATUS.SILENCE, Math.max(0, 1 - speech - noise), { typingLikelihood, musicLikelihood, mediaLikelihood });
  }
  result(type, confidence, metadata) { const relevant = this.samples.slice(-this.config.acousticSmoothingWindow); const stability = relevant.filter((sample) => type === AUDIO_STATUS.SILENCE ? sample.speechProbability < this.config.speechConfidence : true).length / Math.max(1, relevant.length); return { type, confidence: Math.max(0, Math.min(1, confidence)), stability, metadata: { ...metadata, rms: relevant.at(-1)?.rms, noiseFloor: this.noiseFloor } }; }
  handleAudioHealth(event) { if (event.type === 'REQUESTING_PERMISSION') this.transition(AUDIO_PIPELINE_STATE.REQUESTING_PERMISSION); if (event.type === 'INITIALIZING_AUDIO_CONTEXT') this.transition(AUDIO_PIPELINE_STATE.INITIALIZING_AUDIO_CONTEXT); if (event.type === 'PERMISSION_DENIED') { this.transition(AUDIO_PIPELINE_STATE.PERMISSION_DENIED); this.publish(AUDIO_STATUS.UNAVAILABLE, 0, { message: event.error?.message, audioHealth: AUDIO_HEALTH.PERMISSION_DENIED }); } if (event.type === 'RECOVERING') this.transition(AUDIO_PIPELINE_STATE.RECOVERING); if (event.type === 'RECOVERED') { this.attachTrack(event.session.stream.getAudioTracks()[0]); this.transition(this.vadService.runtimeState === VAD_RUNTIME_STATE.READY ? AUDIO_PIPELINE_STATE.READY : AUDIO_PIPELINE_STATE.INITIALIZING_VAD); } if (event.type === 'FAILED') { this.lastError = event.error; this.transition(AUDIO_PIPELINE_STATE.FAILED); this.publish(AUDIO_STATUS.UNAVAILABLE, 0, { error: event.error, message: event.error?.message, audioHealth: AUDIO_HEALTH.FAILED }); } }
  handleVadStatus(event) { if (event.state === VAD_RUNTIME_STATE.INITIALIZING) this.transition(AUDIO_PIPELINE_STATE.INITIALIZING_VAD); if (event.state === VAD_RUNTIME_STATE.RECOVERING) this.transition(AUDIO_PIPELINE_STATE.RECOVERING); if (event.state === VAD_RUNTIME_STATE.READY) this.transition(AUDIO_PIPELINE_STATE.READY); if (event.state === VAD_RUNTIME_STATE.FAILED) { this.lastError = event.error; this.transition(AUDIO_PIPELINE_STATE.FAILED); this.publish(AUDIO_STATUS.UNAVAILABLE, 0, { error: event.error, message: event.error?.message }); } }
  transition(next) { if (this.pipelineState === next) return; this.pipelineState = next; this.publish(this.status.status, this.status.quality, { ...this.status.details, pipelineState: next, diagnostics: this.diagnostics() }); }
  diagnostics(result) { return import.meta.env?.DEV ? Object.freeze({ ...this.audioService.getDiagnostics(), ...this.vadService.getDiagnostics(), lastSpeechProbability: result?.speechProbability ?? this.status.details?.speechProbability ?? null, pipelineState: this.pipelineState, error: this.lastError, calibration: Object.freeze({ speechConfidence: this.config.speechConfidence, musicConfidence: this.config.musicConfidence, typingConfidence: this.config.typingConfidence }) }) : undefined; }
  updateCalibration(partial) { if (!import.meta.env?.DEV) return; ['speechConfidence', 'musicConfidence', 'typingConfidence'].forEach((key) => { if (Number.isFinite(partial[key])) this.config[key] = Math.max(0, Math.min(1, partial[key])); }); }
  stop() { this.active = false; this.unsubscribe?.(); this.unsubscribe = null; this.unsubscribeHealth?.(); this.unsubscribeHealth = null; this.unsubscribeVadStatus?.(); this.unsubscribeVadStatus = null; this.vadService.stop(); this.detachTrack(); this.audioService.stop(); this.pipelineState = AUDIO_PIPELINE_STATE.UNINITIALIZED; }
  pause() { this.active = false; this.unsubscribe?.(); this.unsubscribe = null; this.vadService.pause(); }
  async resume() { return this.start(); }
  reset() { this.stop(); this.samples = []; this.currentState = null; this.stateSince = null; this.observedSpeechSince = null; this.lastSpeechAt = null; this.zeroInputSince = null; this.transients = []; this.transientState = this.emptyTransientState(); this.noiseFloor = this.config.initialNoiseFloor; this.noiseFloorSamples = 0; this.activeAcousticEvent = null; this.lastError = null; this.vadService.reset(); this.publish(AUDIO_STATUS.INITIALIZING); }
  destroy() { this.stop(); this.vadService.destroy(); this.audioService.destroy(); }
  getStatus() { return this.status; }
  attachTrack(track) { this.detachTrack(); this.track = track; if (!track) return; this.trackHandlers = { ended: () => this.publish(AUDIO_STATUS.DISCONNECTED), mute: () => this.publish(AUDIO_STATUS.MUTED), unmute: () => this.publish(AUDIO_STATUS.SILENCE) }; Object.entries(this.trackHandlers).forEach(([type, handler]) => track.addEventListener(type, handler)); }
  detachTrack() { if (this.track && this.trackHandlers) Object.entries(this.trackHandlers).forEach(([type, handler]) => this.track.removeEventListener(type, handler)); this.track = null; this.trackHandlers = null; }
  publish(status, quality, details = {}) { const audioHealth = details.audioHealth ?? audioHealthFor({ pipelineState: this.pipelineState, status, track: this.track }); const healthy = audioHealth === AUDIO_HEALTH.READY; this.status = createAudioStatus(status, healthy ? 100 : quality, { pipelineState: this.pipelineState, audioHealth, audioActivity: status === AUDIO_STATUS.SILENCE ? 'SILENT' : 'ACTIVE', ...details }); const high = [AUDIO_STATUS.CONTINUOUS_CONVERSATION, AUDIO_STATUS.SATURATED]; const warning = [AUDIO_STATUS.CANDIDATE_SPEAKING, AUDIO_STATUS.OTHER_SPEAKER_ESTIMATED, AUDIO_STATUS.MUSIC_ESTIMATED, AUDIO_STATUS.MEDIA_PLAYBACK_ESTIMATED, AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, AUDIO_STATUS.LOUD_BACKGROUND_NOISE]; this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: high.includes(status) ? EXAM_SEVERITIES.HIGH : warning.includes(status) ? EXAM_SEVERITIES.MEDIUM : status === AUDIO_STATUS.SILENCE ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW, metadata: { channel: 'vision', detector: this.id, status: this.status } })); }
}
