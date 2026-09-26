import { useEffect, useState } from 'react';

export function StandaloneTerminalPanel({ stdin, onStdinChange, result, error, isRunning, executionTimeMs, activeLanguage }) {
  const [activeTab, setActiveTab] = useState('output');
  useEffect(() => { if (error) setActiveTab('errors'); else if (isRunning || result) setActiveTab('output'); }, [error, isRunning, result]);
  const tabs = [['input', 'Input'], ['output', 'Output'], ['errors', 'Errors']];
  return <section className="standalone-execution-panel" aria-live="polite">
    <div className="standalone-terminal-tabs" role="tablist" aria-label="Execution results">{tabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)} key={id}>{label}{id === 'errors' && error ? <span>1</span> : null}</button>)}</div>
    <div className="standalone-terminal-content" role="tabpanel">
      {activeTab === 'input' ? <textarea aria-label="Standard input" value={stdin} onChange={(event) => onStdinChange(event.target.value)} placeholder="Enter standard input..." />
        : activeTab === 'errors' ? <pre className={error ? 'is-error' : ''}><code>{error || 'No errors.'}</code></pre>
          : <pre><code>{isRunning ? `Running ${activeLanguage.label}...` : result || 'Run your code to see the output.'}</code></pre>}
    </div>
    <footer><span>{isRunning ? 'Running' : error ? 'Failed' : result ? 'Completed' : 'Ready'}</span><span>{executionTimeMs == null ? '—' : `${executionTimeMs} ms`}</span></footer>
  </section>;
}
