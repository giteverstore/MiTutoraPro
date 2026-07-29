import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, LoaderCircle, SearchCheck } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

export function OutputPanel({
  height,
  result,
  error,
  isRunning,
  executionTimeMs,
  expectedOutput,
  inputs,
  executionStatus,
  verificationStatus,
  onCheckOutput,
  canCheckOutput,
}) {
  const inputContent = Array.isArray(inputs) ? inputs.join('\n') : inputs;
  const tabs = useMemo(() => [
    { id: 'output', label: 'Output' },
    { id: 'expected', label: 'Expected' },
    ...(inputContent ? [{ id: 'input', label: 'Input' }] : []),
    { id: 'errors', label: 'Errors', count: error ? 1 : 0 },
  ], [error, inputContent]);
  const [activeTab, setActiveTab] = useState('output');
  const status = isRunning ? 'running' : executionStatus;
  const stateTone = verificationStatus === 'mismatched' ? 'mismatch' : status;
  const statusLabel = {
    idle: 'Ready',
    running: 'Running',
    success: verificationStatus === 'matched' ? 'Output verified' : 'Completed',
    error: 'Failed',
  }[status] ?? 'Ready';

  useEffect(() => {
    if (status === 'error') setActiveTab('errors');
    else if (status === 'running' || status === 'success') setActiveTab('output');
  }, [status]);

  const tabContent = {
    output: isRunning ? 'Executing program…' : result || 'Run your program to see its output.',
    expected: expectedOutput || 'No expected output provided.',
    input: inputContent || 'No input is required.',
    errors: error || 'No execution errors.',
  }[activeTab];

  return (
    <section
      className={`console-window ide-results is-${stateTone}`}
      style={{ height, flexBasis: height }}
      aria-live="polite"
    >
      <div className="ide-result-tabs" role="tablist" aria-label="Compiler results">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`compiler-panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            key={tab.id}
          >
            {tab.label}
            {tab.count ? <span>{tab.count}</span> : null}
          </button>
        ))}
      </div>

      <div
        className={`ide-result-terminal${activeTab === 'errors' && error ? ' is-error' : ''}`}
        id={`compiler-panel-${activeTab}`}
        role="tabpanel"
        tabIndex="0"
      >
        <pre><code>{tabContent}</code></pre>
      </div>

      {verificationStatus === 'mismatched' ? (
        <p className="ide-verification-message is-mismatch">
          <CircleAlert size={ICON_SIZE.sm} aria-hidden="true" />
          Output does not match. Review Expected, edit your code, and run again.
        </p>
      ) : verificationStatus === 'matched' ? (
        <p className="ide-verification-message is-success">
          <CheckCircle2 size={ICON_SIZE.sm} aria-hidden="true" />
          Program output matches the expected result.
        </p>
      ) : null}

      <footer className="ide-result-footer">
        <div className="ide-runtime-status">
          <span className={`ide-status-dot is-${stateTone}`}>
            {status === 'running'
              ? <LoaderCircle className="result-spinner" size={ICON_SIZE.sm} aria-hidden="true" />
              : <i aria-hidden="true" />}
            {statusLabel}
          </span>
          <span>Exit <strong>{status === 'success' ? '0' : status === 'error' ? '1' : '—'}</strong></span>
          <span>Time <strong>{executionTimeMs === null ? '—' : `${executionTimeMs} ms`}</strong></span>
        </div>
        <button
          className="button button--secondary ide-check-button"
          type="button"
          onClick={onCheckOutput}
          disabled={!canCheckOutput}
        >
          <SearchCheck size={ICON_SIZE.sm} aria-hidden="true" />
          {verificationStatus === 'matched' ? 'Output Verified' : 'Check Output'}
        </button>
      </footer>
    </section>
  );
}
