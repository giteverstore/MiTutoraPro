import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
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
    const pageContent = main.querySelector('.application-page-content');
    expect(pageContent).toContainElement(screen.getByText('Home content'));
    expect(pageContent.nextElementSibling).toHaveClass('public-footer');
    expect(main.lastElementChild).toHaveClass('public-footer');
    expect(container.querySelectorAll('.public-footer')).toHaveLength(1);
    for (const name of ['About', 'Contact', 'Privacy Policy', 'Terms of Service', 'Refund Policy']) {
      expect(screen.getByRole('link', { name })).toBeVisible();
    }
  });

  it('keeps short routed content at least one available page viewport tall before the footer', () => {
    const css = readFileSync('src/styles/layout/app-shell.css', 'utf8');
    expect(css).toMatch(/\.application-shell\s*\{[\s\S]*?height:\s*100dvh;/);
    expect(css).toMatch(/\.application-page-content\s*\{[^}]*min-height:\s*100%;[^}]*flex:\s*0 0 auto;/);
    expect(css).toMatch(/\.application-page>\.public-footer\s*\{[^}]*flex:\s*0 0 auto;/);
  });

  it('uses the compact desktop shell tokens without shrinking the mobile topbar', () => {
    const tokens = readFileSync('src/design-system/tokens.css', 'utf8');
    const css = readFileSync('src/styles/layout/app-shell.css', 'utf8');
    expect(tokens).toContain('--layout-topbar-height: 3.75rem;');
    expect(tokens).toContain('--layout-sidebar-width-collapsed: 3.75rem;');
    expect(tokens).toContain('--layout-topbar-height-mobile: 4.125rem;');
    expect(css).toContain('--application-sidebar-width: var(--layout-sidebar-width-collapsed);');
    expect(css).toMatch(/\.application-sidebar\.is-collapsed \.application-navigation button,[\s\S]*?min-height:\s*2\.625rem;/);
    expect(css).toMatch(/\.application-sidebar\.is-collapsed \.application-sidebar-toggle\s*\{[^}]*width:\s*2\.625rem;/);
    expect(css).toMatch(/\.application-icon-button\s*\{[^}]*width:\s*2\.375rem;[^}]*height:\s*2\.375rem;/);
  });

  it('keeps every section of a long routed page inside one unit before the footer', () => {
    const { container } = render(
      <AppShell activePage="home" onNavigate={vi.fn()}>
        <section>Section A</section>
        <section>Section B</section>
        <section>Section C</section>
      </AppShell>,
    );
    const main = container.querySelector('.application-page');
    const pageContent = main.firstElementChild;
    expect([...pageContent.children].map((element) => element.textContent)).toEqual(['Section A', 'Section B', 'Section C']);
    expect(pageContent.nextElementSibling).toHaveClass('public-footer');
    expect(main.lastElementChild).toHaveClass('public-footer');
  });

  it('omits the footer when the owning route selects an immersive experience', () => {
    render(<AppShell activePage="practice" onNavigate={vi.fn()} showFooter={false}><section>Practice question</section></AppShell>);
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
