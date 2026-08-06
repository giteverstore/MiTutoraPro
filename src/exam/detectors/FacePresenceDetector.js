import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorEvidence } from '../models/DetectorEvidence.js';
import { createFaceStatus, FACE_STATUS } from './FaceDetector.js';

export class FacePresenceDetector {
  constructor({ eventBus, inferenceService, config, clock = () => Date.now() }) {
    this.id = 'face'; this.eventBus = eventBus; this.inferenceService = inferenceService; this.config = config; this.clock = clock;
    this.status = createFaceStatus(FACE_STATUS.INITIALIZING); this.unsubscribe = null; this.candidate = null; this.candidateSince = null; this.samples = [];
  }
  start() { if (!this.unsubscribe) this.unsubscribe = this.inferenceService.subscribe((result) => this.handleResult(result)); }
  stop() { this.unsubscribe?.(); this.unsubscribe = null; }
  pause() { this.stop(); }
  resume() { this.start(); }
  reset() { this.candidate = null; this.candidateSince = null; this.samples = []; this.publish(FACE_STATUS.INITIALIZING); }
  destroy() { this.stop(); this.reset(); }
  getStatus() { return this.status; }
  handleResult(result) {
    const next = result.faceCount === 0 ? FACE_STATUS.NO_FACE : result.faceCount === 1 ? FACE_STATUS.ONE_FACE : FACE_STATUS.MULTIPLE_FACES;
    const now = this.clock();
    if (next !== this.candidate) { this.candidate = next; this.candidateSince = now; }
    const required = next === FACE_STATUS.ONE_FACE ? this.config.recoveryPersistenceMs : this.config.violationPersistenceMs;
    if (now - this.candidateSince < required && this.status.status !== FACE_STATUS.INITIALIZING) return;
    this.samples.push(next === FACE_STATUS.ONE_FACE ? 1 : 0);
    if (this.samples.length > this.config.stabilitySampleCount) this.samples.shift();
    const quality = (this.samples.reduce((sum, value) => sum + value, 0) / this.config.stabilitySampleCount) * 100;
    this.publish(next, quality, new DetectorEvidence({ detectorId: this.id, capturedAt: result.timestamp, durationMs: now - this.candidateSince, measurements: { faceCount: result.faceCount } }));
  }
  publish(status, quality, evidence) {
    if (this.status.status === status && evidence) return;
    const base = createFaceStatus(status, quality);
    this.status = Object.freeze({ ...base, details: Object.freeze({ ...base.details, evidence }) });
    this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: status === FACE_STATUS.ONE_FACE ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW, metadata: { channel: 'vision', detector: this.id, status: this.status } }));
  }
}

