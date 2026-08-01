import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { authService as defaultService } from './AuthService';
import { logAuthenticationError, logAuthenticationEvent } from './authDiagnostics';

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
  const requestRunnerRef = useRef(null);
  if (!requestRunnerRef.current) {
    requestRunnerRef.current = createExclusiveAuthenticationRunner();
  }

  useEffect(() => service.onAuthStateChanged(
    (nextUser) => {
      logAuthenticationEvent('AuthProvider received resolved user.', {
        uid: nextUser?.uid ?? null,
      });
      setUser(nextUser);
      setLoading(false);
    },
    (error) => {
      logAuthenticationError('AuthProvider received an authentication-state error.', error);
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

  const signUpWithEmail = useCallback((email, password) => runAuthenticationRequest(
    () => service.signUpWithEmail(email, password),
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
  }), [
    loading,
    refreshUser,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    signUpWithEmail,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
