import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth/AuthService', () => ({ authService: {} }));

import { AuthProvider } from '../../src/auth/AuthProvider';
import { useAuth } from '../../src/auth/AuthContext';
import { MobileLoginNotice, MobileWorkspaceGuard } from '../../src/responsive/MobileAccessDialog';
import {
  MOBILE_LOGIN_NOTICE_DISMISSED_KEY,
  MOBILE_LOGIN_NOTICE_PENDING_KEY,
  MOBILE_PHONE_QUERY,
} from '../../src/responsive/mobileAccess';

function mockViewport(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === MOBILE_PHONE_QUERY ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function AuthActions() {
  const auth = useAuth();
  return <><button onClick={() => auth.signInWithEmail('learner@example.com', 'secret')}>Sign in</button><button onClick={auth.signOut}>Sign out</button></>;
}

describe('mobile authentication and workspace access', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    mockViewport(false);
  });

  it('owns successful logout navigation and returns to the landing page', async () => {
    const service = {
      onAuthStateChanged: vi.fn(() => () => {}),
      signInWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(async () => undefined),
      refreshUser: vi.fn(),
    };
    window.history.replaceState({}, '', '/courses/python/lesson/intro');
    render(<AuthProvider service={service}><AuthActions /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(service.signOut).toHaveBeenCalledOnce());
    expect(window.location.pathname).toBe('/');
    expect(window.location.pathname).not.toBe('/login');
  });

  it('shows the post-login guidance once per mobile session and dismisses accessibly', async () => {
    mockViewport(true);
    sessionStorage.setItem(MOBILE_LOGIN_NOTICE_PENDING_KEY, 'true');
    render(<MobileLoginNotice />);
    expect(await screen.findByRole('dialog', { name: 'Better on a laptop or PC' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue anyway' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(MOBILE_LOGIN_NOTICE_DISMISSED_KEY)).toBe('true');
  });

  it('does not show mobile guidance on desktop', async () => {
    sessionStorage.setItem(MOBILE_LOGIN_NOTICE_PENDING_KEY, 'true');
    render(<MobileLoginNotice />);
    await waitFor(() => expect(sessionStorage.getItem(MOBILE_LOGIN_NOTICE_PENDING_KEY)).toBeNull());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not mount a restricted course workspace on mobile and returns to its safe page', () => {
    mockViewport(true);
    const onClose = vi.fn();
    render(<MobileWorkspaceGuard kind="course" onClose={onClose}><div>Learning Engine mounted</div></MobileWorkspaceGuard>);
    expect(screen.queryByText('Learning Engine mounted')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Open this course on a laptop or PC' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('allows lightweight routes and desktop workspaces', () => {
    mockViewport(true);
    const { rerender } = render(<MobileWorkspaceGuard kind="project" restricted={false}><div>Project overview</div></MobileWorkspaceGuard>);
    expect(screen.getByText('Project overview')).toBeInTheDocument();
    mockViewport(false);
    rerender(<MobileWorkspaceGuard key="desktop" kind="project"><div>Project workspace</div></MobileWorkspaceGuard>);
    expect(screen.getByText('Project workspace')).toBeInTheDocument();
  });
});
