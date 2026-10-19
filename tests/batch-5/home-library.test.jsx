import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_NAVIGATION } from '../../src/app-shell/navigation';
import { BrowseCoursesSection, ContinueLearningSection, RecentlyViewedSection } from '../../src/home/HomeSections';
import { LibraryPage, groupLibraryCourses } from '../../src/home/LibraryPage';
import { CourseCard } from '../../src/home/CourseCard';
import { browseCatalog } from '../../src/home/homeData';
import { learnerComingSoonCourses } from '../../src/home/learnerComingSoonCourses';
import { getCourseCardArtwork } from '../../src/home/courseCardArtwork';
import { createHomeLearningModel } from '../../src/home/homeLearningModel';
import { createRecentCourseRepository } from '../../src/home/recentCourseRepository';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';

const progressState = vi.hoisted(() => ({ records: [] }));
vi.mock('../../src/auth/UserContext', () => ({
  useUser: () => ({ user: { id: 'library-test-user' } }),
}));
vi.mock('../../src/progress/progressRepository', () => ({ progressRepository: { list: () => Promise.resolve(progressState.records) } }));

beforeEach(() => {
  progressState.records = [];
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(cleanup);

describe('Home learner state', () => {
  it('maps exactly six learner-only Coming Soon courses to existing card artwork', () => {
    expect(learnerComingSoonCourses.map(({ title }) => title)).toEqual([
      'C Programming', 'HTML Fundamentals for Webpage', 'CSS Fundamentals for Webpage',
      'Build Your Web App with React', 'React Beyond Basics', 'SQL Basics',
    ]);
    for (const course of learnerComingSoonCourses) {
      const artwork = getCourseCardArtwork(course.id);
      expect(artwork).toBe(`/assets/course-cards/${course.id}.png`);
      expect(existsSync(`public${artwork}`)).toBe(true);
    }
  });
  it('starts with zero enrollments and does not implicitly enroll Python', () => {
    const model = createHomeLearningModel();
    expect(model.enrollments).toEqual([]);
    expect(model.activeCourse).toBeNull();
    expect(model.statistics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'courses', value: '0' }),
      expect.objectContaining({ id: 'lessons', value: '0' }),
      expect.objectContaining({ id: 'challenges', value: '0' }),
    ]));
  });

  it('keeps a viewed course separate from enrollment and persists recent views', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const recent = createRecentCourseRepository(storage);
    recent.record('learner', 'python');
    const model = createHomeLearningModel({ recentCourseIds: recent.list('learner') });
    expect(model.recentlyViewed[0].id).toBe('python');
    expect(model.enrollments).toHaveLength(0);
  });

  it('selects recent enrollment and derives persisted completion and streak statistics', () => {
    const records = [
      { courseId: 'python', completion: 25, currentLesson: 'python-lesson', completedLessons: ['p1'], lastOpened: '2026-01-01T00:00:00Z' },
      { courseId: 'java', completion: 0, currentLesson: 'java-lesson', completedLessons: ['j1', 'j2'], lastOpened: '2026-02-01T00:00:00Z' },
    ];
    const restored = createHomeLearningModel({ progressRecords: records, challengesCompleted: 4 });
    expect(restored.activeCourse).toMatchObject({ id: 'java', progress: 0, currentLesson: 'java-lesson' });
    expect(restored.statistics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'courses', value: '2' }), expect.objectContaining({ id: 'lessons', value: '3' }), expect.objectContaining({ id: 'challenges', value: '4' }),
    ]));
    expect(createHomeLearningModel({ progressRecords: [{ courseId: 'python', completion: 140 }] }).activeCourse.progress).toBe(100);
  });

  it('renders the empty learning state and Library CTA without fabricated progress', () => {
    const browse = vi.fn();
    render(<ContinueLearningSection courses={[]} status="ready" onBrowseLibrary={browse} />);
    expect(screen.getByRole('heading', { name: 'Start a new course' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browse Library' }));
    expect(browse).toHaveBeenCalledOnce();
    expect(screen.queryByText('38%')).not.toBeInTheDocument();
  });

  it('shows all enrollments through a compact recency-ordered expandable grid', () => {
    const open = vi.fn();
    const courses = [
      { id: 'python', title: 'Python Foundations', currentLesson: 'python-lesson', progress: 25 },
      { id: 'java', title: 'Java Basics', currentLesson: 'java-lesson', progress: 10 },
      { id: 'web', title: 'Web Development', currentLesson: 'web-lesson', progress: 5 },
    ];
    render(<ContinueLearningSection courses={courses} status="ready" onOpenCourse={open} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByText('Web Development')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'View all' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: /Continue Learning/i })[0]);
    expect(open).toHaveBeenCalledWith('python', 'python-lesson');
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('does not show View all for one or two enrolled courses', () => {
    const { rerender } = render(<ContinueLearningSection courses={[{ id: 'python', title: 'Python Foundations' }]} status="ready" onOpenCourse={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
    rerender(<ContinueLearningSection courses={[{ id: 'python', title: 'Python Foundations' }, { id: 'java', title: 'Java Basics' }]} status="ready" onOpenCourse={vi.fn()} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
  });

  it('renders an honest Recently Viewed empty state', () => {
    render(<RecentlyViewedSection courses={[]} onOpenCourse={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'No recently viewed courses' })).toBeInTheDocument();
  });

  it('uses the shared Course card treatment in Recently Viewed without changing Continue Learning', () => {
    const course = { ...browseCatalog.languages[0], started: true, progress: 25 };
    const { container } = render(<>
      <RecentlyViewedSection courses={[course]} onOpenCourse={vi.fn()} />
      <ContinueLearningSection courses={[course]} status="ready" onOpenCourse={vi.fn()} />
    </>);
    const recent = container.querySelector('.home-recent .library-course-card');
    expect(within(recent).getByText('Course')).toHaveClass('content-type-badge--course');
    expect(within(recent).getByText('Easy')).toHaveClass('difficulty-badge--easy');
    expect(recent.querySelector('.home-course-bookmark')).toBeNull();
    expect(within(recent).getByRole('img', { name: 'Course progress 25 percent' })).toBeInTheDocument();
    expect(container.querySelector('.home-continue-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue Learning/i })).toBeInTheDocument();
  });

  it('keeps course cards and empty states hidden while discovery is pending', () => {
    const { rerender } = render(<ContinueLearningSection courses={[]} status="loading" onBrowseLibrary={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading your courses' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Start a new course' })).not.toBeInTheDocument();
    rerender(<RecentlyViewedSection courses={[]} status="loading" onOpenCourse={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading recently viewed courses' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No recently viewed courses' })).not.toBeInTheDocument();
  });
});

describe('Library navigation and discovery', () => {
  it('shows a stable loading surface before canonical courses settle', () => {
    render(<LibraryPage onOpenCourse={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading course catalog' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Python Foundations' })).not.toBeInTheDocument();
  });

  it('uses bundled Course cards if canonical discovery fails', async () => {
    const priorFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('catalog unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<LibraryPage onOpenCourse={vi.fn()} />);
      expect(screen.getByRole('status', { name: 'Loading course catalog' })).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'Python Foundations' })).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading course catalog' })).not.toBeInTheDocument();
    } finally {
      globalThis.fetch = priorFetch;
      warn.mockRestore();
    }
  });
  it('supports /library routing and sidebar navigation', () => {
    expect(parseAppRoute('/library')).toEqual({ kind: 'page', page: 'library' });
    expect(routePath({ kind: 'page', page: 'library' })).toBe('/library');
    expect(APP_NAVIGATION).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'library', label: 'Library' })]));
  });

  it('preserves search, language filtering, available navigation, and coming-soon states', async () => {
    const open = vi.fn();
    render(<LibraryPage onOpenCourse={open} />);
    const discovery = screen.getByRole('region', { name: 'Browse courses' }).querySelector('.home-discovery-bar');
    expect(discovery).toContainElement(screen.getByLabelText('Course filters'));
    expect(discovery).toContainElement(screen.getByRole('searchbox', { name: 'Search courses' }));
    expect(screen.queryByRole('group', { name: 'Browse courses by' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All Domains' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Browse Courses' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse courses' })).toBeInTheDocument();
    expect(screen.queryByText('Explore')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Courses' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('heading', { name: 'Python' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Java' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(screen.getByRole('heading', { name: 'Python' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Java' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: 'Python' } });
    fireEvent.click(screen.getByRole('heading', { name: 'Python Foundations' }).closest('article'));
    expect(open).toHaveBeenCalledWith('python');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: 'no matching course' } });
    expect(screen.getByRole('heading', { name: 'No courses found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Python' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(screen.queryByRole('heading', { name: 'C' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming Soon' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'C Programming' }).closest('article')).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders available language groups after a single Coming Soon section and preserves the normal grid', async () => {
    const { container } = render(<LibraryPage onOpenCourse={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Python' });
    const chips = within(screen.getByLabelText('Course filters')).getAllByRole('button');
    expect(chips[0]).toHaveTextContent('All Courses');
    expect(chips.slice(1).map((chip) => chip.textContent)).toEqual(['Python', 'Java', 'C', 'HTML', 'CSS', 'React', 'SQL']);
    const sections = container.querySelectorAll('.library-language-section');
    expect(sections).toHaveLength(3);
    expect(sections[0]).toHaveClass('library-coming-soon-section');
    expect(sections[1]).toHaveAttribute('aria-labelledby', 'library-language-python');
    expect(sections[2]).toHaveAttribute('aria-labelledby', 'library-language-java');
    expect(within(sections[0]).getByRole('region', { name: 'Coming soon courses' })).toHaveClass('library-coming-soon-strip');
    expect(within(sections[0]).getByRole('region', { name: 'Coming soon courses' })).toHaveAttribute('tabindex', '0');
    expect([...sections[0].querySelectorAll('.library-course-card h3')].map((heading) => heading.textContent)).toEqual([
      'C Programming', 'HTML Fundamentals for Webpage', 'CSS Fundamentals for Webpage',
      'Build Your Web App with React', 'React Beyond Basics', 'SQL Basics',
    ]);
    expect(screen.queryByRole('heading', { name: 'Rust Essentials' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'C++ Essentials' })).not.toBeInTheDocument();
    for (const card of sections[0].querySelectorAll('.library-course-card')) {
      expect(card).toHaveAttribute('aria-disabled', 'true');
      expect(card.querySelector('.card-footer-coming-soon')).toHaveTextContent('Coming Soon');
      expect(card.querySelector('.library-course-meta, .library-course-progress')).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'C++' })).not.toBeInTheDocument();
    const css = readFileSync('src/styles/pages/home.css', 'utf8');
    expect(css).toMatch(/\.library-language-course-grid \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 14\.8125rem\)\)/);
    expect(css).toMatch(/\.library-coming-soon-strip \{[\s\S]*?grid-auto-flow: column;[\s\S]*?grid-auto-columns: 14\.8125rem;[\s\S]*?overflow-x: auto;[\s\S]*?overflow-y: hidden/);
    expect(css).toMatch(/\.library-coming-soon-strip \.home-course-card\.is-list\.library-course-card:hover,[\s\S]*?\.library-coming-soon-strip \.home-course-card\.is-list\.library-course-card:focus-visible \{\s*transform: none;/);
    expect(css).toMatch(/\.library-coming-soon-strip \{[\s\S]*?padding: \.25rem \.25rem var\(--space-2\)/);
    expect(css).toMatch(/@media \(max-width: 1200px\)[\s\S]*?\.library-language-course-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.library-language-course-grid[\s\S]*?grid-template-columns: 1fr/);
    expect(css).toMatch(/\.library-language-section \{[\s\S]*?background: var\(--color-surface\);[\s\S]*?border: 1px solid var\(--color-border\)/);
    expect(css).toMatch(/\.library-course-artwork img \{[\s\S]*?object-fit: contain/);
    expect(css).toMatch(/\.library-course-artwork \{[\s\S]*?width: min\(7\.5rem, 100%\);[\s\S]*?height: 7\.5rem/);
    expect(screen.getByRole('heading', { name: 'Python' }).querySelector('img')).toHaveAttribute('src', '/assets/languages/python.svg');
    expect(screen.getByRole('heading', { name: 'Java' }).querySelector('img')).toHaveAttribute('src', '/assets/languages/java.svg');
    expect(screen.queryByRole('heading', { name: 'SQL' })).not.toBeInTheDocument();
    expect(css).toMatch(/\.library-language-logo \{[\s\S]*?object-fit: contain/);
    const progressCss = readFileSync('src/styles/components/progress-circle.css', 'utf8');
    expect(progressCss).toMatch(/\.library-course-progress-value \{[\s\S]*?font-size: 1\.625rem;[\s\S]*?line-height: 1/);
    expect(css).toMatch(/\.library-course-card>h3 \{[\s\S]*?-webkit-line-clamp: 2/);
  });

  it('groups unavailable courses once in source order without changing available language order or card navigation', () => {
    const courses = [
      { id: 'python', title: 'Python Foundations', filter: 'Python', kind: 'languages', available: true },
      { id: 'cpp-soon', title: 'C++ Essentials', filter: 'C++', kind: 'languages', available: false },
      { id: 'java', title: 'Java Basics', filter: 'Java', kind: 'languages', available: true },
      { id: 'cpp-ready', title: 'C++ Advanced', filter: 'C++', kind: 'languages', available: true },
      { id: 'js-soon', title: 'JavaScript Essentials', filter: 'JavaScript', kind: 'languages', available: false },
    ];
    const languages = ['Python', 'Java', 'C++', 'JavaScript'];
    const grouped = groupLibraryCourses(courses, languages, 'all', '');
    expect(grouped.comingSoonCourses.map(({ id }) => id)).toEqual(['cpp-soon', 'js-soon']);
    expect(grouped.languageGroups.map(({ language }) => language)).toEqual(['Python', 'Java', 'C++']);
    expect(grouped.languageGroups[2].courses.map(({ id }) => id)).toEqual(['cpp-ready']);

    const open = vi.fn();
    const { container } = render(<BrowseCoursesSection {...grouped} languages={languages} activeLanguage="all" search="" onLanguageChange={vi.fn()} onSearchChange={vi.fn()} onOpenCourse={open} />);
    expect(container.querySelector('.library-language-section')).toHaveClass('library-coming-soon-section');
    expect(screen.getAllByRole('heading', { name: 'C++ Essentials' })).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Coming soon courses' })).getByRole('heading', { name: 'C++ Essentials' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'JavaScript' })).not.toBeInTheDocument();
    const unavailable = screen.getByRole('heading', { name: 'C++ Essentials' }).closest('article');
    expect(unavailable).toHaveAttribute('aria-disabled', 'true');
    expect(within(unavailable).getByText('Course')).toHaveClass('content-type-badge--course');
    expect(unavailable.querySelector('.home-course-bookmark')).toBeNull();
    fireEvent.click(unavailable);
    fireEvent.keyDown(unavailable, { key: 'Enter' });
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('heading', { name: 'C++ Advanced' }).closest('article'));
    expect(open).toHaveBeenCalledWith('cpp-ready');

    expect(groupLibraryCourses(courses, languages, 'C++', '').comingSoonCourses.map(({ id }) => id)).toEqual(['cpp-soon']);
    expect(groupLibraryCourses(courses, languages, 'C++', '').languageGroups.map(({ language }) => language)).toEqual(['C++']);
    expect(groupLibraryCourses(courses, languages, 'all', 'javascript').comingSoonCourses.map(({ id }) => id)).toEqual(['js-soon']);
    expect(groupLibraryCourses(courses, languages, 'all', 'javascript').languageGroups).toEqual([]);
    expect(groupLibraryCourses(courses, languages, 'all', 'missing')).toEqual({ comingSoonCourses: [], languageGroups: [] });
  });

  it('places non-Python and non-Java Coming Soon courses first while preserving source order within each group', () => {
    const courses = [
      { id: 'py-a', title: 'Python A', filter: 'Python', available: false },
      { id: 'cpp', title: 'C++', filter: 'C++', available: false },
      { id: 'java-a', title: 'Java A', filter: 'Java', available: false },
      { id: 'javascript', title: 'JavaScript', filter: 'JavaScript', available: false },
      { id: 'py-b', title: 'Python B', filter: 'Python', available: false },
      { id: 'java-b', title: 'Java B', filter: 'Java', available: false },
    ];
    expect(groupLibraryCourses(courses, ['Python', 'Java', 'C++', 'JavaScript'], 'all', '').comingSoonCourses.map(({ id }) => id))
      .toEqual(['cpp', 'javascript', 'py-a', 'py-b', 'java-a', 'java-b']);
  });

  it('omits an empty Coming Soon section and retains the normal grid', () => {
    const languages = ['Python'];
    const grouped = groupLibraryCourses([{ id: 'python', title: 'Python Foundations', filter: 'Python', available: true }], languages, 'all', '');
    const { container } = render(<BrowseCoursesSection {...grouped} languages={languages} activeLanguage="all" search="" onLanguageChange={vi.fn()} onSearchChange={vi.fn()} onOpenCourse={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Coming Soon' })).not.toBeInTheDocument();
    expect(container.querySelector('.library-language-course-grid')).toBeInTheDocument();
    expect(container.querySelector('.library-coming-soon-strip')).not.toBeInTheDocument();
  });

  it('uses the generic code icon fallback for an unmapped language', () => {
    render(<BrowseCoursesSection
      languageGroups={[{ language: 'UnknownLang', courses: [] }]}
      languages={['UnknownLang']}
      activeLanguage="all"
      search=""
      onLanguageChange={vi.fn()}
      onSearchChange={vi.fn()}
      onOpenCourse={vi.fn()}
    />);
    expect(screen.getByRole('heading', { name: 'UnknownLang' }).querySelector('svg')).toHaveClass('lucide-code-xml');
  });

  it.each([
    ['python', 'Python Foundations'],
    ['java', 'Java Basics'],
    ['languages-cplusplus', 'C++ Essentials'],
  ])('does not use temporary local artwork for %s', (id, title) => {
    const course = browseCatalog.languages.find((entry) => entry.id === id);
    expect(course?.title).toBe(title);
    const { container } = render(<CourseCard course={course} onOpenCourse={vi.fn()} variant="list" allowBookmark={false} />);
    expect(container.querySelector('.library-course-artwork img')?.getAttribute('src') ?? '').not.toContain('/testimage/');
  });

  it.each([
    ['Easy', 'easy'], ['Intermediate', 'medium'], ['Advanced', 'hard'],
  ])('renders Course and %s badges using shared pill styles', (level, modifier) => {
    const course = { ...browseCatalog.languages[0], level };
    const { container } = render(<CourseCard course={course} onOpenCourse={vi.fn()} variant="list" />);
    expect(screen.getByText('Course')).toHaveClass('difficulty-badge', 'content-type-badge', 'content-type-badge--course');
    expect(container.querySelector(`.difficulty-badge--${modifier}`)).toBeInTheDocument();
    expect(container.querySelector('.library-course-card-header')).not.toContainElement(container.querySelector('.home-course-bookmark'));
    expect(screen.queryByRole('button', { name: /bookmark|sign in to save/i })).not.toBeInTheDocument();
  });

  it('omits an unknown or missing difficulty without inventing a badge', () => {
    const course = { ...browseCatalog.languages[0], level: undefined, difficulty: undefined };
    const { container } = render(<CourseCard course={course} onOpenCourse={vi.fn()} variant="list" />);
    expect(container.querySelectorAll('.library-course-card-header .difficulty-badge')).toHaveLength(1);
  });

  it('keeps the progress circle on the divider and shares 40px, 12px footer metadata', () => {
    const css = readFileSync('src/styles/pages/home.css', 'utf8');
    const progressCss = readFileSync('src/styles/components/progress-circle.css', 'utf8');
    const footerCss = readFileSync('src/styles/components/card-footer.css', 'utf8');
    expect(css).toMatch(/\.library-course-divider\s*\{[^}]*top:\s*1\.25rem/);
    expect(progressCss).toMatch(/\.library-course-progress\s*\{[^}]*top:\s*-0\.3125rem;[^}]*width:\s*3\.125rem;[^}]*height:\s*3\.125rem/);
    expect(footerCss).toMatch(/\.card-footer-meta\s*\{[^}]*justify-content:\s*flex-start;[^}]*flex-wrap:\s*nowrap;[^}]*gap:\s*var\(--space-2\);[^}]*padding-top:\s*2\.5rem;[^}]*font-size:\s*\.75rem/);
    expect(footerCss).toMatch(/\.card-footer-meta svg\s*\{[^}]*width:\s*var\(--icon-xs\);[^}]*height:\s*var\(--icon-xs\)/);
    expect(css).toMatch(/\.home-recent-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.home-dashboard-grid \.home-recent\s*\{\s*grid-area:\s*recent/);
  });

  it('renders a footer-only, non-interactive Coming Soon Course even with stale progress data', () => {
    const open = vi.fn();
    const course = { id: 'languages-cplusplus', title: 'C++ Essentials', duration: '12h', lessonCount: 18, available: false, started: true, progress: 35 };
    const { container } = render(<CourseCard course={course} onOpenCourse={open} variant="list" />);
    const card = container.querySelector('.library-course-card');
    const footer = card.querySelector('.library-course-card-footer');
    expect(footer).toHaveTextContent('Coming Soon');
    expect(footer.querySelector('.card-footer-coming-soon')).toBeInTheDocument();
    expect(footer.querySelector('.library-course-meta, .library-course-progress, button')).toBeNull();
    expect(footer).not.toHaveTextContent('12h');
    expect(footer).not.toHaveTextContent('18 lessons');
    expect(card).not.toHaveAttribute('role', 'link');
    expect(card).not.toHaveAttribute('tabindex');
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(open).not.toHaveBeenCalled();
  });

  it('retains metadata and progress for an available Course card', () => {
    const course = { id: 'python', title: 'Python Foundations', duration: '12h', lessonCount: 18, available: true, started: true, progress: 35 };
    const { container } = render(<CourseCard course={course} onOpenCourse={vi.fn()} variant="list" />);
    const footer = container.querySelector('.library-course-card-footer');
    expect(footer.querySelector('.library-course-meta.card-footer-meta')).toHaveTextContent('12h18 lessons');
    expect(screen.getByRole('img', { name: 'Course progress 35 percent' })).toBeInTheDocument();
    expect(footer.querySelector('.card-footer-coming-soon')).toBeNull();
  });

  it('uses only matched supplied Course artwork and leaves other cards free of letter placeholders', () => {
    for (const [id, path] of [
      ['python', '/assets/course-cards/python-basics.png'],
      ['java', '/assets/course-cards/java-basics.png'],
      ['practical-git-and-github', '/assets/course-cards/git.png'],
      ['ai-prompt-tutorial', '/assets/course-cards/ai-prompt-tutorial.png'],
    ]) {
      const { container, unmount } = render(<CourseCard course={{ id, title: id, duration: '1h', lessonCount: 1, available: true }} onOpenCourse={vi.fn()} variant="list" />);
      expect(container.querySelector('.library-course-artwork img')).toHaveAttribute('src', path);
      unmount();
    }
    const { container } = render(<CourseCard course={{ id: 'languages-cplusplus', title: 'C++ Essentials', filter: 'C++', duration: '1h', lessonCount: 1, available: false }} onOpenCourse={vi.fn()} variant="list" />);
    expect(container.querySelector('.library-course-artwork')).toHaveClass('is-empty');
    expect(container.querySelector('.library-course-artwork img, .library-course-artwork span')).toBeNull();
  });

  it('uses canonical enrollment progress while whole-card navigation opens the overview', async () => {
    progressState.records = [{ courseId: 'python', completion: 25 }, { courseId: 'java', completion: 100 }];
    const open = vi.fn();
    render(<LibraryPage onOpenCourse={open} />);
    await screen.findByRole('heading', { name: 'Python Foundations' });
    const pythonCard = screen.getByRole('heading', { name: 'Python Foundations' }).closest('article');
    await waitFor(() => expect(within(pythonCard).getByRole('img', { name: 'Course progress 25 percent' })).toBeInTheDocument());
    expect(within(pythonCard).queryByRole('button', { name: /Continue/i })).not.toBeInTheDocument();
    expect(within(pythonCard).queryByRole('button', { name: 'Bookmark course' })).not.toBeInTheDocument();
    fireEvent.click(pythonCard);
    expect(open).toHaveBeenCalledWith('python');
    const javaCard = screen.getByRole('heading', { name: 'Java Basics' }).closest('article');
    expect(within(javaCard).getByRole('img', { name: 'Course progress 100 percent' })).toBeInTheDocument();
    expect(within(javaCard).queryByRole('button', { name: /Review/i })).not.toBeInTheDocument();
    fireEvent.keyDown(javaCard, { key: 'Enter' });
    expect(open).toHaveBeenCalledWith('java');
  });

  it.each([0, 25, 50, 75, 100])('renders %i percent with one shared wave clip for fill and contrast text', (progress) => {
    const course = { id: `wave-${progress}`, filter: 'Test', kind: 'languages', title: `Wave ${progress}`, duration: '1h', lessonCount: 4, progress, started: true, available: true };
    const { container } = render(<CourseCard course={course} onOpenCourse={vi.fn()} variant="list" />);
    const indicator = screen.getByRole('img', { name: `Course progress ${progress} percent` });
    const path = indicator.querySelector('clipPath path');
    expect(path).toHaveAttribute('d', progress === 0 ? 'M0 100 H100 V100 H0 Z' : progress === 100 ? 'M0 0 H100 V100 H0 Z' : expect.stringContaining(`M0 ${100 - progress}`));
    expect(indicator.querySelectorAll('.library-course-progress-value')).toHaveLength(2);
    expect(container.querySelector('.library-course-progress-fill')).toBeInTheDocument();
  });

  it('hides progress for a never-started course but preserves explicit started-at-zero state', () => {
    const course = { id: 'progress-state', filter: 'Test', kind: 'languages', title: 'Progress state', duration: '1h', lessonCount: 4, progress: 0, available: true };
    const { rerender } = render(<CourseCard course={course} onOpenCourse={vi.fn()} variant="list" allowBookmark={false} />);
    expect(screen.queryByRole('img', { name: 'Course progress 0 percent' })).not.toBeInTheDocument();
    rerender(<CourseCard course={{ ...course, started: true }} onOpenCourse={vi.fn()} variant="list" allowBookmark={false} />);
    expect(screen.getByRole('img', { name: 'Course progress 0 percent' })).toBeInTheDocument();
  });
});
