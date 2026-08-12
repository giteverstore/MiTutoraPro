import { CERTIFICATION_POLICY } from './CertificationPolicy.js';

export const DECISION = Object.freeze({ CERTIFIED: 'CERTIFIED', NOT_CERTIFIED: 'NOT_CERTIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', INCOMPLETE: 'INCOMPLETE' });

export const DEFAULT_CERTIFICATION_POLICY = CERTIFICATION_POLICY;

export class CertificationEngine {
  constructor(policy = DEFAULT_CERTIFICATION_POLICY) { this.policy = policy; }

  evaluate({ eligible, attemptState, examResult, integrityResult, decidedAt }) {
    const reasons = [];
    let status;
    if (!eligible || ['CANCELLED', 'EXPIRED', 'ABANDONED'].includes(attemptState)) {
      status = DECISION.INCOMPLETE;
      reasons.push(!eligible ? 'NOT_ELIGIBLE' : `ATTEMPT_${attemptState}`);
    } else if (!examResult?.passed) {
      status = DECISION.NOT_CERTIFIED;
      reasons.push('EXAM_SCORE_BELOW_PASSING_THRESHOLD');
    } else if (integrityResult.flags.length || integrityResult.score < this.policy.minimumIntegrityScore) {
      status = DECISION.REVIEW_REQUIRED;
      reasons.push(...integrityResult.flags, 'INTEGRITY_REVIEW_REQUIRED');
    } else {
      status = DECISION.CERTIFIED;
      reasons.push('ALL_CERTIFICATION_REQUIREMENTS_MET');
    }
    const explanation = Object.freeze({
      headline: { CERTIFIED: 'Certification requirements satisfied.', NOT_CERTIFIED: 'The exam passing requirement was not met.', REVIEW_REQUIRED: 'The attempt requires an additional integrity review.', INCOMPLETE: 'The attempt did not reach a valid certification outcome.' }[status],
      courseRequirementsCompleted: Boolean(eligible),
      examScore: examResult?.score ?? null,
      passingScore: examResult?.passingScore ?? null,
      integrityStatus: integrityResult?.overallStatus ?? (integrityResult?.flags?.length ? 'REVIEW_REQUIRED' : 'CLEAN'),
      statements: Object.freeze(status === DECISION.CERTIFIED
        ? ['Course requirements completed.', `Exam score met the ${examResult.passingScore}% passing requirement.`, 'No review-required integrity concerns were recorded.']
        : status === DECISION.NOT_CERTIFIED
          ? [`Exam score was ${examResult?.score ?? 0}%; the passing requirement is ${examResult?.passingScore ?? 0}%.`]
          : status === DECISION.REVIEW_REQUIRED
            ? ['The exam requirement was met.', 'The integrity summary requires additional review before a final certification can be confirmed.']
            : ['The attempt did not reach a valid final submission.']),
    });
    return Object.freeze({ schemaVersion: '1.0.0', policyVersion: this.policy.version, status, reasons: Object.freeze([...new Set(reasons)]), explanation, decidedAt });
  }
}
