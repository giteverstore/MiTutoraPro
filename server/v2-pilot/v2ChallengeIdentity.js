export const V2_CHALLENGE_ASSIGNMENT_COLLECTION = 'dailyChallengeAssignments';

export function createV2ChallengeAssignmentId(policyId, challengeDate) {
  if (!/^[0-9a-f-]{36}$/i.test(policyId) || !/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) throw new TypeError('A valid Challenge policy scope is required.');
  return `${policyId}:${challengeDate}`;
}

