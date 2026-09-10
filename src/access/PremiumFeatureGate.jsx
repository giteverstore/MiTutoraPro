import { canAccessFeature } from './accessPolicy';
import { PremiumGate } from './PremiumGate';
import { useSubscriptionAccess } from './SubscriptionAccessContext';

export function PremiumFeatureGate({ feature, context, children }) {
  const { tier } = useSubscriptionAccess();
  return canAccessFeature({ tier, feature }) ? children : <PremiumGate context={context} />;
}
