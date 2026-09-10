import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const FREE = Object.freeze({ tier: 'FREE', active: false, planId: null, expiresAt: null });
const SubscriptionAccessContext = createContext(null);

export function SubscriptionAccessProvider({ userId, children }) {
  const [state, setState] = useState({ status: 'loading', entitlement: FREE });
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading' }));
    try {
      const { SubscriptionRepository } = await import('../subscriptions/SubscriptionRepository');
      setState({ status: 'ready', entitlement: await new SubscriptionRepository(userId).getCurrent() });
    }
    catch { setState({ status: 'error', entitlement: FREE }); }
  }, [userId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const handleUpdate = () => { void refresh(); };
    window.addEventListener('mitutora:subscription-updated', handleUpdate);
    return () => window.removeEventListener('mitutora:subscription-updated', handleUpdate);
  }, [refresh]);
  useEffect(() => {
    const expiresAt = state.entitlement?.expiresAt;
    if (state.status !== 'ready' || state.entitlement?.tier !== 'PREMIUM' || !(expiresAt instanceof Date)) return undefined;
    const delay = Math.min(86_400_000, Math.max(0, expiresAt.getTime() - Date.now() + 50));
    const timer = window.setTimeout(() => { void refresh(); }, delay);
    return () => window.clearTimeout(timer);
  }, [refresh, state]);
  const value = useMemo(() => ({ ...state, tier: state.status === 'ready' ? state.entitlement.tier : 'FREE', refresh }), [refresh, state]);
  return <SubscriptionAccessContext.Provider value={value}>{children}</SubscriptionAccessContext.Provider>;
}

export function useSubscriptionAccess() {
  const value = useContext(SubscriptionAccessContext);
  if (!value) throw new Error('useSubscriptionAccess must be used inside SubscriptionAccessProvider.');
  return value;
}

export function useOptionalSubscriptionAccess() {
  return useContext(SubscriptionAccessContext);
}
