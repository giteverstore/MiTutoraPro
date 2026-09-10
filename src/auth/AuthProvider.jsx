import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { authService as defaultService } from './AuthService';
import { attributeReferralCode } from '../referrals/ReferralService';

export function createExclusiveAuthenticationRunner() {
  let activeRequest = null;
  return (operation) => {
    if (activeRequest) return activeRequest;
    const request = Promise.resolve().then(operation);
    activeRequest = request;
    const clearRequest = () => {
      if (activeRequest === request) activeRequest = null;
    };
    request.then(clearRequest, clearRequest);
    return request;
  };
}

export function AuthProvider({ children, service = defaultService }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [referralNotice, setReferralNotice] = useState('');
  const requestRunnerRef = useRef(null);
  if (!requestRunnerRef.current) {
    requestRunnerRef.current = createExclusiveAuthenticationRunner();
  }

  useEffect(() => service.onAuthStateChanged(
    (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    },
    () => {
      setUser(null);
      setLoading(false);
    },
  ), [service]);

  const runAuthenticationRequest = requestRunnerRef.current;

  const signInWithGoogle = useCallback(() => runAuthenticationRequest(
    () => service.signInWithGoogle(),
  ), [runAuthenticationRequest, service]);

  const signInWithEmail = useCallback((email, password) => runAuthenticationRequest(
    () => service.signInWithEmail(email, password),
  ), [runAuthenticationRequest, service]);

  const signUpWithEmail = useCallback((email, password, referralCode = '') => runAuthenticationRequest(
    async () => {
      await service.signUpWithEmail(email, password);
      if (!referralCode) return;
      try {
        await attributeReferralCode(referralCode);
        setReferralNotice('Referral code applied.');
      } catch (error) {
        setReferralNotice(error?.message || 'The referral code could not be applied.');
      }
    },
  ), [runAuthenticationRequest, service]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await service.signOut();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [service]);

  const refreshUser = useCallback(async () => {
    const nextUser = await service.refreshUser();
    setUser(nextUser);
    return nextUser;
  }, [service]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshUser,
    referralNotice,
    clearReferralNotice: () => setReferralNotice(''),
  }), [
    loading,
    refreshUser,
    referralNotice,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    signUpWithEmail,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
