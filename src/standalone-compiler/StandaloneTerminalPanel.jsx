import { useEffect, useRef, useState } from 'react';

export function StandaloneTerminalPanel({ supportsStdin = false, stdin, onStdinChange, terminalTranscript = '', onSubmitStdin, executionState = 'idle', result, error, isRunning, executionTimeMs, activeLanguage }) {
  const [activeTab, setActiveTab] = useState('output');
  const [interactiveValue, setInteractiveValue] = useState('');
  const [stdinOpen, setStdinOpen] = useState(false);
  const inputRef = useRef(null);
  const stdinButtonRef = useRef(null);
  const stdinTextareaRef = useRef(null);
  const waiting = executionState === 'waiting_for_input';
  useEffect(() => { if (waiting) setActiveTab('output'); else if (error) setActiveTab('errors'); else if (isRunning || result) setActiveTab('output'); }, [error, isRunning, result, waiting]);
  useEffect(() => { if (waiting && activeTab === 'output') inputRef.current?.focus(); }, [activeTab, waiting]);
  useEffect(() => { if (stdinOpen) stdinTextareaRef.current?.focus(); }, [stdinOpen]);
  useEffect(() => { if (isRunning) setStdinOpen(false); }, [isRunning]);
  const submit = () => {
    if (!waiting || !onSubmitStdin?.(interactiveValue)) return;
    setInteractiveValue('');
  };
  const focusInput = () => { if (waiting && !globalThis.getSelection?.()?.toString()) inputRef.current?.focus(); };
  const tabs = [['output', 'Output'], ['errors', 'Errors']];
  const closeStdin = ({ restoreFocus = false } = {}) => { setStdinOpen(false); if (restoreFocus) queueMicrotask(() => stdinButtonRef.current?.focus()); };
  const displayedTranscript = terminalTranscript || result || (!waiting && isRunning ? `Running ${activeLanguage.label}...` : !waiting ? 'Run your code to see the output.' : '');
  return <section className="standalone-execution-panel" aria-live="polite">
    <span className="sr-only" role="status">{waiting ? 'Program is waiting for input.' : ''}</span>
    <div className="standalone-terminal-tabs" role="tablist" aria-label="Execution results">{tabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)} key={id}>{label}{id === 'errors' && error ? <span>1</span> : null}</button>)}{supportsStdin ? <button ref={stdinButtonRef} className="standalone-stdin-trigger" type="button" aria-expanded={stdinOpen} aria-controls="standalone-stdin-drawer" disabled={isRunning} onClick={() => setStdinOpen((open) => !open)}>Input</button> : null}</div>
    <div className="standalone-terminal-content" role="tabpanel">
      {stdinOpen ? <section id="standalone-stdin-drawer" className="standalone-stdin-drawer" aria-label="Standard input" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeStdin({ restoreFocus: true }); } }}><header><strong>Standard input</strong><button type="button" aria-label="Close standard input" onClick={() => closeStdin({ restoreFocus: true })}>Close</button></header><textarea ref={stdinTextareaRef} aria-label="Standard input" value={stdin} onChange={(event) => onStdinChange(event.target.value)} placeholder="Enter standard input before running your program." /><p>Provide input before running.</p></section> : null}
      {activeTab === 'errors' ? <pre className={error ? 'is-error' : ''}><code>{error || 'No errors.'}</code></pre>
          : <pre className={`standalone-terminal-transcript${waiting ? ' is-waiting' : ''}`} role="log" aria-label="Program terminal" aria-live="polite" onClick={focusInput}><code>{displayedTranscript}{waiting ? <span className="standalone-terminal-input"><input ref={inputRef} aria-label="Program input" value={interactiveValue} onChange={(event) => setInteractiveValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} autoComplete="off" autoCapitalize="off" spellCheck="false" size={Math.max(1, interactiveValue.length + 1)} /><span className="standalone-terminal-caret" aria-hidden="true" /></span> : null}</code></pre>}
    </div>
    <footer className="standalone-result-statusbar">
      <span className="standalone-result-status">{waiting ? 'Waiting for input' : isRunning ? 'Running' : executionState === 'cancelled' ? 'Cancelled' : error ? 'Error' : result ? 'Success' : 'Ready'}</span>
      {executionTimeMs == null ? null : <span className="standalone-result-time">Time <strong>{executionTimeMs} ms</strong></span>}
    </footer>
  </section>;
}
