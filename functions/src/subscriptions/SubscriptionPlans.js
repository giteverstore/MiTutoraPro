const VERSION = 'm3-v1';

const definitions = [
  { planId: 'monthly', displayName: 'Monthly', priceMinor: 49_900, currency: 'INR', durationMonths: 1, enabled: true, version: VERSION },
  { planId: 'half_yearly', displayName: 'Half-Yearly', priceMinor: 99_900, currency: 'INR', durationMonths: 6, enabled: true, version: VERSION },
  { planId: 'annual', displayName: 'Annual', priceMinor: 149_900, currency: 'INR', durationMonths: 12, enabled: true, version: VERSION },
].map(Object.freeze);

export const subscriptionPlans = Object.freeze(definitions);

export function getSubscriptionPlan(planId, plans = subscriptionPlans) {
  const plan = plans.find((candidate) => candidate.planId === planId);
  if (!plan) throw Object.assign(new Error('The selected subscription plan is not supported.'), { code: 'subscription/unsupported-plan' });
  if (!plan.enabled) throw Object.assign(new Error('The selected subscription plan is unavailable.'), { code: 'subscription/disabled-plan' });
  return plan;
}
