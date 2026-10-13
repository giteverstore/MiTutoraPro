import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorState } from '../../src/errors/ErrorState.jsx';
import { RecoveryState } from '../../src/errors/ErrorBoundary.jsx';
import { CourseLoadState } from '../../src/components/CourseLoadState.jsx';

afterEach(cleanup);

describe('shared learner error states', () => {
  it('shows a full failure with a reference and preserves both recovery callbacks', () => {
    const retry = vi.fn();
    const leave = vi.fn();
    render(<RecoveryState title="The course workspace could not be displayed." description="Saved progress is unaffected." diagnosticId="error-safe-id" onRetry={retry} onLeave={leave} />);
    const state = screen.getByRole('alert');
    expect(state).toHaveClass('error-state--full');
    expect(within(state).getByRole('heading', { level: 1 })).toHaveTextContent('The course workspace could not be displayed.');
    expect(within(state).getByText('Reference: error-safe-id')).toBeInTheDocument();
    fireEvent.click(within(state).getByRole('button', { name: 'Try again' }));
    fireEvent.click(within(state).getByRole('button', { name: 'Go back' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(leave).toHaveBeenCalledOnce();
  });

  it('keeps panel failures within a panel and never displays a raw error object', () => {
    render(<RecoveryState title="The code workspace could not be displayed." description="Retry the compiler." diagnosticId="error-123" compact onRetry={() => {}} />);
    const state = screen.getByRole('alert');
    expect(state).toHaveClass('error-state--panel');
    expect(within(state).getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(state).not.toHaveTextContent('stack');
  });

  it('does not announce a static not-found page as an alert or invent a retry action', () => {
    render(<ErrorState title="Page not found" description="This link is invalid." kind="not-found" primaryAction={{ label: 'Return home', onClick: () => {} }} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('preserves link navigation for public not-found actions', () => {
    render(<ErrorState title="Page not found" primaryAction={{ label: 'Return home', href: '/' }} kind="not-found" />);
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
  });

  it('keeps the Course unavailable message separate from loading', () => {
    render(<CourseLoadState state="error" message="This course is coming soon." />);
    expect(screen.getByRole('heading', { name: 'Course unavailable' })).toBeInTheDocument();
    expect(screen.getByText('This course is coming soon.')).toBeInTheDocument();
  });

  it('distinguishes a missing Course from a load failure without leaking provider detail', () => {
    const { rerender } = render(<CourseLoadState state="error" error={{ code: 'content/not-found', message: 'private storage path' }} />);
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<CourseLoadState state="error" error={{ code: 'content/delivery-failed', message: 'Bearer secret-token' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Course could not be loaded');
    expect(screen.queryByText(/private storage path|secret-token/)).not.toBeInTheDocument();
  });
});
