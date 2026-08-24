import { Component, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

function createDiagnosticId() {
  return `error-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, diagnosticId: null };
  }

  static getDerivedStateFromError(error) {
    return { error, diagnosticId: createDiagnosticId() };
  }

  componentDidCatch(error, info) {
    this.props.onError?.({ error, info, diagnosticId: this.state.diagnosticId });
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary:${this.props.name ?? 'application'}]`, error, info);
    }
  }

  componentDidUpdate(previousProps) {
    if (!this.state.error) return;
    const previousKeys = previousProps.resetKeys ?? [];
    const nextKeys = this.props.resetKeys ?? [];
    if (nextKeys.some((key, index) => !Object.is(key, previousKeys[index]))) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null, diagnosticId: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (typeof this.props.fallback === 'function') {
      return this.props.fallback({
        error: this.state.error,
        diagnosticId: this.state.diagnosticId,
        reset: this.reset,
      });
    }
    return this.props.fallback ?? null;
  }
}

export function RecoveryState({
  title = 'Something went wrong.',
  description = 'This area could not be displayed. Your other work is still available.',
  diagnosticId,
  onRetry,
  onLeave,
  retryLabel = 'Try again',
  leaveLabel = 'Go back',
  compact = false,
}) {
  return (
    <section
      className={`error-recovery ${compact ? 'error-recovery--compact' : ''}`}
      role="alert"
      aria-labelledby={`error-title-${diagnosticId}`}
      tabIndex="-1"
      ref={(element) => element?.focus()}
    >
      <AlertTriangle aria-hidden="true" />
      <div>
        <h1 id={`error-title-${diagnosticId}`}>{title}</h1>
        <p>{description}</p>
        {diagnosticId ? <small>Reference: {diagnosticId}</small> : null}
        <div className="error-recovery__actions">
          <button className="button button--primary" type="button" onClick={onRetry}>
            <RefreshCcw aria-hidden="true" /> {retryLabel}
          </button>
          {onLeave ? <button className="button button--secondary" type="button" onClick={onLeave}>{leaveLabel}</button> : null}
        </div>
      </div>
    </section>
  );
}

export function DomainErrorBoundary({
  name,
  title,
  description,
  onLeave,
  resetKeys,
  compact = false,
  children,
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ErrorBoundary
      key={attempt}
      name={name}
      resetKeys={resetKeys}
      fallback={({ diagnosticId }) => (
        <RecoveryState
          title={title}
          description={description}
          diagnosticId={diagnosticId}
          compact={compact}
          onRetry={() => setAttempt((value) => value + 1)}
          onLeave={onLeave}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export function GlobalErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      name="global"
      fallback={({ diagnosticId, reset }) => (
        <main className="global-error-page" data-theme="light">
          <RecoveryState
            title="MiTutora could not continue."
            description="Reload the application to restore your workspace. Saved progress will remain available."
            diagnosticId={diagnosticId}
            onRetry={() => window.location.reload()}
            onLeave={reset}
            leaveLabel="Try without reloading"
          />
        </main>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
