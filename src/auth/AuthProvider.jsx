import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { authService as defaultService } from './AuthService';

export function AuthProvider({ children, service = defaultService }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      await service.signInWithGoogle();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [service]);

  const signInWithEmail = useCallback(async (email, password) => {
    setLoading(true);
    try {
      await service.signInWithEmail(email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [service]);

  const signUpWithEmail = useCallback(async (email, password) => {
    setLoading(true);
    try {
      await service.signUpWithEmail(email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [service]);

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
