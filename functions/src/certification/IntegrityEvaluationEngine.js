export const DEFAULT_INTEGRITY_POLICY = Object.freeze({
  version: '1.0.0',
  initialScore: 100,
  reviewScoreBelow: 70,
  reviewCriticalViolations: 1,
  minorConcernScoreBelow: 95,
  significantConcernScoreBelow: 85,
  penalties: Object.freeze({
    TAB_SWITCH: 12,
    WINDOW_BLUR: 8,
    FULLSCREEN_EXIT: 15,
    COPY: 5,
    PASTE: 5,
    RIGHT_CLICK: 3,
    FACE_LOST: 15,
    MULTIPLE_FACES: 25,
    CAMERA_DISCONNECTED: 15,
    HEAD_POSE: 8,
    LOOKING_AWAY: 8,
    PHONE_DETECTED: 35,
    VOICE_ACTIVITY: 12,
    PROHIBITED_OBJECT: 25,
    MICROPHONE_UNAVAILABLE: 10,
  }),
  criticalTypes: Object.freeze(['MULTIPLE_FACES', 'PHONE_DETECTED', 'PROHIBITED_OBJECT']),
});

export class IntegrityEvaluationEngine {
  constructor(policy = DEFAULT_INTEGRITY_POLICY) { this.policy = policy; }

  evaluate(events = [], monitoringDurationMs = 0) {
    const deductions = events.map((event) => {
      const amount = this.policy.penalties[event.type] ?? 0;
      return Object.freeze({ eventId: event.id, type: event.type, amount, ruleVersion: this.policy.version });
    }).filter(({ amount }) => amount > 0);
    const totalDeduction = deductions.reduce((sum, item) => sum + item.amount, 0);
    const criticalViolationCount = events.filter((event) => this.policy.criticalTypes.includes(event.type)).length;
    const score = Math.max(0, this.policy.initialScore - totalDeduction);
    const flags = [];
    if (score < this.policy.reviewScoreBelow) flags.push('INTEGRITY_SCORE_BELOW_REVIEW_THRESHOLD');
    if (criticalViolationCount >= this.policy.reviewCriticalViolations) flags.push('CRITICAL_VIOLATION');
    return Object.freeze({
      schemaVersion: '1.0.0',
      policyVersion: this.policy.version,
      score,
      warningCount: deductions.length,
      violationCount: events.length,
      criticalViolationCount,
      deductions: Object.freeze(deductions),
      flags: Object.freeze(flags),
      monitoringDurationMs: Math.max(0, monitoringDurationMs),
    });
  }
}
