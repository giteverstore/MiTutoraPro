import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Code2, ExternalLink, FileCode2, LoaderCircle, MessageSquare, Minus, Play, RotateCcw, Settings, Share2 } from 'lucide-react';
import { useCompilerManager } from '../compiler/CompilerProvider.jsx';
import { PreviewPanel } from '../components/PreviewPanel.jsx';
import { DatabaseResultPanel } from '../components/DatabaseResultPanel.jsx';
import { EmulatorResultPanel } from '../components/EmulatorResultPanel.jsx';
import { StandaloneLanguagePicker } from './StandaloneLanguagePicker.jsx';
import { StandaloneFeedbackDialog, StandaloneSettingsDialog, StandaloneShareDialog } from './StandaloneCompilerDialogs.jsx';
import { StandaloneTerminalPanel } from './StandaloneTerminalPanel.jsx';
import { useStandaloneCompilerPreferences } from './useStandaloneCompilerPreferences.js';
import { standaloneCompilerPath } from './standaloneCompilerRouting.js';
import { isStandaloneCompilerHost } from './standaloneCompilerHost.js';
import { standaloneMonacoTheme } from './standaloneMonacoThemes.js';

const MonacoCodeEditor = lazy(() => import('../components/MonacoCodeEditor.jsx'));
const COMING_SOON_LANGUAGES = new Set(['go', 'rust', 'mysql']);
const SPLIT_STORAGE_KEY = 'ycoders.standaloneCompiler.splitRatio';
const DEFAULT_SPLIT = 60;
const MIN_EDITOR_PERCENT = 35;
const MAX_EDITOR_PERCENT = 75;
const CONTROL_EXPAND_DELAY_MS = 2000;

const clampSplit = (value) => Math.min(MAX_EDITOR_PERCENT, Math.max(MIN_EDITOR_PERCENT, value));
function initialSplitRatio() {
  if (typeof window === 'undefined') return DEFAULT_SPLIT;
  try {
    const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
    if (raw === null || raw === '') return DEFAULT_SPLIT;
    const stored = Number(raw);
    return Number.isFinite(stored) ? clampSplit(stored) : DEFAULT_SPLIT;
  } catch { return DEFAULT_SPLIT; }
}

export function isStandaloneComingSoonLanguage(language) {
  return COMING_SOON_LANGUAGES.has(language?.id);
}

export function StandaloneToolbarControl({ label, icon: Icon, primary = false, disabled = false, busy = false, title, onClick }) {
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef(null);
  const clearTimer = () => { if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = null; };
  const endExpansion = () => { clearTimer(); setExpanded(false); };
  useEffect(() => () => clearTimer(), []);
  return <button
    className={`standalone-icon-control${primary ? ' is-primary' : ''}${expanded ? ' is-expanded' : ' is-icon-only'}`}
    type="button"
    aria-label={label}
    title={title ?? label}
    disabled={disabled}
    onClick={onClick}
    onMouseEnter={() => { clearTimer(); timerRef.current = window.setTimeout(() => setExpanded(true), CONTROL_EXPAND_DELAY_MS); }}
    onMouseLeave={endExpansion}
    onFocus={() => setExpanded(true)}
    onBlur={endExpansion}
  >
    {busy ? <LoaderCircle className="result-spinner" size={18} /> : <Icon size={18} fill={primary && Icon === Play ? 'currentColor' : 'none'} />}
    <span aria-hidden="true">{label}</span>
  </button>;
}

export function StandaloneCompilerAdSlot() {
  return <aside className="standalone-ad-slot" aria-label="Advertisement"><span>Advertisement</span><div>Reserved for a relevant sponsor</div></aside>;
}

