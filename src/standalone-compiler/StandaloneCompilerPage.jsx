import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, LoaderCircle, MessageSquare, Play, RotateCcw, Settings, Share2 } from 'lucide-react';
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

const MonacoCodeEditor = lazy(() => import('../components/MonacoCodeEditor.jsx'));
const COMING_SOON_LANGUAGES = new Set(['go', 'rust', 'mysql']);

export function isStandaloneComingSoonLanguage(language) {
  return COMING_SOON_LANGUAGES.has(language?.id);
}

export function StandaloneCompilerPage({ language, onNavigate, initialSnapshot = null }) {
  const manager = useCompilerManager();
  const preferences = useStandaloneCompilerPreferences();
  const starter = language.defaultSource ?? '';
  const [source, setSource] = useState(initialSnapshot?.source ?? starter);
  const [stdin, setStdin] = useState(initialSnapshot?.stdinIncluded ? initialSnapshot.stdin ?? '' : '');
  const [result, setResult] = useState(''); const [error, setError] = useState('');
  const [execution, setExecution] = useState(null); const [running, setRunning] = useState(false);
  const [dialog, setDialog] = useState(null); const controllerRef = useRef(null);
  const instanceId = `standalone-${language.id}`;
  const isComingSoon = isStandaloneComingSoonLanguage(language);
  useEffect(() => { setSource(initialSnapshot?.source ?? starter); setStdin(initialSnapshot?.stdinIncluded ? initialSnapshot.stdin ?? '' : ''); setResult(''); setError(''); setExecution(null); }, [language.id, starter, initialSnapshot]);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    document.title = `Online ${language.label} Compiler | YCoders`;
    let description = document.querySelector('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.append(description); }
    description.content = `Write and run ${language.label} code online with the YCoders compiler.`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = `https://compiler.ycoders.com/${language.publicSlug}`;
  }, [language]);
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
  const chooseLanguage = (next) => { setDialog(null); onNavigate(standaloneCompilerPath(next)); };
  const editorPreferences = { ...preferences.preferences, monacoTheme: preferences.resolvedTheme === 'dark' ? 'ycoders-dark' : 'ycoders-light' };
  return <main className="standalone-compiler" data-theme={preferences.resolvedTheme}>
    <header className="standalone-compiler-header"><a href={isStandaloneCompilerHost(window.location.hostname) ? '/' : '/__compiler'}><img src="/ycoders-mark.svg" alt="" /><strong>Y CODERS</strong></a><span>Online Compiler</span></header>
    <div className="standalone-compiler-toolbar">
      <button className="standalone-language-trigger" type="button" onClick={() => setDialog('language')}><span>{language.label}</span><ChevronDown size={18} /></button>
      {isComingSoon ? <div className="standalone-coming-soon" role="status"><strong>Coming Soon</strong><span>Public {language.label} execution is coming soon.</span></div> : null}
      <div><button type="button" onClick={() => setDialog('settings')}><Settings size={17} /><span>Settings</span></button><button type="button" onClick={() => setDialog('feedback')}><MessageSquare size={17} /><span>Feedback</span></button><button type="button" onClick={() => setDialog('share')}><Share2 size={17} /><span>Share</span></button><button type="button" onClick={() => { setSource(starter); setStdin(''); setResult(''); setError(''); setExecution(null); }}><RotateCcw size={17} /><span>Reset</span></button><button className="button button--primary" type="button" disabled={running || isComingSoon} onClick={run} title={isComingSoon ? `Public ${language.label} execution is coming soon.` : undefined}>{running ? <LoaderCircle className="result-spinner" size={17} /> : <Play size={17} fill="currentColor" />}<span>{isComingSoon ? 'Coming Soon' : running ? 'Running' : 'Run'}</span></button></div>
    </div>
    <div className="standalone-compiler-workspace">
      <section className="standalone-editor-pane"><div className="standalone-file-label">{language.defaultFileName}</div><Suspense fallback={<div className="monaco-loading-state">Loading editor...</div>}><MonacoCodeEditor editor={editor} value={source} onChange={setSource} instanceId={instanceId} standalonePreferences={editorPreferences} /></Suspense></section>
      {language.executionMode === 'preview' ? <PreviewPanel preview={execution?.preview} executionStatus={running ? 'running' : execution?.status ?? 'idle'} collapsed={false} onToggleCollapsed={() => {}} />
        : language.executionMode === 'database' ? <DatabaseResultPanel database={execution?.database} error={error} isRunning={running} executionTimeMs={execution?.executionTimeMs} executionStatus={execution?.status ?? 'idle'} collapsed={false} onToggleCollapsed={() => {}} />
          : language.executionMode === 'emulator' ? <EmulatorResultPanel emulator={execution?.emulator} result={result} error={error} isRunning={running} executionTimeMs={execution?.executionTimeMs} executionStatus={execution?.status ?? 'idle'} collapsed={false} onToggleCollapsed={() => {}} />
            : <StandaloneTerminalPanel stdin={stdin} onStdinChange={setStdin} result={result} error={error} isRunning={running} executionTimeMs={execution?.executionTimeMs} activeLanguage={language} />}
    </div>
    <StandaloneLanguagePicker open={dialog === 'language'} activeLanguage={language} onClose={() => setDialog(null)} onSelect={chooseLanguage} />
    <StandaloneSettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} preferences={preferences} />
    <StandaloneFeedbackDialog open={dialog === 'feedback'} onClose={() => setDialog(null)} context={{ languageId: language.id, executionMode: language.executionMode, executionProvider: language.executionProvider ?? 'browser', appVersion: import.meta.env.VITE_APP_VERSION ?? '', theme: preferences.resolvedTheme, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, userAgent: navigator.userAgent }} />
    <StandaloneShareDialog open={dialog === 'share'} onClose={() => setDialog(null)} languageId={language.id} source={source} stdin={stdin} />
  </main>;
}
