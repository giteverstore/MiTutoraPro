import { useEffect, useMemo, useState } from 'react';
import { createV2PracticeIdentity, v2PracticeRepository } from './V2PracticeRepository';
import { V2PracticeWorkspace } from './V2PracticeWorkspace';
import './v2-pilot.css';

export function V2PilotPracticePage({ contentId, publicationVersion, onExit, repository = v2PracticeRepository, executionClient }) {
  const identity = useMemo(() => createV2PracticeIdentity({ contentId, publicationVersion }), [contentId, publicationVersion]);
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController(); setState({ status: 'loading' });
    repository.load(identity, { signal: controller.signal }).then((delivery) => { setState({ status: 'ready', delivery }); }, (error) => { if (!controller.signal.aborted) setState({ status: 'error', error }); });
    return () => controller.abort();
  }, [identity, repository]);
  if (state.status === 'loading') return <main className="v2-practice-preview" aria-busy="true"><p>Loading Practice…</p></main>;
  if (state.status === 'error') return <main className="v2-practice-preview" role="alert"><h1>Practice unavailable</h1><p>{state.error.message}</p><button type="button" onClick={onExit}>Return home</button></main>;
  const { delivery } = state, practice = delivery.practice;
  return <div className="v2-pilot-shell"><div className="v2-pilot-banner" role="status"><strong>V2 Practice Pilot</strong><span>Version {delivery.publicationVersion} · Nothing is saved</span></div><div className="v2-pilot-workspace"><V2PracticeWorkspace practice={practice} onExit={onExit} executionClient={executionClient}/></div></div>;
}
