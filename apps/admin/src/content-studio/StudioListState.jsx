import { useCallback, useEffect, useRef, useState } from 'react';

export function useStudioList(load) {
  const [state, setState] = useState({ status: 'loading', items: [], error: '' });
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setState((previous) => ({ ...previous, status: 'loading', error: '' }));
    try { const items = await load(); if (requestId.current === id) setState({ status: 'ready', items, error: '' }); }
    catch (error) { if (requestId.current === id) setState((previous) => ({ ...previous, status: 'error', error: error?.message || 'Content could not be loaded.' })); }
  }, [load]);
  useEffect(() => { void reload(); return () => { requestId.current++; }; }, [reload]);
  return { ...state, reload };
}

export function StudioListState({ resource, label, empty, children }) {
  if (resource.status === 'loading') return <div className="studio-list-state" role="status" aria-busy="true">Loading {label}...</div>;
  if (resource.status === 'error') return <div className="studio-list-state" role="alert"><p>Could not load {label}. {resource.error}</p><button type="button" onClick={resource.reload}>Retry</button></div>;
  if (!resource.items.length) return <div className="studio-list-state">{empty}</div>;
  return children;
}

export function StudioListHeader({ title, description, action }) {
  return <header className="studio-list-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}
