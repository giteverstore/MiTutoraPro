import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../../src/public/LandingPage';
import { PublicHeader } from '../../src/public/PublicHeader';
import { ProjectsPage } from '../../src/projects/pages/ProjectsPage';
import { PublicBrowseApplication } from '../../src/public/PublicBrowseApplication';

vi.mock('../../src/practice/practiceContentSource', () => ({
  practiceContentSource: {
    listCatalog: vi.fn().mockResolvedValue([{ id: 'question-one', title: 'Add two values', summary: 'Return the sum.', language: 'Python', difficulty: 'easy', topic: 'Functions', estimatedMinutes: 8 }]),
    listPage: vi.fn().mockResolvedValue({ items: [{ id: 'question-one', title: 'Add two values', summary: 'Return the sum.', language: 'Python', difficulty: 'easy', topic: 'Functions', estimatedMinutes: 8 }], cursor: null, hasMore: false, source: 'local', facets: { difficulties: ['easy'], topics: ['Functions'] } }),
  },
}));
vi.mock('../../src/routing/CourseRoute', () => ({
  CourseRoute: ({ anonymous, onEnterCourse }) => <section data-anonymous={anonymous}><h1>Shared Course Overview</h1><button type="button" onClick={onEnterCourse}>Start Course</button></section>,
}));

const session = new Map();
let notifyLandingIntersections;

