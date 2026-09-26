import { useEffect, useState } from 'react';
import { getPublicCompilerLanguage, publicCompilerLanguages } from '../compiler/languages/supportedLanguages.js';
import { StandaloneCompilerPage } from './StandaloneCompilerPage.jsx';
import { parseStandaloneCompilerRoute, standaloneCompilerPath } from './standaloneCompilerRouting.js';
import { loadCompilerShare } from './standaloneCompilerApi.js';
import { isStandaloneCompilerHost } from './standaloneCompilerHost.js';

export function StandaloneCompilerApp() {
  const [route, setRoute] = useState(() => parseStandaloneCompilerRoute(window.location.pathname, window.location.hostname));
  useEffect(() => { const pop = () => setRoute(parseStandaloneCompilerRoute(window.location.pathname, window.location.hostname)); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  const navigate = (path, replace = false) => { window.history[replace ? 'replaceState' : 'pushState']({ ycodersCompiler: true }, '', path); setRoute(parseStandaloneCompilerRoute(path, window.location.hostname)); };
  useEffect(() => { if (route.kind === 'language' && !route.canonical) navigate(standaloneCompilerPath(route.language), true); }, [route.kind, route.language?.id]);
  if (route.kind === 'language') return <StandaloneCompilerPage language={route.language} onNavigate={navigate} />;
  if (route.kind === 'index') return <main className="standalone-compiler-index"><img src="/ycoders-mark.svg" alt="" /><h1>YCoders Online Compiler</h1><p>Choose a language to start coding.</p><div>{publicCompilerLanguages.map((language) => <button type="button" onClick={() => navigate(standaloneCompilerPath(language))} key={language.id}>{language.label}</button>)}</div></main>;
  if (route.kind === 'share') return <SharedCompilerRoute shareId={route.shareId} onNavigate={navigate} />;
  return <main className="standalone-compiler-state"><h1>Compiler not found</h1><p>This language route is not available.</p><button className="button button--primary" type="button" onClick={() => navigate(isStandaloneCompilerHost(window.location.hostname) ? '/' : '/__compiler')}>View compilers</button></main>;
}

function SharedCompilerRoute({ shareId, onNavigate }) {
  const [state, setState] = useState({ loading: true, snapshot: null, error: '' });
  useEffect(() => { let active = true; loadCompilerShare(shareId).then((snapshot) => { if (active) setState({ loading: false, snapshot, error: '' }); }).catch(() => { if (active) setState({ loading: false, snapshot: null, error: 'This shared code is unavailable or has expired.' }); }); return () => { active = false; }; }, [shareId]);
  useEffect(() => { let robots = document.querySelector('meta[name="robots"]'); if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); } robots.content = 'noindex, nofollow'; return () => robots.remove(); }, []);
  if (state.loading) return <main className="standalone-compiler-state"><p>Loading shared code…</p></main>;
  if (state.error) return <main className="standalone-compiler-state"><h1>Shared code unavailable</h1><p>{state.error}</p></main>;
  const language = getPublicCompilerLanguage(state.snapshot.languageId);
  if (!language) return <main className="standalone-compiler-state"><h1>Shared code unavailable</h1></main>;
  return <div className="standalone-shared-shell"><div className="standalone-shared-notice">Viewing an immutable snapshot. Changes stay local.<button type="button" onClick={() => onNavigate(standaloneCompilerPath(language))}>Open in Compiler</button></div><StandaloneCompilerPage language={language} initialSnapshot={state.snapshot} onNavigate={onNavigate} /></div>;
}
