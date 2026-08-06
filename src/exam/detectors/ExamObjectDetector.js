import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorEvidence } from '../models/DetectorEvidence.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const OBJECT_STATUS = Object.freeze({ INITIALIZING: 'INITIALIZING', CLEAR: 'CLEAR', OBJECT_DETECTED: 'OBJECT_DETECTED' });
export class ExamObjectDetector {
  constructor({ eventBus, inferenceService, config, clock = () => Date.now() }) { this.id = 'objects'; this.eventBus = eventBus; this.inferenceService = inferenceService; this.config = config; this.clock = clock; this.unsubscribe = null; this.tracks = new Map(); this.status = this.createStatus(OBJECT_STATUS.INITIALIZING); }
  start() { if (!this.unsubscribe) this.unsubscribe = this.inferenceService.subscribe((result) => this.handleResult(result)); }
  stop() { this.unsubscribe?.(); this.unsubscribe = null; } pause() { this.stop(); } resume() { this.start(); }
  reset() { this.tracks.clear(); this.publish(OBJECT_STATUS.INITIALIZING); } destroy() { this.stop(); this.reset(); } getStatus() { return this.status; }
  handleResult(result) {
    const now = this.clock(); const matches = [];
    for (const detection of result.detections) for (const category of detection.categories ?? []) for (const [type, names] of Object.entries(this.config.supportedCategories)) if (names.includes(category.categoryName?.toLowerCase()) && category.score >= this.config.minimumConfidence) matches.push({ type, category, detection });
    const present = new Set(matches.map(({ type }) => type));
    for (const [type, track] of this.tracks) if (!present.has(type)) { track.lostFrames += 1; if (track.lostFrames > this.config.maximumLostFrames) this.tracks.delete(type); }
    for (const match of matches) { const track = this.tracks.get(match.type) ?? { startedAt: now, samples: 0, lostFrames: 0 }; track.samples += 1; track.lostFrames = 0; track.match = match; this.tracks.set(match.type, track); }
    const persistent = [...this.tracks.entries()].filter(([, track]) => now - track.startedAt >= this.config.minimumPersistence && track.samples / this.config.detectionWindow >= 0.5);
    if (!persistent.length) { this.publish(OBJECT_STATUS.CLEAR); return; }
    const [type, track] = persistent.sort((a, b) => b[1].match.category.score - a[1].match.category.score)[0]; const duration = now - track.startedAt; const stability = Math.min(1, track.samples / this.config.detectionWindow);
    const evidence = new DetectorEvidence({ detectorId: this.id, type: 'exam-object', timestamp: result.timestamp, confidence: track.match.category.score, stability, duration, quality: Math.round(track.match.category.score * stability * 100), version: this.config.modelVersion, labels: [type, track.match.category.categoryName], metadata: { boundingBox: track.match.detection.boundingBox, inferenceFps: result.inferenceFps } });
    this.publish(OBJECT_STATUS.OBJECT_DETECTED, evidence);
  }
  createStatus(status, evidence) { const clear = status === OBJECT_STATUS.CLEAR; return new DetectorStatus({ status, message: clear ? 'No supported exam objects detected.' : status === OBJECT_STATUS.INITIALIZING ? 'Exam object detection is initializing.' : `${evidence.labels[0]} detected persistently.`, severity: clear ? DETECTOR_SEVERITY.SUCCESS : status === OBJECT_STATUS.INITIALIZING ? DETECTOR_SEVERITY.PENDING : DETECTOR_SEVERITY.ERROR, quality: clear ? 100 : evidence?.quality ?? 0, details: { evidence, supportedCategories: Object.keys(this.config.supportedCategories), unsupportedCategories: this.config.unsupportedCategories } }); }
  publish(status, evidence) { if (this.status.status === status && status === OBJECT_STATUS.CLEAR) return; this.status = this.createStatus(status, evidence); this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: status === OBJECT_STATUS.OBJECT_DETECTED ? EXAM_SEVERITIES.HIGH : EXAM_SEVERITIES.INFO, metadata: { channel: 'vision', detector: this.id, status: this.status } })); }
}
