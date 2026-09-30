import { useEffect, useRef, useState } from 'react';

export function StandaloneTerminalPanel({ supportsStdin = false, supportsInteractiveStdin = false, stdin, onStdinChange, stdinHistory = [], onSubmitStdin, executionState = 'idle', result, error, isRunning, executionTimeMs, activeLanguage }) {
  const [activeTab, setActiveTab] = useState('output');
  const [interactiveValue, setInteractiveValue] = useState('');
  const inputRef = useRef(null);
  const waiting = executionState === 'waiting_for_input';
  useEffect(() => { if (waiting) setActiveTab('input'); else if (error) setActiveTab('errors'); else if (isRunning || result) setActiveTab('output'); }, [error, isRunning, result, waiting]);
  useEffect(() => { if (waiting) inputRef.current?.focus(); }, [waiting]);
  const submit = () => {
    if (!waiting || !interactiveValue || !onSubmitStdin?.(interactiveValue)) return;
    setInteractiveValue('');
  };
  const tabs = [...(supportsStdin ? [['input', 'Input']] : []), ['output', 'Output'], ['errors', 'Errors']];
  return <section className="standalone-execution-panel" aria-live="polite">
    <div className="standalone-terminal-tabs" role="tablist" aria-label="Execution results">{tabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)} key={id}>{label}{id === 'errors' && error ? <span>1</span> : null}</button>)}</div>
    <div className="standalone-terminal-content" role="tabpanel">
      {activeTab === 'input' ? <div className="standalone-stdin-panel">
        {!isRunning ? <><textarea aria-label="Standard input" value={stdin} onChange={(event) => onStdinChange(event.target.value)} placeholder="Enter standard input before running your program." />{supportsStdin && !supportsInteractiveStdin ? <p>Enter standard input before running your program.</p> : null}</> : null}
        {stdinHistory.length ? <div className="standalone-stdin-history" aria-label="Submitted input history">{stdinHistory.map((value, index) => <div key={`${index}-${value}`}><span aria-hidden="true">&gt;</span><pre>{value}</pre></div>)}</div> : null}
        {waiting ? <form className="standalone-stdin-composer" onSubmit={(event) => { event.preventDefault(); submit(); }}><label htmlFor="interactive-stdin">Waiting for input</label><div><textarea ref={inputRef} id="interactive-stdin" aria-label="Interactive standard input" value={interactiveValue} onChange={(event) => setInteractiveValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Enter input..." rows="1" /><button type="submit" disabled={!interactiveValue}>Send</button></div></form> : null}
        {isRunning && !waiting ? <p>{supportsInteractiveStdin ? 'Program is running.' : 'This runtime accepts only input supplied before Run.'}</p> : null}
      </div>
        : activeTab === 'errors' ? <pre className={error ? 'is-error' : ''}><code>{error || 'No errors.'}</code></pre>
          : <pre><code>{isRunning && !result ? `Running ${activeLanguage.label}...` : result || 'Run your code to see the output.'}</code></pre>}
    </div>
    <footer className="standalone-result-statusbar">
      <span className="standalone-result-status">{waiting ? 'Waiting for input' : isRunning ? 'Running' : executionState === 'cancelled' ? 'Cancelled' : error ? 'Error' : result ? 'Success' : 'Ready'}</span>
      {executionTimeMs == null ? null : <span className="standalone-result-time">Time <strong>{executionTimeMs} ms</strong></span>}
    </footer>
  </section>;
}
