import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainErrorBoundary, ErrorBoundary } from '../../src/errors/ErrorBoundary';

function Broken({ fail = true }) {
  if (fail) throw new Error('injected render failure');
  return <p>Recovered content</p>;
}

describe('application error boundaries', () => {
  afterEach(() => vi.restoreAllMocks());

  it('contains a child render failure without destroying surrounding UI', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <nav>Persistent navigation</nav>
        <ErrorBoundary fallback={<p role="alert">Area unavailable</p>}>
          <Broken />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('Persistent navigation')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Area unavailable');
  });

  it('retries a failed domain without reloading unrelated state', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    function Recoverable() {
      if (fail) throw new Error('compiler failed');
      return <p>Compiler restored</p>;
    }
    render(
      <div>
        <p>Lesson remains mounted</p>
        <DomainErrorBoundary
          name="compiler-test"
          title="Compiler unavailable"
          description="Retry the compiler."
          compact
        >
          <Recoverable />
        </DomainErrorBoundary>
      </div>,
    );
    expect(screen.getByText('Lesson remains mounted')).toBeVisible();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Compiler restored')).toBeVisible();
    expect(screen.getByText('Lesson remains mounted')).toBeVisible();
  });

  it('keeps AppShell navigation available when Practice rendering fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <nav aria-label="Application navigation">Home Practice Settings</nav>
        <DomainErrorBoundary name="practice-test" title="Practice unavailable">
          <Broken />
        </DomainErrorBoundary>
      </div>,
    );
    expect(screen.getByRole('navigation', { name: 'Application navigation' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Practice unavailable' })).toBeVisible();
  });

  it('contains an exam render failure without corrupting sibling state', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <output aria-label="Unrelated state">Saved learner state</output>
        <DomainErrorBoundary name="exam-test" title="Exam unavailable">
          <Broken />
        </DomainErrorBoundary>
      </div>,
    );
    expect(screen.getByLabelText('Unrelated state')).toHaveTextContent('Saved learner state');
    expect(screen.getByRole('heading', { name: 'Exam unavailable' })).toBeVisible();
  });
});
