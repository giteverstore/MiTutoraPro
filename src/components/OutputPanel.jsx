export function OutputPanel({
  output,
  height,
  activeTab,
  onTabChange,
  result,
  error,
  isRunning,
  executionTimeMs,
  expectedOutput,
}) {
  const status = isRunning ? 'running' : error ? 'error' : result ? 'success' : 'idle';
  const statusLabel = {
    idle: 'Ready',
    running: 'Running',
    success: 'Completed',
    error: 'Failed',
  }[status];
  const visibleContent = activeTab === 'errors'
    ? error || 'No runtime errors.'
    : isRunning
      ? 'Executing program…'
      : result || output.emptyDescription;

  return (
    <section
      className={`console-window terminal-console is-${status}`}
      style={{ height, flexBasis: height }}
      aria-live="polite"
    >
      <header className="terminal-header">
        <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
        <strong>MiTutora Terminal</strong>
        <span className={`terminal-status is-${status}`}>
          <i /> {statusLabel}
        </span>
      </header>

      <div className="terminal-body">
        <section className="terminal-expected" aria-labelledby="expected-output-label">
          <span id="expected-output-label">Expected Output</span>
          <pre>{expectedOutput || 'Not specified for this exercise.'}</pre>
        </section>

        <section className="terminal-program" aria-labelledby="program-output-label">
          <header>
            <span id="program-output-label">Program Output</span>
            <div className="terminal-tabs" role="tablist">
              <button
                className={activeTab === 'output' ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === 'output'}
                onClick={() => onTabChange('output')}
              >
                Output
              </button>
              <button
                className={activeTab === 'errors' ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === 'errors'}
                onClick={() => onTabChange('errors')}
              >
                Errors {error ? <em>1</em> : null}
              </button>
            </div>
          </header>
          <pre className={activeTab === 'errors' && error ? 'terminal-error-text' : ''}>
            <code><span aria-hidden="true">$ </span>{visibleContent}</code>
          </pre>
        </section>
      </div>

      <footer className="terminal-runtime">
        <RuntimeMetric label="Runtime Status" value={statusLabel} tone={status} />
        <RuntimeMetric label="Exit Code" value={status === 'success' ? '0' : status === 'error' ? '1' : '—'} />
        <RuntimeMetric
          label="Execution Time"
          value={executionTimeMs === null ? '—' : `${executionTimeMs} ms`}
        />
      </footer>
    </section>
  );
}

function RuntimeMetric({ label, value, tone = '' }) {
  return (
    <span className={`runtime-metric ${tone ? `is-${tone}` : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}
