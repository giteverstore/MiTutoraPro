import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorEvidence } from '../models/DetectorEvidence.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const PHONE_STATUS = Object.freeze({ UNKNOWN: 'UNKNOWN', CLEAR: 'CLEAR', PHONE_DETECTED: 'PHONE_DETECTED' });
export class PhoneDetector {
  constructor({ eventBus, inferenceService, config, clock = () => Date.now() }) { this.id = 'phone'; this.eventBus = eventBus; this.inferenceService = inferenceService; this.config = config; this.clock = clock; this.unsubscribe = null; this.detectedSince = null; this.clearSince = null; this.status = this.createStatus(PHONE_STATUS.UNKNOWN); this.window = []; this.smoothedConfidence = 0; this.lostFrames = 0; }
  start() { if (!this.unsubscribe) this.unsubscribe = this.inferenceService.subscribe((result) => this.handleResult(result)); }
  stop() { this.unsubscribe?.(); this.unsubscribe = null; }
  pause() { this.stop(); } resume() { this.start(); }
  reset() { this.detectedSince = null; this.clearSince = null; this.window = []; this.smoothedConfidence = 0; this.lostFrames = 0; this.publish(PHONE_STATUS.UNKNOWN); }
  destroy() { this.stop(); this.reset(); }
  getStatus() { return this.status; }
  handleResult(result) {
    const candidates = result.detections.flatMap((detection) => (detection.categories ?? []).map((category) => ({ category, detection })));
    const match = candidates.sort((a, b) => b.category.score - a.category.score).find(({ category, detection }) => this.config.categoryNames.includes(category.categoryName?.toLowerCase()) && this.qualifies(category, detection));
    this.window.push(Boolean(match)); if (this.window.length > this.config.detectionWindow) this.window.shift();
    if (match) { this.lostFrames = 0; this.smoothedConfidence = this.smoothedConfidence ? this.smoothedConfidence * (1 - this.config.confidenceSmoothing) + match.category.score * this.config.confidenceSmoothing : match.category.score; }
    else this.lostFrames += 1;
    const stable = this.window.filter(Boolean).length / this.window.length;
    const retained = !match && this.lostFrames <= this.config.maximumLostFrames && this.status.status === PHONE_STATUS.PHONE_DETECTED;
    const now = this.clock();
    if (match || retained) { this.clearSince = null; this.detectedSince ??= now; if (now - this.detectedSince >= this.config.minimumPersistence) this.publish(PHONE_STATUS.PHONE_DETECTED, this.evidence(result, match, now - this.detectedSince, stable)); }
    else { this.detectedSince = null; this.clearSince ??= now; if (now - this.clearSince >= this.config.recoveryPersistenceMs || this.status.status === PHONE_STATUS.UNKNOWN) this.publish(PHONE_STATUS.CLEAR, this.evidence(result, null, now - this.clearSince, stable)); }
  }
  qualifies(category, detection) { const box = detection.boundingBox; const frameArea = Math.max(1, (detection.frameWidth ?? 1) * (detection.frameHeight ?? 1)); const visibleArea = box ? box.width * box.height / frameArea : 1; const distanceRatio = Math.max(0, 1 - visibleArea / this.config.minimumVisibleArea); const adjustedConfidence = this.config.minimumConfidence - distanceRatio * this.config.cameraDistanceCompensation * 0.1; const adjustedArea = this.config.minimumVisibleArea * (1 - this.config.cameraDistanceCompensation); return visibleArea >= adjustedArea && category.score >= adjustedConfidence; }
  evidence(result, match, duration, stability) { const box = match?.detection.boundingBox ?? null; return new DetectorEvidence({ detectorId: this.id, type: 'prohibited-object', timestamp: result.timestamp, confidence: this.smoothedConfidence, stability, duration, quality: Math.round(this.smoothedConfidence * stability * 100), version: this.config.modelVersion, labels: match ? [match.category.categoryName] : [], metadata: { boundingBox: box, lostFrames: this.lostFrames, detectionWindow: this.window.length, inferenceFps: result.inferenceFps } }); }
  createStatus(status, evidence) { const clear = status === PHONE_STATUS.CLEAR; return new DetectorStatus({ status, message: clear ? 'No phone detected.' : status === PHONE_STATUS.UNKNOWN ? 'Phone detection is initializing.' : 'A persistent phone detection is active.', severity: clear ? DETECTOR_SEVERITY.SUCCESS : status === PHONE_STATUS.UNKNOWN ? DETECTOR_SEVERITY.PENDING : DETECTOR_SEVERITY.ERROR, quality: clear ? 100 : evidence?.quality ?? 0, details: { confidence: evidence?.confidence ?? 0, stability: evidence?.stability ?? 0, duration: evidence?.duration ?? 0, evidence } }); }
  publish(status, evidence) { if (this.status.status === status && evidence && status === PHONE_STATUS.CLEAR) return; this.status = this.createStatus(status, evidence); this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: status === PHONE_STATUS.PHONE_DETECTED ? EXAM_SEVERITIES.HIGH : EXAM_SEVERITIES.INFO, metadata: { channel: 'vision', detector: this.id, status: this.status } })); }
}
