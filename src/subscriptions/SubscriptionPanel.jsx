import React, { useEffect, useRef, useState } from 'react';
import { authService } from '../auth/AuthService';
import { useFirebaseEmulators } from '../firebase/firebase';
import { SubscriptionRepository } from './SubscriptionRepository';
import { PaymentClient } from './PaymentClient';
import { loadRazorpayCheckout, openRazorpayCheckout } from './RazorpayCheckout';

export const subscriptionPlanPresentation = Object.freeze([
  { planId: 'monthly', name: 'Monthly', price: '₹499', duration: '1 month' },
  { planId: 'half_yearly', name: 'Half-Yearly', price: '₹999', duration: '6 months' },
  { planId: 'annual', name: 'Annual', price: '₹1,499', duration: '12 months' },
]);

export function SubscriptionPanel({ developmentGrantsEnabled = useFirebaseEmulators, currentUser = authService.getCurrentUser(), tokenProvider = () => authService.getIdToken(), repositoryFactory = (uid) => new SubscriptionRepository(uid), fetchImpl = globalThis.fetch, checkoutLoader = loadRazorpayCheckout } = {}) {
  const user = currentUser;
  const grantingRef = useRef(false);
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
      const token = await tokenProvider();
      const response = await fetchImpl('/api/subscriptions/development-grant', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, requestId: crypto.randomUUID() }) });
      if (!response.ok) throw new Error();
      await load(); window.dispatchEvent(new Event('mitutora:subscription-updated'));
    } catch { setState((current) => ({ ...current, status: 'error', grantingPlanId: null, error: 'The development grant was rejected.' })); }
    finally { grantingRef.current = false; }
  };

  const purchase = async (plan) => {
    if (developmentGrantsEnabled || grantingRef.current || !user) return;
    grantingRef.current = true;
    setState((current) => ({ ...current, status: 'creating-order', grantingPlanId: plan.planId, error: '' }));
    try {
      const client = new PaymentClient({ tokenProvider, fetchImpl });
      const [order, RazorpayClass] = await Promise.all([client.createOrder(plan.planId, crypto.randomUUID()), checkoutLoader()]);
      setState((current) => ({ ...current, status: 'checkout-open', grantingPlanId: plan.planId }));
      openRazorpayCheckout({
        RazorpayClass, order: { ...order, planName: plan.name },
        onDismiss: () => { grantingRef.current = false; setState((current) => ({ ...current, status: 'ready', grantingPlanId: null, error: '' })); },
        onSuccess: async (callback) => {
          setState((current) => ({ ...current, status: 'verifying', error: '' }));
          try {
            const result = await client.verifyPayment(order.internalOrderId, callback);
            if (result.status !== 'CAPTURED') throw new Error('Payment is still processing.');
            await load(); window.dispatchEvent(new Event('mitutora:subscription-updated'));
          } catch { setState((current) => ({ ...current, status: 'error', grantingPlanId: null, error: 'Payment could not be verified. No Premium access was granted.' })); }
          finally { grantingRef.current = false; }
        },
      });
    } catch {
      grantingRef.current = false;
      setState((current) => ({ ...current, status: 'error', grantingPlanId: null, error: 'Checkout is temporarily unavailable. No payment was confirmed.' }));
    }
  };

  const premium = state.entitlement?.tier === 'PREMIUM';
  const busy = ['granting', 'creating-order', 'checkout-open', 'verifying'].includes(state.status);
  return <div className="subscription-panel">
    <div className="subscription-current" role="status"><strong>{premium ? 'Premium' : 'Free'}</strong>{premium ? <span>Current plan: {state.entitlement.planId.replace('_', ' ')} · expires {state.entitlement.expiresAt.toLocaleDateString()}</span> : state.status === 'loading' ? <span>Loading subscription…</span> : <span>No active Premium subscription</span>}</div>
    <div className="subscription-plan-grid">{subscriptionPlanPresentation.map((plan) => {
      const current = premium && state.entitlement.planId === plan.planId;
      const granting = state.status === 'granting' && state.grantingPlanId === plan.planId;
      const purchasing = ['creating-order', 'checkout-open', 'verifying'].includes(state.status) && state.grantingPlanId === plan.planId;
      return <article key={plan.planId} className={current ? 'is-current' : ''} aria-current={current ? 'true' : undefined}>
        <h3>{plan.name}</h3><strong>{plan.price}</strong><span>{plan.duration}</span>{current ? <small>Current plan</small> : null}
        <button className="button button--secondary" type="button" disabled={!user || state.status === 'loading' || busy} onClick={() => developmentGrantsEnabled ? grant(plan.planId) : purchase(plan)}>{granting ? 'Granting…' : purchasing ? (state.status === 'verifying' ? 'Verifying…' : 'Opening checkout…') : developmentGrantsEnabled ? 'Get Premium' : 'Buy Premium'}</button>
        {developmentGrantsEnabled ? <small>Local development grant — no payment.</small> : <small>Secure one-time payment. No auto-renewal.</small>}
      </article>;
    })}</div>
    {state.error ? <p role="alert">{state.error}</p> : null}
  </div>;
}