export function StandaloneCompilerPage({ language, onNavigate, initialSnapshot = null }) {
  const manager = useCompilerManager();
  const preferences = useStandaloneCompilerPreferences();
  const starter = language.defaultSource ?? '';
  const [source, setSource] = useState(initialSnapshot?.source ?? starter);
  const [stdin, setStdin] = useState(initialSnapshot?.stdinIncluded ? initialSnapshot.stdin ?? '' : '');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [execution, setExecution] = useState(null);
  const [running, setRunning] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [resultCollapsed, setResultCollapsed] = useState(false);
  const [splitRatio, setSplitRatio] = useState(initialSplitRatio);
  const [resizing, setResizing] = useState(false);
  const controllerRef = useRef(null);
  const workspaceRef = useRef(null);
  const instanceId = `standalone-${language.id}`;
  const isComingSoon = isStandaloneComingSoonLanguage(language);

  useEffect(() => { setSource(initialSnapshot?.source ?? starter); setStdin(initialSnapshot?.stdinIncluded ? initialSnapshot.stdin ?? '' : ''); setResult(''); setError(''); setExecution(null); }, [language.id, starter, initialSnapshot]);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    document.body.dataset.standaloneCompilerTheme = preferences.resolvedTheme;
    return () => { delete document.body.dataset.standaloneCompilerTheme; };
  }, [preferences.resolvedTheme]);
  useEffect(() => {
    document.title = `Online ${language.label} Compiler | YCoders`;
    let description = document.querySelector('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.append(description); }
    description.content = `Write and run ${language.label} code online with the YCoders compiler.`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = `https://compiler.ycoders.com/${language.publicSlug}`;
  }, [language]);

  const updateSplit = useCallback((next) => {
    const value = clampSplit(next);
    setSplitRatio(value);
    try { window.localStorage.setItem(SPLIT_STORAGE_KEY, String(value)); } catch { /* Persistence is best-effort in restricted browsing contexts. */ }
  }, []);
  useEffect(() => {
    if (!resizing) return undefined;
    const move = (event) => {
      const bounds = workspaceRef.current?.getBoundingClientRect();
      if (bounds?.width) updateSplit(((event.clientX - bounds.left) / bounds.width) * 100);
    };
    const stop = () => setResizing(false);
    document.body.classList.add('standalone-is-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    return () => { document.body.classList.remove('standalone-is-resizing'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [resizing, updateSplit]);

  const editor = useMemo(() => ({ fileName: language.defaultFileName, language: language.monacoLanguage, ariaLabel: `${language.label} source editor` }), [language]);
  const run = async () => {
    if (running || isComingSoon) return;
    const controller = new AbortController(); controllerRef.current = controller; setRunning(true); setError(''); setResult(''); setExecution(null);
    try {
      const next = await manager.execute({ language: language.id, source, stdin, filename: language.defaultFileName, timeoutMs: 10000, signal: controller.signal, instanceId, execution: { publicStandalone: true } });
      setResult(next.output ?? next.stdout ?? ''); setError(next.errors?.join('\n') || next.stderr || ''); setExecution(next);
    } catch (runError) {
      if (runError.name !== 'AbortError') setError(runError.message || `${language.label} compiler is temporarily unavailable.`);
    } finally { if (controllerRef.current === controller) { controllerRef.current = null; setRunning(false); } }
  };
  const reset = () => { setSource(starter); setStdin(''); setResult(''); setError(''); setExecution(null); };
  const chooseLanguage = (next) => { setDialog(null); onNavigate(standaloneCompilerPath(next)); };
  const editorPreferences = { ...preferences.preferences, monacoTheme: standaloneMonacoTheme(preferences.resolvedTheme).name };
  const runLabel = isComingSoon ? 'Coming Soon' : running ? 'Running' : 'Run';

  return <main className="standalone-compiler" data-theme={preferences.resolvedTheme}>
    <header className="standalone-compiler-navbar">
      <a className="standalone-compiler-brand" href={isStandaloneCompilerHost(window.location.hostname) ? '/' : '/__compiler'}><img src="/ycoders-mark.svg" alt="" /><strong>Y CODERS</strong><span>Online Compiler</span></a>
      <span className="standalone-navbar-spacer" />
      <div className="standalone-navbar-right">
        <button className="standalone-language-trigger" type="button" onClick={() => setDialog('language')}><span>{language.label}</span><ChevronDown size={18} /></button>
        {isComingSoon ? <div className="standalone-coming-soon" role="status"><strong>Coming Soon</strong><span>Public {language.label} execution is coming soon.</span></div> : null}
        <nav className="standalone-compiler-actions" aria-label="Compiler actions">
          <StandaloneToolbarControl label="Settings" icon={Settings} onClick={() => setDialog('settings')} />
          <StandaloneToolbarControl label="Feedback" icon={MessageSquare} onClick={() => setDialog('feedback')} />
          <StandaloneToolbarControl label="Share" icon={Share2} onClick={() => setDialog('share')} />
          <StandaloneToolbarControl label="Reset" icon={RotateCcw} onClick={reset} />
          <StandaloneToolbarControl label={runLabel} icon={Play} primary disabled={running || isComingSoon} busy={running} title={isComingSoon ? `Public ${language.label} execution is coming soon.` : runLabel} onClick={run} />
        </nav>
        <a className="standalone-try-link" href="https://ycoders.com">Try YCoders <ExternalLink size={16} /></a>
      </div>
    </header>
    <div className="standalone-workspace-shell">
      <div ref={workspaceRef} className={`standalone-compiler-workspace${resultCollapsed ? ' is-result-collapsed' : ' is-two-pane'}`} style={{ gridTemplateColumns: resultCollapsed ? 'minmax(0,1fr)' : `minmax(0,${splitRatio}fr) .5rem minmax(0,${100 - splitRatio}fr)` }}>
        <section className="standalone-editor-pane"><div className="standalone-file-bar"><div className="standalone-file-tab" role="tab" aria-selected="true"><FileCode2 size={15} aria-hidden="true" /><span>{language.defaultFileName}</span></div></div><Suspense fallback={<div className="monaco-loading-state">Loading editor...</div>}><MonacoCodeEditor editor={editor} value={source} onChange={setSource} instanceId={instanceId} standalonePreferences={editorPreferences} layoutSignal={`${splitRatio}-${resultCollapsed}`} /></Suspense></section>
        <div hidden={resultCollapsed} className="standalone-workspace-divider" role="separator" aria-label="Resize editor and results" aria-orientation="vertical" aria-valuemin={MIN_EDITOR_PERCENT} aria-valuemax={MAX_EDITOR_PERCENT} aria-valuenow={Math.round(splitRatio)} tabIndex="0" onPointerDown={(event) => { event.preventDefault(); setResizing(true); }} onDoubleClick={() => updateSplit(DEFAULT_SPLIT)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); updateSplit(splitRatio + (event.key === 'ArrowLeft' ? -2 : 2)); } if (event.key === 'Home') { event.preventDefault(); updateSplit(DEFAULT_SPLIT); } }}><span /></div>
        <div className="standalone-result-pane" hidden={resultCollapsed}>
          {language.executionMode === 'preview' ? <PreviewPanel preview={execution?.preview} executionStatus={running ? 'running' : execution?.status ?? 'idle'} collapsed={false} onToggleCollapsed={() => {}} showCollapseControl={false} />
            : language.executionMode === 'database' ? <DatabaseResultPanel database={execution?.database} error={error} isRunning={running} executionTimeMs={execution?.executionTimeMs} executionStatus={execution?.status ?? 'idle'} collapsed={false} onToggleCollapsed={() => {}} showCollapseControl={false} />
              : language.executionMode === 'emulator' ? <EmulatorResultPanel emulator={execution?.emulator} result={result} error={error} isRunning={running} executionTimeMs={execution?.executionTimeMs} executionStatus={execution?.status ?? 'idle'} collapsed={false} onToggleCollapsed={() => {}} showCollapseControl={false} />
                : <StandaloneTerminalPanel stdin={stdin} onStdinChange={setStdin} result={result} error={error} isRunning={running} executionTimeMs={execution?.executionTimeMs} activeLanguage={language} />}
          <div className="standalone-result-header-actions">
            <button className="standalone-result-collapse" type="button" aria-label="Minimize compiler panel" onClick={() => setResultCollapsed(true)}><Minus size={17} aria-hidden="true" /></button>
          </div>
        </div>
        {resultCollapsed ? <button className="standalone-result-restore" type="button" aria-label="Restore compiler panel" onClick={() => setResultCollapsed(false)}><span aria-hidden="true"><Code2 size={17} /></span>Compiler</button> : null}
      </div>
    </div>
    <StandaloneCompilerAdSlot />
    <StandaloneLanguagePicker open={dialog === 'language'} activeLanguage={language} onClose={() => setDialog(null)} onSelect={chooseLanguage} />
    <StandaloneSettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} preferences={preferences} />
    <StandaloneFeedbackDialog open={dialog === 'feedback'} onClose={() => setDialog(null)} context={{ languageId: language.id, executionMode: language.executionMode, executionProvider: language.executionProvider ?? 'browser', appVersion: import.meta.env.VITE_APP_VERSION ?? '', theme: preferences.resolvedTheme, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, userAgent: navigator.userAgent }} />
    <StandaloneShareDialog open={dialog === 'share'} onClose={() => setDialog(null)} languageId={language.id} source={source} stdin={stdin} />
  </main>;
}
