import { DEFAULT_HINT_LEVEL } from './tutorConfig.js';

export const TUTOR_ACTIVITY_TYPES = Object.freeze(['lesson', 'practice', 'challenge', 'certification', 'unknown']);
export const TUTOR_SOLUTION_POLICIES = Object.freeze(['hints-only', 'progressive']);
export const TUTOR_HINT_LEVELS = Object.freeze({
  1: 'Conceptual hint or investigative question.',
  2: 'Identify the relevant region or condition.',
  3: 'Explain the underlying mistake and intended rule.',
  4: 'Show a small corrected fragment or analogous example.',
  5: 'Provide a complete solution only when trusted policy permits it.',
});

const policies = Object.freeze({
  // Phase 3 initial-release policy: even a trusted lesson remains hints-only.
  // Progressive escalation requires a separately reviewed policy version.
  lesson: Object.freeze({ activityType: 'lesson', solutionPolicy: 'hints-only', maximumHintLevel: 1 }),
  practice: Object.freeze({ activityType: 'practice', solutionPolicy: 'hints-only', maximumHintLevel: 1 }),
  challenge: Object.freeze({ activityType: 'challenge', solutionPolicy: 'hints-only', maximumHintLevel: 1 }),
  certification: Object.freeze({ activityType: 'certification', solutionPolicy: 'hints-only', maximumHintLevel: 1 }),
  unknown: Object.freeze({ activityType: 'unknown', solutionPolicy: 'hints-only', maximumHintLevel: 1 }),
});

export function activityHintFromRequest(body) {
  const hint = typeof body?.activityType === 'string' ? body.activityType.trim().toLowerCase() : 'unknown';
  return TUTOR_ACTIVITY_TYPES.includes(hint) ? hint : 'unknown';
}

function trustedPolicy(value) {
  const activityType = typeof value?.activityType === 'string' ? value.activityType.trim().toLowerCase() : '';
  return policies[activityType] ?? null;
}

export class TrustedActivityPolicyResolver {
  constructor({ resolveTrustedContext = async () => null } = {}) {
    this.resolveTrustedContext = resolveTrustedContext;
  }

  async resolve({ principal, activityHint = 'unknown' } = {}) {
    const trusted = trustedPolicy(await this.resolveTrustedContext({ principal }));
    if (trusted) return trusted;

    // Untrusted hints may only tighten policy. They can never unlock lesson escalation.
    if (activityHint === 'practice' || activityHint === 'challenge' || activityHint === 'certification') {
      return policies[activityHint];
    }
    return policies.unknown;
  }
}

export function resolveHintLevel(requestedLevel, policy) {
  const requested = Number(requestedLevel);
  if (!Number.isInteger(requested) || requested < DEFAULT_HINT_LEVEL) return DEFAULT_HINT_LEVEL;
  return Math.min(requested, policy?.maximumHintLevel ?? DEFAULT_HINT_LEVEL, 5);
}

export function canReleaseCompleteSolution(policy, hintLevel) {
  return policy?.completeSolutionEnabled === true && policy?.solutionPolicy === 'progressive' && hintLevel >= 5;
}

export const trustedActivityPolicyResolver = new TrustedActivityPolicyResolver();
