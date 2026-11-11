import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { authenticatedJsonPost } from '../api/authenticatedJsonRequest';
import { authService } from '../auth/AuthService';
import { useFirebaseEmulators } from '../firebase/firebase';
import { SubscriptionRepository } from './SubscriptionRepository';
import { PaymentClient } from './PaymentClient';
import { createRazorpayCheckout, loadRazorpayCheckout, validateCheckoutOrder } from './RazorpayCheckout';

export const subscriptionPlanPresentation = Object.freeze([
  { planId: 'monthly', name: 'Monthly', regularPrice: '₹999', price: '₹999', duration: '1 month' },
  { planId: 'half_yearly', name: '6 Months', regularPrice: '₹5,994', price: '₹1,499', duration: '6 months', discount: '75% OFF' },
  { planId: 'annual', name: 'Annual', regularPrice: '₹11,988', price: '₹1,999', duration: '1 year', discount: '83% OFF', badge: 'BEST VALUE' },
]);

const freeFeatures = Object.freeze([
  'Limited access to programming courses', 'Practice problems', 'Daily Challenges',
  'Built-in code editor/compiler', 'Limited progress tracking', 'Bookmarks', 'Coins & rewards',
]);

const premiumFeatures = Object.freeze([
  'Full access to programming courses', 'Practice problems', 'Daily Challenges',
  'Built-in code editor/compiler', 'Full progress tracking', 'Bookmarks', 'Coins & rewards',
  'Certificates', 'AI Tutor', 'Premium Projects', 'Premium themes / brand themes',
]);

const enterpriseFeatures = Object.freeze([
  ...premiumFeatures, 'Institutional access', 'Bulk student access',
  'Custom institutional pricing', 'Dedicated support',
]);

function FeatureList({ features }) {
  return <ul className="subscription-feature-list">{features.map((feature) => (
    <li key={feature}><Check aria-hidden="true" size={16} /><span>{feature}</span></li>
  ))}</ul>;
}

