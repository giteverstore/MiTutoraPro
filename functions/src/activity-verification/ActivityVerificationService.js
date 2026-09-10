import {
  REWARD_AVAILABILITY,
  VERIFICATION_OUTCOMES,
  assertSandbox,
  authenticatedPrincipal,
  evidenceReference,
  normalizeVerificationRequest,
  validateResolvedActivity,
  verificationLimits,
} from './ActivityVerificationModels.js';
import { failVerification } from './ActivityVerificationError.js';

export class ActivityVerificationService {
  constructor({ resolver, verifiers, completionRecorder, limits }) {
    if (!resolver?.resolve) throw new TypeError('ActivityVerificationService requires an authoritative resolver.');
    if (!completionRecorder?.recordVerifiedCompletion) throw new TypeError('ActivityVerificationService requires a trusted completion recorder.');
    this.resolver = resolver;
    this.verifiers = new Map(Object.entries(verifiers ?? {}));
    this.completionRecorder = completionRecorder;
    this.limits = verificationLimits(limits);
  }

  async verify({ principal, body }) {
    const identity = authenticatedPrincipal(principal);
    const request = normalizeVerificationRequest(body, this.limits);
    const verifier = this.verifiers.get(request.activityType);
    if (!verifier) failVerification('activity-verification/verifier-unavailable', 'No verifier is configured for this activity.', { status: 503 });
    assertSandbox(verifier.executor, this.limits);
    const activity = validateResolvedActivity(await this.resolver.resolve(request), request, this.limits);
    const result = await verifier.verify({ request, activity, limits: this.limits });
    if (!result.passed) {
      return Object.freeze({
        status: VERIFICATION_OUTCOMES.REJECTED,
        verified: false,
        rewardStatus: REWARD_AVAILABILITY.UNAVAILABLE,
      });
    }
    const completion = await this.completionRecorder.recordVerifiedCompletion({
      principal: identity,
      activity: Object.freeze({
        activityType: activity.activityType,
        activityId: activity.id,
        contentVersion: activity.version,
        contentHash: activity.contentHash,
        language: String(activity.language).toLowerCase(),
      }),
      evidence: Object.freeze({
        reference: evidenceReference(identity.uid, activity),
        assurance: 'SERVER_VALIDATED_EXECUTION',
      }),
    });
    return Object.freeze({
      status: VERIFICATION_OUTCOMES.VERIFIED,
      verified: true,
      duplicate: completion?.duplicate === true,
      rewardStatus: REWARD_AVAILABILITY.UNAVAILABLE,
      rewardReason: 'REWARD_POLICY_UNCONFIGURED',
    });
  }
}
