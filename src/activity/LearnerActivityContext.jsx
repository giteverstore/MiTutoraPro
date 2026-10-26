import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { ActivityStateRepository } from '../repositories/firestore/ActivityStateRepository';
import { kolkataDate } from '../home/challengeCalendar';

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
    const [streak, todayCompletion] = await Promise.allSettled([repository.getStreakSummary(), repository.getTodayChallengeCompletion(kolkataDate())]);
    return {
      status: streak.status === 'fulfilled' ? 'ready' : 'error',
      historyStatus: todayCompletion.status === 'fulfilled' ? 'ready' : 'error',
      streak: streak.status === 'fulfilled' ? streak.value : null,
      completions: todayCompletion.status === 'fulfilled' && todayCompletion.value ? [todayCompletion.value] : [],
    };
  }, [repository]);

  const refresh = useCallback(async () => {
    const next = await loadActivity();
    setState((current) => ({ ...next, completions: [...current.completions.filter((item) => item.occurrenceDate !== kolkataDate()), ...next.completions] }));
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