export function SubscriptionPanel({ developmentGrantsEnabled = useFirebaseEmulators, currentUser = authService.getCurrentUser(), tokenProvider = () => authService.getIdToken(), repositoryFactory = (uid) => new SubscriptionRepository(uid), fetchImpl = (...args) => globalThis.fetch(...args), checkoutLoader = loadRazorpayCheckout, logger = console } = {}) {
  const user = currentUser;
  const grantingRef = useRef(false);
  const [selectedPlanId, setSelectedPlanId] = useState('annual');
  const [state, setState] = useState({ status: 'loading', entitlement: null, error: '', grantingPlanId: null });
  const load = async () => {
    if (!user) return setState({ status: 'ready', entitlement: { tier: 'FREE' }, error: '', grantingPlanId: null });
    try { setState({ status: 'ready', entitlement: await repositoryFactory(user.uid).getCurrent(), error: '', grantingPlanId: null }); }
    catch { setState({ status: 'error', entitlement: null, error: 'Subscription status is unavailable.', grantingPlanId: null }); }
  };
  useEffect(() => { void load(); }, [user?.uid]);

  const grant = async (planId) => {
    if (!developmentGrantsEnabled || grantingRef.current) return;
    grantingRef.current = true;
    setState((current) => ({ ...current, status: 'granting', grantingPlanId: planId, error: '' }));
    try {
      const result = await authenticatedJsonPost({ tokenProvider, fetchImpl, url: '/api/subscriptions/development-grant', body: { planId, requestId: crypto.randomUUID() } });
      if (!result?.response.ok) throw new Error();
      await load(); window.dispatchEvent(new Event('mitutora:subscription-updated'));
    } catch { setState((current) => ({ ...current, status: 'error', grantingPlanId: null, error: 'The development grant was rejected.' })); }
    finally { grantingRef.current = false; }
  };

  const purchase = async (plan) => {
    if (developmentGrantsEnabled || grantingRef.current || !user) return;
    grantingRef.current = true;
    const fail = (category, message = 'Checkout could not be started. No payment was confirmed.', details = {}) => {
      const diagnostic = { category };
      for (const field of ['endpoint', 'method', 'exceptionName', 'status', 'serverCode']) {
        if (details[field] !== undefined) diagnostic[field] = details[field];
      }
      logger?.warn?.('payment-checkout-failure', diagnostic);
      grantingRef.current = false;
      setState((current) => ({ ...current, status: 'error', grantingPlanId: null, error: message, failureCategory: category }));
    };
    const canonicalPlan = subscriptionPlanPresentation.find((candidate) => candidate.planId === plan?.planId);
    if (!canonicalPlan) return fail('PLAN_SELECTION_INVALID');
    setState((current) => ({ ...current, status: 'loading-checkout', grantingPlanId: canonicalPlan.planId, error: '', failureCategory: null }));
    try {
      let RazorpayClass;
      try { RazorpayClass = await checkoutLoader(); }
      catch (error) { return fail(error?.category === 'CHECKOUT_GLOBAL_UNAVAILABLE' ? error.category : 'CHECKOUT_SCRIPT_LOAD_FAILED'); }
      if (typeof RazorpayClass !== 'function') return fail('CHECKOUT_GLOBAL_UNAVAILABLE');

      let token;
      try { token = await tokenProvider(); if (typeof token !== 'string' || !token) throw new Error(); }
      catch { return fail('AUTH_TOKEN_FAILED', 'Your session could not be verified. Please sign in again.'); }

      setState((current) => ({ ...current, status: 'creating-order' }));
      const client = new PaymentClient({ tokenProvider: async () => token, fetchImpl });
      let requestId;
      try {
        if (typeof globalThis.crypto?.randomUUID !== 'function') throw new TypeError('Secure request identity is unavailable.');
        requestId = globalThis.crypto.randomUUID();
      } catch { return fail('ORDER_REQUEST_ID_FAILED'); }
      let order;
      try { order = await client.createOrder(canonicalPlan.planId, requestId); }
      catch (error) { return fail(error?.category ?? 'ORDER_TRANSPORT_FAILED', undefined, error); }
      try { validateCheckoutOrder(order, canonicalPlan.planId); }
      catch { return fail('ORDER_RESPONSE_INVALID'); }

      let checkout;
      try {
        checkout = createRazorpayCheckout({
          RazorpayClass, order: { ...order, planName: canonicalPlan.name },
        onDismiss: () => { logger?.warn?.('payment-checkout-failure', { category: 'CHECKOUT_CANCELLED' }); grantingRef.current = false; setState((current) => ({ ...current, status: 'ready', grantingPlanId: null, error: '', failureCategory: 'CHECKOUT_CANCELLED' })); },
        onSuccess: async (callback) => {
          setState((current) => ({ ...current, status: 'verifying', error: '' }));
          try {
            const result = await client.verifyPayment(order.internalOrderId, callback);
            if (result.status !== 'CAPTURED') throw new Error('Payment is still processing.');
            await load(); window.dispatchEvent(new Event('mitutora:subscription-updated'));
          } catch { fail('PAYMENT_VERIFICATION_FAILED', 'Payment could not be verified. No Premium access was granted.'); }
          finally { grantingRef.current = false; }
        },
      });
      } catch { return fail('CHECKOUT_CONSTRUCTION_FAILED'); }
      setState((current) => ({ ...current, status: 'checkout-open', grantingPlanId: canonicalPlan.planId }));
      try { checkout.open(); }
      catch { return fail('CHECKOUT_OPEN_FAILED'); }
    } catch {
      fail('CHECKOUT_CONSTRUCTION_FAILED');
    }
  };

  const premium = state.entitlement?.tier === 'PREMIUM';
  const busy = ['granting', 'loading-checkout', 'creating-order', 'checkout-open', 'verifying'].includes(state.status);
  const selectedPlan = subscriptionPlanPresentation.find((plan) => plan.planId === selectedPlanId) ?? subscriptionPlanPresentation[0];
  const current = premium && state.entitlement.planId === selectedPlan.planId;
  const granting = state.status === 'granting' && state.grantingPlanId === selectedPlan.planId;
  const purchasing = ['loading-checkout', 'creating-order', 'checkout-open', 'verifying'].includes(state.status) && state.grantingPlanId === selectedPlan.planId;
  const premiumAction = granting ? 'Granting…' : purchasing ? (state.status === 'verifying' ? 'Verifying…' : 'Opening checkout…') : current ? 'Current Plan' : developmentGrantsEnabled ? 'Get Premium' : 'Buy Premium';
  return <div className="subscription-panel">
    <div className="subscription-current" role="status"><strong>{premium ? 'Premium' : 'Free'}</strong>{premium ? <span>Current plan: {state.entitlement.planId.replace('_', ' ')} · expires {state.entitlement.expiresAt.toLocaleDateString()}</span> : state.status === 'loading' ? <span>Loading subscription…</span> : <span>No active Premium subscription</span>}</div>
    <div className="subscription-plan-grid">
      <article className="subscription-plan-card subscription-plan-card--free">
        <header><h3>Free</h3><p>Learn and practice at no cost</p></header>
        <div className="subscription-price"><strong>₹0</strong><span>Forever</span></div>
        <FeatureList features={freeFeatures} />
        <button className="button button--secondary subscription-plan-cta" type="button" disabled>{premium ? 'Free Plan' : 'Current Plan'}</button>
      </article>

      <article className={`subscription-plan-card subscription-plan-card--premium${current ? ' is-current' : ''}`} aria-current={current ? 'true' : undefined}>
        <header><div className="subscription-plan-heading"><h3>Premium</h3>{selectedPlan.badge ? <span className="subscription-value-badge">{selectedPlan.badge}</span> : null}</div><p>Full access to YCoders</p></header>
        <div className="subscription-duration-toggle" role="group" aria-label="Premium billing duration">
          {subscriptionPlanPresentation.map((plan) => <button key={plan.planId} type="button" aria-pressed={selectedPlanId === plan.planId} onClick={() => setSelectedPlanId(plan.planId)}>{plan.name}</button>)}
        </div>
        <div className="subscription-price subscription-price--premium">
          {selectedPlan.discount ? <div className="subscription-offer-line"><del>{selectedPlan.regularPrice}</del><span>{selectedPlan.discount}</span></div> : null}
          <strong>{selectedPlan.price}</strong><span>for {selectedPlan.duration}</span>
        </div>
        <FeatureList features={premiumFeatures} />
        <button className="button button--primary subscription-plan-cta" type="button" disabled={current || !user || state.status === 'loading' || busy} onClick={() => developmentGrantsEnabled ? grant(selectedPlan.planId) : purchase(selectedPlan)}>{premiumAction}</button>
        {developmentGrantsEnabled ? <small>Local development grant — no payment.</small> : <small>Secure one-time payment. No auto-renewal.</small>}
      </article>

      <article className="subscription-plan-card subscription-plan-card--enterprise">
        <header><h3>Enterprise</h3><p>For colleges and universities</p></header>
        <div className="subscription-price subscription-price--custom"><strong>Custom pricing</strong></div>
        <FeatureList features={enterpriseFeatures} />
        <button className="button button--secondary subscription-plan-cta" type="button" disabled aria-disabled="true">Contact Sales</button>
      </article>
    </div>
    {!developmentGrantsEnabled ? <p className="subscription-purchase-disclosure">By purchasing Premium, you agree to the <a href="/terms">Terms</a> and acknowledge the <a href="/refund-policy">Refund Policy</a>.</p> : null}
    {state.error ? <p role="alert" data-payment-failure-category={state.failureCategory ?? undefined}>{state.error}</p> : null}
  </div>;
}
