import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn();
vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'learner-1', name: 'Test Learner', email: 'learner@example.test', avatar: null } }) }));
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => ({ signOut }) }));
vi.mock('../../src/theme/useApplicationTheme', () => ({ useApplicationTheme: () => ({ theme: 'light', brandTheme: 'blue', reducedMotion: false, toggleTheme: vi.fn() }) }));
vi.mock('../../src/activity/LearnerActivityContext', () => ({ useLearnerActivity: () => ({ status: 'ready', streak: { currentStreak: 0 }, completions: [] }) }));
vi.mock('../../src/public/PublicFooter', () => ({ PublicFooter: () => <footer /> }));

import { AppShell } from '../../src/app-shell/AppShell';

afterEach(cleanup);

describe('AppShell account navigation menu', () => {
  beforeEach(() => {
    signOut.mockClear();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: vi.fn(() => null), setItem: vi.fn() } });
  });

  it('keeps only primary destinations in expanded and collapsed sidebar modes', () => {
    const { container } = render(<AppShell activePage="home" onNavigate={vi.fn()}><p>Content</p></AppShell>);
    const sidebar = screen.getByRole('complementary', { name: 'Primary navigation' });
    for (const label of ['Home', 'Library', 'Practice', 'Challenges', 'Projects', 'Bookmarks', 'Certificates']) {
      expect(within(sidebar).getByRole('button', { name: label })).toBeInTheDocument();
    }
    for (const label of ['Referrals', 'Wallet', 'Settings']) {
      expect(within(sidebar).queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(container.querySelector('.application-sidebar')).toHaveClass('is-collapsed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('provides a first-class skip link to the focusable main region', () => {
    render(<AppShell activePage="home" onNavigate={vi.fn()}><p>Content</p></AppShell>);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#application-page');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'application-page');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('orders utility destinations before Sign out and reuses their existing icons', () => {
    render(<AppShell activePage="home" onNavigate={vi.fn()}><p>Content</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
    const menu = screen.getByRole('menu', { name: 'User menu' });
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent.trim())).toEqual(['Referrals', 'Wallet', 'Settings', 'Sign out']);
    for (const label of ['Referrals', 'Wallet', 'Settings', 'Sign out']) expect(within(menu).getByRole('menuitem', { name: label }).querySelector('svg')).toBeInTheDocument();
  });

  it.each(['referrals', 'wallet', 'settings'])('navigates to %s in the same app and closes the menu', (destination) => {
    const onNavigate = vi.fn();
    render(<AppShell activePage="home" onNavigate={onNavigate}><p>Content</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: destination[0].toUpperCase() + destination.slice(1) }));
    expect(onNavigate).toHaveBeenCalledWith(destination);
    expect(screen.queryByRole('menu', { name: 'User menu' })).not.toBeInTheDocument();
  });

  it('preserves Sign out behavior', () => {
    render(<AppShell activePage="home" onNavigate={vi.fn()}><p>Content</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('dismisses either popover outside, but not for clicks inside it', () => {
    render(<AppShell activePage="home" onNavigate={vi.fn()}><p>Content</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
    fireEvent.pointerDown(screen.getByRole('menu', { name: 'User menu' }));
    expect(screen.getByRole('menu', { name: 'User menu' })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText('Content'));
    expect(screen.queryByRole('menu', { name: 'User menu' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    const notifications = screen.getByRole('status', { name: '' });
    fireEvent.pointerDown(notifications);
    expect(screen.getByText("You’re all caught up.")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText('Content'));
    expect(screen.queryByText("You’re all caught up.")).not.toBeInTheDocument();
  });

  it('toggles triggers, keeps popovers exclusive, and closes them on Escape', () => {
    render(<AppShell activePage="home" onNavigate={vi.fn()}><p>Content</p></AppShell>);
    const profile = screen.getByRole('button', { name: 'Open user menu' });
    const notifications = screen.getByRole('button', { name: 'Notifications' });
    fireEvent.click(profile);
    expect(profile).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(notifications);
    fireEvent.click(notifications);
    expect(screen.queryByRole('menu', { name: 'User menu' })).not.toBeInTheDocument();
    expect(notifications).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(notifications);
    expect(notifications).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(profile);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(profile).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(notifications);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(notifications).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(notifications);
    fireEvent.pointerDown(profile);
    fireEvent.click(profile);
    expect(notifications).toHaveAttribute('aria-expanded', 'false');
    expect(profile).toHaveAttribute('aria-expanded', 'true');
  });
});
