import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { ActivityStateRepository } from '../repositories/firestore/ActivityStateRepository';

const LearnerActivityContext = createContext(null);

export function LearnerActivityProvider({ children }) {
  const { user } = useUser();
  const [state, setState] = useState({ status: 'loading', historyStatus: 'loading', streak: null, completions: [] });

  const loadActivity = useCallback(async () => {
    const repository = new ActivityStateRepository(user.id);
    const [streak, completions] = await Promise.allSettled([repository.getStreakSummary(), repository.listCompletions()]);
    return {
      status: streak.status === 'fulfilled' ? 'ready' : 'error',
      historyStatus: completions.status === 'fulfilled' ? 'ready' : 'error',
      streak: streak.status === 'fulfilled' ? streak.value : null,
      completions: completions.status === 'fulfilled' ? completions.value : [],
    };
  }, [user.id]);

  const refresh = useCallback(async () => {
    const next = await loadActivity();
    setState(next);
    return next;
  }, [loadActivity]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', historyStatus: 'loading', streak: null, completions: [] });
    loadActivity().then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [loadActivity]);

  const value = useMemo(() => ({ ...state, refresh }), [refresh, state]);
  return <LearnerActivityContext.Provider value={value}>{children}</LearnerActivityContext.Provider>;
}

export function useLearnerActivity() {
  const value = useContext(LearnerActivityContext);
  if (!value) throw new Error('useLearnerActivity must be used within LearnerActivityProvider.');
  return value;
}
