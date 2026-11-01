import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { ActivityStateRepository } from '../repositories/firestore/ActivityStateRepository';
import { deriveCurrentChallengeStreak, kolkataDate, shiftChallengeDate } from '../home/challengeCalendar';

const LearnerActivityContext = createContext(null);

export function LearnerActivityProvider({ children }) {
  const { user } = useUser();
  const [state, setState] = useState({ status: 'loading', historyStatus: 'loading', streak: null, completions: [] });

  const repository = useMemo(() => new ActivityStateRepository(user.id), [user.id]);

  const mergeCompletions = useCallback((items) => {
    setState((current) => {
      const merged = new Map(current.completions.map((item) => [item.id ?? `${item.activityType}:${item.activityId}:${item.occurrenceDate ?? ''}`, item]));
      items.forEach((item) => merged.set(item.id ?? `${item.activityType}:${item.activityId}:${item.occurrenceDate ?? ''}`, item));
      return { ...current, historyStatus: 'ready', completions: [...merged.values()] };
    });
    return items;
  }, []);

  const loadActivity = useCallback(async () => {
    const today = kolkataDate();
    const streak = await Promise.resolve().then(() => repository.getStreakSummary()).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    );
    const persistedLength = streak.status === 'fulfilled' ? Math.max(0, Math.floor(Number(streak.value?.currentStreak) || 0)) : 0;
    const startDate = shiftChallengeDate(today, -Math.max(1, persistedLength));
    const completions = await Promise.resolve().then(() => repository.listCompletionsForDateRange(startDate, today)).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    );
    const ready = streak.status === 'fulfilled' && completions.status === 'fulfilled';
    return {
      status: ready ? 'ready' : 'error',
      historyStatus: completions.status === 'fulfilled' ? 'ready' : 'error',
      streak: ready ? { ...streak.value, currentStreak: deriveCurrentChallengeStreak(completions.value, today) } : null,
      completions: completions.status === 'fulfilled' ? completions.value : [],
    };
  }, [repository]);

  const refresh = useCallback(async () => {
    const next = await loadActivity();
    setState((current) => {
      const refreshedDates = new Set(next.completions.filter((item) => item.activityType === 'DAILY_CHALLENGE').map((item) => item.occurrenceDate));
      return { ...next, completions: [...current.completions.filter((item) => item.activityType !== 'DAILY_CHALLENGE' || !refreshedDates.has(item.occurrenceDate)), ...next.completions] };
    });
    return next;
  }, [loadActivity]);

  const loadChallengeRange = useCallback(async (startDate, endDate) => {
    setState((current) => ({ ...current, historyStatus: 'loading' }));
    try { return mergeCompletions(await repository.listCompletionsForDateRange(startDate, endDate)); }
    catch (error) { setState((current) => ({ ...current, historyStatus: 'error' })); throw error; }
  }, [mergeCompletions, repository]);

  const loadPracticeCompletions = useCallback(async () => mergeCompletions(await repository.listCompletionsForActivityType('PRACTICE')), [mergeCompletions, repository]);
  const countCompleted = useCallback(async (activityType) => {
    try { return await repository.countCompleted(activityType); }
    catch (error) { setState((current) => ({ ...current, historyStatus: 'error' })); throw error; }
  }, [repository]);
  const recordCompletion = useCallback((completion) => mergeCompletions([completion]), [mergeCompletions]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', historyStatus: 'loading', streak: null, completions: [] });
    loadActivity().then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [loadActivity]);

  const value = useMemo(() => ({ ...state, refresh, loadChallengeRange, loadPracticeCompletions, countCompleted, recordCompletion }), [countCompleted, loadChallengeRange, loadPracticeCompletions, recordCompletion, refresh, state]);
  return <LearnerActivityContext.Provider value={value}>{children}</LearnerActivityContext.Provider>;
}

export function useLearnerActivity({ optional = false } = {}) {
  const value = useContext(LearnerActivityContext);
  if (!value && !optional) throw new Error('useLearnerActivity must be used within LearnerActivityProvider.');
  return value;
}
