import { Crown } from 'lucide-react';

export function openPremiumPlans() {
  window.history.pushState({ mitutora: true }, '', '/settings?section=subscription');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function PremiumGate({ context = 'this feature' }) {
  const description = context === 'lesson'
    ? "You've completed the free preview. Premium unlocks the full course."
    : `Premium unlocks ${context}.`;
  return <section className="premium-gate" role="region" aria-labelledby={`premium-gate-${context.replaceAll(' ', '-')}`}>
    <Crown aria-hidden="true" />
    <h2 id={`premium-gate-${context.replaceAll(' ', '-')}`}>Premium required</h2>
    <p>{description}</p>
    <div className="premium-gate-plans" aria-label="Premium plans"><span>₹499 / month</span><span>₹999 / 6 months</span><span>₹1,499 / year</span></div>
    <button className="button button--primary" type="button" onClick={openPremiumPlans}>View Premium Plans</button>
  </section>;
}
