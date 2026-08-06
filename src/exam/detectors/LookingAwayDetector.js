import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorEvidence } from '../models/DetectorEvidence.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const LOOKING_AWAY_STATUS = Object.freeze({ UNKNOWN: 'UNKNOWN', ATTENTIVE: 'ATTENTIVE', LOOKING_AWAY: 'LOOKING_AWAY' });
export class LookingAwayDetector {
  constructor({ eventBus, inferenceService, headPoseDetector, config, clock = () => Date.now() }) { this.id = 'lookingAway'; this.eventBus = eventBus; this.inferenceService = inferenceService; this.headPoseDetector = headPoseDetector; this.config = config; this.clock = clock; this.unsubscribe = null; this.violationSince = null; this.recoverySince = null; this.status = this.createStatus(LOOKING_AWAY_STATUS.UNKNOWN); }
  start() { if (!this.unsubscribe) this.unsubscribe = this.inferenceService.subscribe((result) => this.handleResult(result)); }
  stop() { this.unsubscribe?.(); this.unsubscribe = null; }
  pause() { this.stop(); } resume() { this.start(); }
  reset() { this.violationSince = null; this.recoverySince = null; this.publish(LOOKING_AWAY_STATUS.UNKNOWN); }
  destroy() { this.stop(); this.reset(); }
  getStatus() { return this.status; }
  handleResult(result) {
    const poseStatus = this.headPoseDetector.classify(result.headPose);
    const centered = poseStatus === 'CENTERED'; const now = this.clock();
    if (!centered && poseStatus !== 'UNKNOWN') { this.recoverySince = null; this.violationSince ??= now; if (now - this.violationSince >= this.config.gracePeriodMs) this.publish(LOOKING_AWAY_STATUS.LOOKING_AWAY, this.evidence(result, now - this.violationSince, poseStatus)); }
    else if (centered) { this.violationSince = null; this.recoverySince ??= now; if (now - this.recoverySince >= this.config.recoveryPersistenceMs || this.status.status === LOOKING_AWAY_STATUS.UNKNOWN) this.publish(LOOKING_AWAY_STATUS.ATTENTIVE, this.evidence(result, now - this.recoverySince, poseStatus)); }
  }
  evidence(result, durationMs, poseStatus) { return new DetectorEvidence({ detectorId: this.id, capturedAt: result.timestamp, durationMs, measurements: { ...result.headPose, poseStatus } }); }
  createStatus(status, evidence) { const okay = status === LOOKING_AWAY_STATUS.ATTENTIVE; return new DetectorStatus({ status, message: okay ? 'Attention is directed toward the screen.' : status === LOOKING_AWAY_STATUS.UNKNOWN ? 'Attention state is unavailable.' : 'Looking away persisted beyond the grace period.', severity: okay ? DETECTOR_SEVERITY.SUCCESS : status === LOOKING_AWAY_STATUS.UNKNOWN ? DETECTOR_SEVERITY.PENDING : DETECTOR_SEVERITY.WARNING, quality: okay ? 100 : 0, details: { evidence } }); }
  publish(status, evidence) { if (this.status.status === status && evidence) return; this.status = this.createStatus(status, evidence); this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: status === LOOKING_AWAY_STATUS.LOOKING_AWAY ? EXAM_SEVERITIES.MEDIUM : EXAM_SEVERITIES.INFO, metadata: { channel: 'vision', detector: this.id, status: this.status } })); }
}

