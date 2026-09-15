import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldShowApplicationFooter } from '../../src/app-shell/footerPolicy';

vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'learner-1', name: 'Learner' } }) }));
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('../../src/theme/useApplicationTheme', () => ({ useApplicationTheme: () => ({ theme: 'light', reducedMotion: false, toggleTheme: vi.fn() }) }));
vi.mock('../../src/activity/LearnerActivityContext', () => ({ useLearnerActivity: () => ({ completions: [] }) }));
vi.mock('../../src/app-shell/AppSidebar', () => ({ AppSidebar: () => <aside aria-label="Primary navigation" /> }));
vi.mock('../../src/app-shell/AppTopNavigation', () => ({ AppTopNavigation: () => <header>Application header</header> }));

import { AppShell } from '../../src/app-shell/AppShell';

const normalPages = ['home', 'practice', 'challenges', 'bookmarks', 'certificates', 'referrals', 'settings', 'projects', 'library'];

describe('global legal footer coverage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: vi.fn(() => null), setItem: vi.fn() },
    });
  });

  it.each(normalPages)('shows the footer policy on the normal %s AppShell page', (activePage) => {
    expect(shouldShowApplicationFooter({ activeCourseId: null, activePage, navigationTarget: null })).toBe(true);
  });

  it('excludes resource and course experiences from the AppShell footer', () => {
    expect(shouldShowApplicationFooter({ activeCourseId: null, activePage: 'practice', navigationTarget: { questionId: 'practice-1' } })).toBe(false);
    expect(shouldShowApplicationFooter({ activeCourseId: null, activePage: 'challenges', navigationTarget: { date: '2026-09-15' } })).toBe(false);
    expect(shouldShowApplicationFooter({ activeCourseId: 'python', activePage: 'library', navigationTarget: null })).toBe(false);
  });

  it('renders one shared semantic footer after normal AppShell content', () => {
    const { container } = render(<AppShell activePage="home" onNavigate={vi.fn()}><section>Home content</section></AppShell>);
    const main = container.querySelector('.application-page');
    expect(main.lastElementChild).toHaveClass('public-footer');
    expect(container.querySelectorAll('.public-footer')).toHaveLength(1);
    for (const name of ['About', 'Contact', 'Privacy', 'Terms', 'Refund Policy']) {
      expect(screen.getByRole('link', { name })).toBeVisible();
    }
  });

  it('omits the footer when the owning route selects an immersive experience', () => {
    render(<AppShell activePage="practice" onNavigate={vi.fn()} showFooter={false}><section>Practice question</section></AppShell>);
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
