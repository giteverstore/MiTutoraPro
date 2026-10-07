import { useEffect } from 'react';

export function useDraftAutosave({ state, dispatch, repository, delay = 650 }) {
  useEffect(() => {
    if (!state.dirty || state.readOnly) return undefined;
    const document = state.document;
    const timeout = setTimeout(async () => {
      dispatch({ type: 'saving' });
      try { await repository.save(document); dispatch({ type: 'saved', document }); }
      catch { dispatch({ type: 'save-failed' }); }
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay, dispatch, repository, state.dirty, state.document, state.readOnly]);
}
