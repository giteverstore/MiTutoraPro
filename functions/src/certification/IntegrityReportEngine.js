import { createHash } from 'node:crypto';
import { DEFAULT_INTEGRITY_POLICY } from './IntegrityEvaluationEngine.js';

export const INTEGRITY_REPORT_STATUS = Object.freeze({ CLEAN: 'CLEAN', MINOR_CONCERNS: 'MINOR_CONCERNS', SIGNIFICANT_CONCERNS: 'SIGNIFICANT_CONCERNS', REVIEW_REQUIRED: 'REVIEW_REQUIRED' });

function publicLabel(type) {
  const labels = { WINDOW_BLUR: 'Browser focus', TAB_SWITCH: 'Browser focus', FULLSCREEN_EXIT: 'Fullscreen', FACE_LOST: 'Face presence', MULTIPLE_FACES: 'Face presence', CAMERA_DISCONNECTED: 'Camera connection', LOOKING_AWAY: 'Attention', HEAD_POSE: 'Attention', PHONE_DETECTED: 'Prohibited object', PROHIBITED_OBJECT: 'Prohibited object', VOICE_ACTIVITY: 'Audio activity', MICROPHONE_UNAVAILABLE: 'Microphone connection' };
  return labels[type] ?? 'Exam environment';
}

export class IntegrityReportEngine {
  constructor(policy = DEFAULT_INTEGRITY_POLICY) { this.policy = policy; }
  create({ attempt, events, integrityResult, certificationPolicyVersion = attempt.configVersions.certification, createdAt }) {
    const groups = new Map();
    const orderedEvents = [...events].sort((left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id));
    for (const event of orderedEvents) {
      const key = publicLabel(event.type);
      const current = groups.get(key) ?? { category: key, occurrences: 0, totalDurationMs: 0, maximumDurationMs: 0, severity: 'info' };
      const duration = Math.max(0, Number(event.durationMs) || 0);
      current.occurrences += 1; current.totalDurationMs += duration; current.maximumDurationMs = Math.max(current.maximumDurationMs, duration);
      if (['high', 'critical'].includes(event.severity)) current.severity = 'violation'; else if (current.severity !== 'violation') current.severity = 'warning';
      groups.set(key, current);
    }
    const detectorVersions = Object.fromEntries(events.filter(({ detectorId }) => detectorId).map((event) => [event.detectorId, event.detectorVersion || 'unspecified']));
    const modelVersions = [...new Set(events.map(({ modelVersion }) => modelVersion).filter(Boolean))];
    const totalViolationDurationMs = [...groups.values()].reduce((sum, item) => sum + item.totalDurationMs, 0);
    let overallStatus = INTEGRITY_REPORT_STATUS.CLEAN;
    if (integrityResult.flags.length) overallStatus = INTEGRITY_REPORT_STATUS.REVIEW_REQUIRED;
    else if (integrityResult.score < this.policy.significantConcernScoreBelow) overallStatus = INTEGRITY_REPORT_STATUS.SIGNIFICANT_CONCERNS;
    else if (integrityResult.score < this.policy.minorConcernScoreBelow || events.length) overallStatus = INTEGRITY_REPORT_STATUS.MINOR_CONCERNS;
    return Object.freeze({
      reportId: `integrity-${attempt.id}`, attemptId: attempt.id, ownerUid: attempt.ownerUid,
      integrityScore: integrityResult.score, overallStatus,
      warnings: integrityResult.warningCount, violations: Object.freeze([...groups.values()]),
      totalViolationDurationMs, monitoringDurationMs: integrityResult.monitoringDurationMs,
      detectorSummary: Object.freeze([...groups.values()].map(({ category, occurrences, totalDurationMs, severity }) => ({ category, occurrences, totalDurationMs, severity }))),
      timelineSummary: Object.freeze({ eventCount: events.length, firstEventAt: events.length ? Math.min(...events.map(({ startedAt }) => startedAt)) : null, lastEventAt: events.length ? Math.max(...events.map(({ endedAt, startedAt }) => endedAt ?? startedAt)) : null }),
      policyVersion: integrityResult.policyVersion, detectorVersions: Object.freeze(detectorVersions), modelVersions: Object.freeze(modelVersions),
      contentHash: createHash('sha256').update(JSON.stringify(orderedEvents.map(({ id, type, status, startedAt, endedAt, durationMs }) => ({ id, type, status, startedAt, endedAt, durationMs })))).digest('hex'),
      examVersion: attempt.examVersion, certificationPolicyVersion,
      createdAt, schemaVersion: '1.0.0',
    });
  }
}
