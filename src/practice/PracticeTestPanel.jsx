import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  LoaderCircle,
  SearchCheck,
  TerminalSquare,
} from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

function formatValue(value) {
  if (typeof value === 'string') return value || '""';
  if (value === undefined) return '—';
  return JSON.stringify(value);
}

function parameterNames(signature = '') {
  const parameters = signature.match(/\((.*)\)/)?.[1] ?? '';
  return parameters
    .split(',')
    .map((parameter) => parameter.trim().split(/[=:]/)[0]?.trim())
    .filter(Boolean);
}

export function PracticeTestPanel({
  height,
  tests,
  contract,
  result,
  error,
  isRunning,
  executionTimeMs,
  expectedOutput,
  executionStatus,
  verificationStatus,
  onCheckOutput,
  canCheckOutput,
}) {
  const [activeTab, setActiveTab] = useState('testcase');
  const [selectedCase, setSelectedCase] = useState(0);
  const names = useMemo(() => parameterNames(contract?.signature), [contract?.signature]);
  const publicTests = tests ?? [];
  const test = publicTests[selectedCase] ?? null;
  const status = isRunning ? 'running' : executionStatus;
  const tone = verificationStatus === 'mismatched' ? 'mismatch' : status;

  useEffect(() => {
    if (status === 'running' || status === 'success' || status === 'error') {
      setActiveTab('result');
    }
  }, [status]);

  return (
    <section
      className={`console-window practice-test-panel is-${tone}`}
      style={{ height, flexBasis: height }}
      aria-live="polite"
    >
      <div className="practice-test-tabs" role="tablist" aria-label="Practice test workspace">
        <button
          className={activeTab === 'testcase' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'testcase'}
          aria-controls="practice-testcase-panel"
          onClick={() => setActiveTab('testcase')}
        >
          <FlaskConical size={ICON_SIZE.sm} aria-hidden="true" /> Testcase
        </button>
        <button
          className={activeTab === 'result' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'result'}
          aria-controls="practice-result-panel"
          onClick={() => setActiveTab('result')}
        >
          <TerminalSquare size={ICON_SIZE.sm} aria-hidden="true" /> Test Result
        </button>
      </div>

      {activeTab === 'testcase' ? (
        <div className="practice-test-content" id="practice-testcase-panel" role="tabpanel" tabIndex="0">
          {publicTests.length ? (
            <>
              <div className="practice-case-tabs" role="tablist" aria-label="Public test cases">
                {publicTests.map((publicTest, index) => (
                  <button
                    className={selectedCase === index ? 'is-active' : ''}
                    type="button"
                    role="tab"
                    aria-selected={selectedCase === index}
                    onClick={() => setSelectedCase(index)}
                    key={`${publicTest.name ?? 'case'}-${index}`}
                  >
                    {publicTest.name || `Case ${index + 1}`}
                  </button>
                ))}
              </div>
              <div className="practice-case-values">
                {(test?.arguments ?? []).map((value, index) => (
                  <label key={`${names[index] ?? 'argument'}-${index}`}>
                    <span>{names[index] || `Argument ${index + 1}`}</span>
                    <output>{formatValue(value)}</output>
                  </label>
                ))}
              </div>
            </>
          ) : <p className="practice-test-empty">No public test cases are available.</p>}
        </div>
      ) : (
        <div className="practice-result-content" id="practice-result-panel" role="tabpanel" tabIndex="0">
          <div className={`practice-result-summary is-${tone}`}>
            {isRunning ? <LoaderCircle className="result-spinner" aria-hidden="true" />
              : status === 'error' || verificationStatus === 'mismatched' ? <CircleAlert aria-hidden="true" />
                : <CheckCircle2 aria-hidden="true" />}
            <span>
              <strong>{isRunning ? 'Running' : status === 'error' ? 'Execution error' : verificationStatus === 'matched' ? 'Accepted' : verificationStatus === 'mismatched' ? 'Output mismatch' : status === 'success' ? 'Run completed' : 'Ready to run'}</strong>
              <small>{isRunning ? 'Your Python code is being evaluated.' : 'Latest execution result'}</small>
            </span>
          </div>
          <div className="practice-result-values">
            {error ? <ResultValue label="Error" value={error} tone="error" /> : null}
            <ResultValue label="Your output" value={isRunning ? 'Executing program…' : result || 'Run your code to see its output.'} />
            <ResultValue label="Expected" value={expectedOutput ?? 'No expected output provided.'} />
          </div>
        </div>
      )}

      <footer className="practice-test-footer">
        <div>
          <span className={`ide-status-dot is-${tone}`}><i aria-hidden="true" /> {isRunning ? 'Running' : status === 'error' ? 'Failed' : status === 'success' ? 'Completed' : 'Ready'}</span>
          <span>Time <strong>{executionTimeMs === null ? '—' : `${executionTimeMs} ms`}</strong></span>
        </div>
        <button className="button button--secondary ide-check-button" type="button" onClick={onCheckOutput} disabled={!canCheckOutput}>
          <SearchCheck size={ICON_SIZE.sm} aria-hidden="true" />
          {verificationStatus === 'matched' ? 'Output Verified' : 'Check Output'}
        </button>
      </footer>
    </section>
  );
}

function ResultValue({ label, value, tone = '' }) {
  return (
    <section className={tone ? `is-${tone}` : undefined}>
      <span>{label}</span>
      <pre><code>{value}</code></pre>
    </section>
  );
}
