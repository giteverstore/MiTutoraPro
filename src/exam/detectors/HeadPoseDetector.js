import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorEvidence } from '../models/DetectorEvidence.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const HEAD_POSE_STATUS = Object.freeze({ UNKNOWN: 'UNKNOWN', CENTERED: 'CENTERED', LEFT: 'LOOKING_LEFT', RIGHT: 'LOOKING_RIGHT', UP: 'LOOKING_UP', DOWN: 'LOOKING_DOWN', TILTED: 'HEAD_TILTED' });
export class HeadPoseDetector {
  constructor({ eventBus, inferenceService, config }) { this.id = 'headPose'; this.eventBus = eventBus; this.inferenceService = inferenceService; this.config = config; this.unsubscribe = null; this.status = this.createStatus(HEAD_POSE_STATUS.UNKNOWN); }
  start() { if (!this.unsubscribe) this.unsubscribe = this.inferenceService.subscribe((result) => this.handleResult(result)); }
  stop() { this.unsubscribe?.(); this.unsubscribe = null; }
  pause() { this.stop(); } resume() { this.start(); }
  reset() { this.publish(HEAD_POSE_STATUS.UNKNOWN); }
  destroy() { this.stop(); this.reset(); }
  getStatus() { return this.status; }
  classify(pose) {
    if (!pose) return HEAD_POSE_STATUS.UNKNOWN;
    if (Math.abs(pose.roll) >= this.config.rollThresholdDegrees) return HEAD_POSE_STATUS.TILTED;
    if (pose.yaw <= -this.config.yawThresholdDegrees) return HEAD_POSE_STATUS.LEFT;
    if (pose.yaw >= this.config.yawThresholdDegrees) return HEAD_POSE_STATUS.RIGHT;
    if (pose.pitch <= -this.config.pitchThresholdDegrees) return HEAD_POSE_STATUS.UP;
    if (pose.pitch >= this.config.pitchThresholdDegrees) return HEAD_POSE_STATUS.DOWN;
    return HEAD_POSE_STATUS.CENTERED;
  }
  handleResult(result) { const status = this.classify(result.headPose); const pose = result.headPose ?? {}; this.publish(status, new DetectorEvidence({ detectorId: this.id, capturedAt: result.timestamp, measurements: pose })); }
  createStatus(status, evidence) { const centered = status === HEAD_POSE_STATUS.CENTERED; return new DetectorStatus({ status, message: centered ? 'Head position is centered.' : status === HEAD_POSE_STATUS.UNKNOWN ? 'Head pose is unavailable.' : 'Head position is outside the configured range.', severity: centered ? DETECTOR_SEVERITY.SUCCESS : status === HEAD_POSE_STATUS.UNKNOWN ? DETECTOR_SEVERITY.PENDING : DETECTOR_SEVERITY.WARNING, quality: centered ? 100 : 0, details: { evidence } }); }
  publish(status, evidence) { if (this.status.status === status && evidence) return; this.status = this.createStatus(status, evidence); this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: status === HEAD_POSE_STATUS.CENTERED ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW, metadata: { channel: 'vision', detector: this.id, status: this.status } })); }
}

