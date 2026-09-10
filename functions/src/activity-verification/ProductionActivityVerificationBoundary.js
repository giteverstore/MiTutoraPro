// The repository has no production-grade arbitrary-code sandbox. Keeping this
// boundary explicit prevents browser execution or a normal serverless process
// from being mistaken for authoritative reward evidence.
export const productionActivityVerificationBoundary = Object.freeze({
  enabled: false,
  endpointExposed: false,
  rewardActivationEnabled: false,
  reason: 'ISOLATED_EXECUTION_SANDBOX_NOT_CONFIGURED',
  practice: Object.freeze({ contentIntegrity: true, privateTests: true, executable: false }),
  dailyChallenge: Object.freeze({ contentIntegrity: false, privateTests: false, executable: false }),
  streakEvent: 'SERVER_VERIFIED_ACTIVITY',
});