function installLandingObserver() {
  notifyLandingIntersections = null;
  window.IntersectionObserver = class {
    constructor(callback) { notifyLandingIntersections = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function intersection(target, ratio, top = 100, height = 500) {
  return { target, isIntersecting: ratio > 0, intersectionRatio: ratio, boundingClientRect: { top, height } };
}

function showLandingSection(target, ratio = 0.8, top = 100, height = 500) {
  act(() => notifyLandingIntersections([intersection(target, ratio, top, height)]));
}
vi.stubGlobal('sessionStorage', {
  getItem: (key) => session.get(key) ?? null,
  setItem: (key, value) => session.set(key, value),
  removeItem: (key) => session.delete(key),
  clear: () => session.clear(),
});

beforeEach(() => {
  session.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.matchMedia;
  delete window.IntersectionObserver;
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

describe('public Y Coders landing page', () => {
  it('renders the public product journey without the authenticated shell', () => {
    const { container } = render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'From ‘I Understand’ to ‘I Built It!’' })).toBeVisible();
    expect(screen.getByText('From Beginner to Code Master With Y Coders')).toBeVisible();
    expect(screen.getByText('Learn. Build. Compete. Get Hired. With Y Coders.')).toBeVisible();
    const signIn = screen.getByRole('button', { name: 'Sign in' });
    expect(signIn).toBeVisible();
    expect(signIn.querySelector('img')).toHaveAttribute('src', '/assets/brands/google-g.svg');
    expect(container.querySelectorAll('.landing-hero-avatars img')).toHaveLength(5);
    expect(screen.getAllByRole('link', { name: /Explore Courses/ })[0]).toHaveAttribute('href', '/library');
    const coursesSection = container.querySelector('.landing-courses');
    const coursesCta = coursesSection.querySelector('.landing-courses-cta .button--primary');
    expect(coursesCta).toHaveAttribute('href', '/library');
    expect(coursesSection.querySelector('.landing-language-showcase').compareDocumentPosition(coursesCta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: /Explore Practice/ })).toHaveAttribute('href', '/practice');
    expect(container.querySelector('.landing-question-visual')).not.toBeInTheDocument();
    expect(screen.getByText('Practice topics include Arrays, Strings, Data Structures, SQL, and Debugging.')).toBeInTheDocument();
    expect(container.querySelector('.landing-practice-topic.is-incoming h3')).toHaveTextContent('Arrays');
    expect(container.querySelectorAll('.landing-practice-topic.is-incoming .difficulty-badge')).toHaveLength(3);
    expect(readFileSync('src/styles/pages/landing.css', 'utf8')).toMatch(/\.landing-practice-showcase\{[^}]*background:#fff/);
    expect(readFileSync('src/styles/pages/landing.css', 'utf8')).toMatch(/\.landing-practice-topic pre\{[^}]*background:#fff/);
    expect(screen.getByRole('link', { name: /Explore Projects/ })).toHaveAttribute('href', '/projects');
    expect(container.querySelector('.landing-courses h2 .accent')).toHaveTextContent('concept to code.');
    for (const removedEyebrow of ['Structured paths', 'Practice', 'Real-World Projects', 'Your AI Coding Mentor', 'How It Works']) {
      expect(screen.queryByText(removedEyebrow, { selector: '.landing-eyebrow, .landing-mentor-eyebrow' })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('img', { name: 'AI coding mentor helping a learner debug code' })).toHaveAttribute('src', '/assets/landing/ai-coding-mentor-illustration.png');
    expect(screen.getByRole('heading', { level: 3, name: 'How It Works' })).toBeVisible();
    expect(container.querySelectorAll('.landing-mentor-steps > li')).toHaveLength(3);
    expect(container.querySelector('.app-shell')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.landing-courses .landing-content-card')).toHaveLength(0);
    expect(screen.getByText('Languages available: Python, Java, C++, SQL, and HTML.')).toBeInTheDocument();
    expect(container.querySelector('.landing-language-logo .is-incoming')).toHaveAttribute('src', '/assets/languages/python.svg');
    expect(container.querySelector('.landing-hero-grid-highlight')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.landing-hero-headline-line')).toHaveLength(2);
    expect([...container.querySelectorAll('.landing-hero-prefix')].map((node) => node.textContent)).toEqual(['From', 'to']);
    expect([...container.querySelectorAll('.landing-hero-accent')].map((node) => node.textContent)).toEqual(['‘I Understand’', '‘I Built It!’']);
    for (const link of screen.getByRole('navigation', { name: 'Public navigation' }).querySelectorAll('a')) expect(link).toHaveClass('public-nav-link');
    expect(screen.getByRole('img', { name: 'Developer building a web project across multiple screens' })).toHaveAttribute('src', '/assets/landing/project-building-illustration.png');
    const mentor = container.querySelector('.landing-mentor');
    expect(mentor.firstElementChild).toHaveClass('landing-mentor-copy');
    expect(mentor.lastElementChild).toHaveClass('landing-mentor-illustration');
  });

  it('routes the AI Mentor CTA through the existing authentication boundary', () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Mentor/ }));
    expect(session.get('ycoders:auth-return')).toBe('/practice');
    expect(window.location.pathname).toBe('/login');
  });

  it('renders a semantic four-step journey and preserves the signup CTA boundary', () => {
    const { container } = render(<LandingPage />);
    const section = container.querySelector('.landing-how');
    expect(section.querySelectorAll('ol > li')).toHaveLength(4);
    expect(section.querySelectorAll('.landing-how-marker')).toHaveLength(4);
    const geometry = section.querySelector('.landing-how-geometry');
    expect(geometry).toHaveStyle({ aspectRatio: '2 / 1' });
    expect([...section.querySelectorAll('.landing-how-step')].map((step) => [step.dataset.cx, step.dataset.cy])).toEqual([['80', '390'], ['380', '280'], ['660', '190'], ['920', '90']]);
    expect([...section.querySelectorAll('.landing-how-point-dot')].map((point) => [point.getAttribute('cx'), point.getAttribute('cy')])).toEqual([['80', '390'], ['380', '280'], ['660', '190'], ['920', '90']]);
    expect(section.querySelector('.landing-how-path')).toHaveAttribute('viewBox', '0 0 1000 500');
    expect(section.querySelector('.landing-how-path path')).toHaveAttribute('d', 'M 80 390 C 175 430, 285 350, 380 280 C 475 210, 565 250, 660 190 C 755 130, 825 135, 920 90');
    expect([...section.querySelectorAll('.landing-how-step')].map((step) => step.dataset.placement)).toEqual(['below', 'below', 'below', 'below']);
    expect([...section.querySelectorAll('.landing-how-step')].map((step) => [step.dataset.labelOffsetX, step.dataset.labelOffsetY])).toEqual([['0', '28'], ['0', '28'], ['0', '28'], ['0', '28']]);
    expect(screen.getByRole('heading', { level: 3, name: 'Grow' })).toBeVisible();
    expect(section.querySelector('.landing-how-path')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { name: 'Learn. Practice. Build. Grow.' })).toBeVisible();
    fireEvent.click(section.querySelector('button'));
    expect(session.get('ycoders:auth-return')).toBe('/');
    expect(window.location.pathname).toBe('/signup');
  });

  it('reveals one How It Works description through pointer, click, focus, and keyboard input', () => {
    const { container } = render(<LandingPage />);
    const section = container.querySelector('.landing-how');
    const learn = screen.getByRole('button', { name: 'Learn — show details' });
    const practice = screen.getByRole('button', { name: 'Practice — show details' });
    const build = screen.getByRole('button', { name: 'Build — show details' });
    const grow = screen.getByRole('button', { name: 'Grow — show details' });
    const visibleDescriptions = () => section.querySelectorAll('.landing-how-step p.is-visible');

    expect(visibleDescriptions()).toHaveLength(0);
    expect(learn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.mouseEnter(practice);
    expect(practice).toHaveAttribute('aria-expanded', 'true');
    expect(visibleDescriptions()).toHaveLength(1);
    expect(visibleDescriptions()[0]).toHaveTextContent('Solve coding questions');
    fireEvent.mouseLeave(practice);
    expect(visibleDescriptions()).toHaveLength(0);

    fireEvent.click(learn);
    expect(learn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(practice);
    expect(learn).toHaveAttribute('aria-expanded', 'false');
    expect(visibleDescriptions()[0]).toHaveTextContent('Solve coding questions');
    fireEvent.focus(build);
    expect(visibleDescriptions()[0]).toHaveTextContent('Apply your skills');
    fireEvent.blur(build);
    expect(visibleDescriptions()[0]).toHaveTextContent('Solve coding questions');
    fireEvent.keyDown(grow, { key: 'Enter' });
    expect(grow).toHaveAttribute('aria-expanded', 'true');
    expect(visibleDescriptions()).toHaveLength(1);
    expect(visibleDescriptions()[0]).toHaveTextContent('Track your progress');
  });

  it('keeps How It Works marker selection functional with reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    const { container } = render(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Build — show details' }));
    expect(container.querySelectorAll('.landing-how-step p.is-visible')).toHaveLength(1);
    expect(container.querySelector('.landing-how-step p.is-visible')).toHaveTextContent('Apply your skills');
  });

  it('renders the final CTA independently from its decorative illustration', () => {
    const { container } = render(<LandingPage />);
    const section = container.querySelector('.landing-final-cta');
    expect(section.querySelector('h2')).toHaveTextContent('Learn to code withY Coders');
    expect(section.querySelector('.landing-final-cta-character')).toHaveAttribute('src', '/assets/landing/final-cta-characters.png');
    expect(section.querySelector('.landing-final-cta-character')).toHaveAttribute('alt', '');
    expect(section.querySelector('.landing-final-cta-wave')).toHaveAttribute('aria-hidden', 'true');
    expect(section.querySelectorAll('.landing-final-cta-wave path')).toHaveLength(2);
    fireEvent.click(section.querySelector('button'));
    expect(session.get('ycoders:auth-return')).toBe('/');
    expect(window.location.pathname).toBe('/signup');
  });

  it('publishes the public navigation and valid footer destinations', () => {
    const { container } = render(<LandingPage />);
    const headerNavigation = within(screen.getByRole('navigation', { name: 'Public navigation' }));
    for (const [name, href] of [['Courses', '/library'], ['Practice', '/practice'], ['Project', '/projects']]) {
      expect(headerNavigation.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    const footer = within(container.querySelector('.public-footer'));
    for (const [name, href] of [['About', '/about'], ['Contact', '/contact'], ['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Refund Policy', '/refund-policy']]) {
      expect(footer.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('opens an accessible Online Compilers menu with every public language route', () => {
    render(<PublicHeader />);
    const trigger = screen.getByRole('button', { name: 'Online Compilers' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const compilers = screen.getByLabelText('Online compilers');
    expect(within(compilers).getAllByRole('link')).toHaveLength(17);
    for (const [name, href] of [
      ['Python', 'https://compiler.ycoders.com/python'],
      ['C++', 'https://compiler.ycoders.com/cpp'],
      ['SQL', 'https://compiler.ycoders.com/sql'],
      ['MySQL', 'https://compiler.ycoders.com/mysql'],
      ['Go', 'https://compiler.ycoders.com/go'],
      ['Rust', 'https://compiler.ycoders.com/rust'],
    ]) expect(within(compilers).getByRole('link', { name })).toHaveAttribute('href', href);
  });

  it('closes Online Compilers on outside click, Escape, and language selection', () => {
    render(<div><PublicHeader /><button type="button">Outside</button></div>);
    const trigger = screen.getByRole('button', { name: 'Online Compilers' });
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('link', { name: 'Python' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps Online Compilers reachable through the mobile navigation control', () => {
    render(<PublicHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Online Compilers' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Online Compilers' }));
    expect(screen.getByLabelText('Online compilers')).not.toHaveAttribute('hidden');
  });

  it('preserves the intended destination when Login is requested', () => {
    render(<PublicHeader activePath="/projects" />);
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(session.get('ycoders:auth-return')).toBe('/projects');
    expect(window.location.pathname).toBe('/login');
  });

  it('gives Sign Up a visible blue default state without relying on hover', () => {
    const css = readFileSync('src/styles/pages/landing.css', 'utf8');
    expect(css).toMatch(/\.marketing-auth-actions \.button\{[^}]*background:var\(--color-accent\)/);
    expect(css).toMatch(/\.marketing-auth-actions \.button:hover\{[^}]*background:var\(--color-accent-hover\)/);
  });

  it('defines accessible nav underline and reduced-motion-safe hero grid interactions', () => {
    const css = readFileSync('src/styles/pages/landing.css', 'utf8');
    expect(css).toMatch(/\.public-nav-link::after\{[^}]*transform:scaleX\(0\)/);
    expect(css).toMatch(/\.public-nav-link:hover::after[^}]*\{transform:scaleX\(1\)/);
    expect(css).toMatch(/\.landing-hero-grid-highlight\{[^}]*pointer-events:none/);
    expect(css).toMatch(/\.landing-hero-grid\{[^}]*var\(--color-border\) 78%,var\(--color-surface\)/);
    expect(css).toMatch(/\.landing-hero-grid-highlight\{[^}]*linear-gradient\(var\(--color-accent\) 1\.5px/);
    expect(css).toMatch(/radial-gradient\(circle 190px at var\(--hero-pointer-x\) var\(--hero-pointer-y\)/);
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.landing-hero-grid-highlight\{display:none/);
  });

  it('switches the interactive lesson preview by click and keyboard', () => {
    const { container } = render(<LandingPage />);
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Code');
    fireEvent.click(screen.getByRole('tab', { name: 'SQL' }));
    expect(screen.getByRole('tab', { name: 'SQL' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('SQL');
    expect(screen.getByText('Query.sql')).toBeVisible();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'SQL' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Web' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Web');
    expect(screen.getByText('index.html')).toBeVisible();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(container.querySelector('.landing-feature-panel')).toContainElement(container.querySelector('.landing-showcase-layer.is-incoming'));
    expect(container.querySelector('.landing-showcase-layer.is-outgoing')).toHaveAttribute('aria-hidden', 'true');
  });

  it('auto-cycles after 3 seconds and resets the interval after a click', () => {
    vi.useFakeTimers();
    installLandingObserver();
    const { container } = render(<LandingPage />);
    showLandingSection(container.querySelector('.landing-building'));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('tab', { name: 'SQL' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Terminal' }));
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole('tab', { name: 'Terminal' })).toHaveAttribute('aria-selected', 'true');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
  });

  it('does not auto-cycle when reduced motion is preferred', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    vi.useFakeTimers();
    render(<LandingPage />);
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.landing-language-name')).toHaveTextContent('Python');
  });

  it('types, deletes, and advances the landing language showcase', () => {
    vi.useFakeTimers();
    installLandingObserver();
    const { container } = render(<LandingPage />);
    showLandingSection(container.querySelector('.landing-courses'));
    const advanceLanguage = (name, nextLogo) => {
      for (let index = 0; index < name.length; index += 1) act(() => vi.advanceTimersByTime(90));
      expect(container.querySelector('.landing-language-name')).toHaveTextContent(name);
      act(() => vi.advanceTimersByTime(1800));
      for (let index = 0; index < name.length; index += 1) act(() => vi.advanceTimersByTime(50));
      act(() => vi.advanceTimersByTime(0));
      expect(container.querySelector('.landing-language-logo .is-incoming')).toHaveAttribute('src', nextLogo);
    };

    advanceLanguage('Python', '/assets/languages/java.svg');
    advanceLanguage('Java', '/assets/languages/cplusplus.svg');
    advanceLanguage('C++', '/assets/languages/sql.svg');
    advanceLanguage('SQL', '/assets/languages/html5.svg');
    advanceLanguage('HTML', '/assets/languages/python.svg');
  });

  it('cleans up landing animation timers when it unmounts', () => {
    vi.useFakeTimers();
    installLandingObserver();
    const { container, unmount } = render(<LandingPage />);
    showLandingSection(container.querySelector('.landing-building'));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cycles all five public practice topics and returns to Arrays', () => {
    vi.useFakeTimers();
    installLandingObserver();
    const { container } = render(<LandingPage />);
    showLandingSection(container.querySelector('.landing-practice-showcase'));
    for (const topic of ['Strings', 'Data Structures', 'SQL', 'Debugging', 'Arrays']) {
      act(() => vi.advanceTimersByTime(4000));
      expect(container.querySelector('.landing-practice-topic.is-incoming h3')).toHaveTextContent(topic);
      act(() => vi.advanceTimersByTime(340));
    }
  });

  it('checks project features sequentially after the section enters view', () => {
    vi.useFakeTimers();
    installLandingObserver();
    const { container } = render(<LandingPage />);
    const items = [...container.querySelectorAll('.landing-project-features li')];
    expect(items).toHaveLength(4);
    expect(items.every((item) => !item.classList.contains('is-checked'))).toBe(true);
    showLandingSection(container.querySelector('.landing-project-features'));
    act(() => vi.advanceTimersByTime(399));
    expect(items.every((item) => !item.classList.contains('is-checked'))).toBe(true);
    for (let count = 1; count <= 4; count += 1) {
      act(() => vi.advanceTimersByTime(count === 1 ? 1 : 450));
      expect(items.filter((item) => item.classList.contains('is-checked'))).toHaveLength(count);
    }
    act(() => vi.advanceTimersByTime(10000));
    expect(items.every((item) => item.classList.contains('is-checked'))).toBe(true);
  });

  it('runs only the most visible landing animation and switches ownership', () => {
    vi.useFakeTimers();
    installLandingObserver();
    const { container } = render(<LandingPage />);
    const building = container.querySelector('.landing-building');
    const courses = container.querySelector('.landing-courses');

    act(() => notifyLandingIntersections([
      intersection(building, 0.6, 50),
      intersection(courses, 0.85, 120),
    ]));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('.landing-language-name').textContent.length).toBeGreaterThan(0);

    act(() => notifyLandingIntersections([
      intersection(building, 0.9, 100),
      intersection(courses, 0.55, 150),
    ]));
    const frozenLanguage = container.querySelector('.landing-language-name').textContent;
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('tab', { name: 'SQL' })).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('.landing-language-name')).toHaveTextContent(frozenLanguage);
  });

  it('pauses the active animation while the document is hidden', () => {
    vi.useFakeTimers();
    installLandingObserver();
    const { container } = render(<LandingPage />);
    showLandingSection(container.querySelector('.landing-building'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('tab', { name: 'SQL' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders every project feature checked immediately for reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll('.landing-project-features li.is-checked')).toHaveLength(4);
  });
});

describe('anonymous project browsing boundary', () => {
  it('allows project overview browsing but requests authentication before starting', () => {
    const onRequireAuth = vi.fn();
    render(<ProjectsPage browseOnly onRequireAuth={onRequireAuth} />);
    fireEvent.click(screen.getAllByRole('button', { name: /View Project/ })[0]);
    expect(screen.getByRole('heading', { level: 1, name: 'Simple Calculator' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Start Project' }));
    expect(onRequireAuth).toHaveBeenCalledWith('/projects');
  });
});

describe('public browse routing', () => {
  it('renders the shared Library page in the public shell without private navigation or progress', () => {
    window.history.replaceState({}, '', '/library');
    const { container } = render(<PublicBrowseApplication />);
    expect(container.querySelector('.library-main')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeVisible();
    expect(container.querySelector('.app-sidebar')).not.toBeInTheDocument();
    expect(container.querySelector('.library-course-progress')).not.toBeInTheDocument();
  });

  it('renders a Course Overview without private progress providers', async () => {
    window.history.replaceState({}, '', '/courses/python');
    render(<PublicBrowseApplication />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Shared Course Overview' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Start Course/ })).toBeVisible();
  });

  it('renders Practice metadata without anonymous learner statistics', async () => {
    window.history.replaceState({}, '', '/practice');
    render(<PublicBrowseApplication />);
    expect(await screen.findByText('Add two values')).toBeVisible();
    expect(screen.queryByText('Solved')).not.toBeInTheDocument();
    expect(screen.queryByText('Attempted')).not.toBeInTheDocument();
  });
});
