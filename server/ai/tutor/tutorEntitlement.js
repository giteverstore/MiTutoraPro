export const STANDARD_TUTOR_MESSAGE_LIMIT = 30;

export function resolveTutorEntitlement(premiumEntitlement = {}, { unlimitedPlanIds = [] } = {}) {
  return Object.freeze({
    includedTutorMessages: Number.isSafeInteger(premiumEntitlement.includedTutorMessages)
      ? Math.max(0, premiumEntitlement.includedTutorMessages) : STANDARD_TUTOR_MESSAGE_LIMIT,
    unlimitedTutorMessages: premiumEntitlement.unlimitedTutorMessages === true || unlimitedPlanIds.includes(premiumEntitlement.planId),
  });
}
