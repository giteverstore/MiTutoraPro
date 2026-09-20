import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_NAVIGATION } from '../../src/app-shell/navigation';
import { BrowseCoursesSection, ContinueLearningSection, RecentlyViewedSection } from '../../src/home/HomeSections';
import { LibraryPage } from '../../src/home/LibraryPage';
import { CourseCard } from '../../src/home/CourseCard';
import { browseCatalog } from '../../src/home/homeData';
import { createHomeLearningModel } from '../../src/home/homeLearningModel';
import { createRecentCourseRepository } from '../../src/home/recentCourseRepository';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';

const progressState = vi.hoisted(() => ({ records: [] }));
vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'library-test-user' } }) }));
vi.mock('../../src/progress/progressRepository', () => ({ progressRepository: { list: () => Promise.resolve(progressState.records) } }));
vi.mock('../../src/bookmarks/BookmarkToggle', () => ({ BookmarkToggle: () => <button type="button" aria-label="Bookmark course" /> }));

beforeEach(() => {
  progressState.records = [];
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(cleanup);

describe('Home learner state', () => {
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
});

describe('Library navigation and discovery', () => {
  it('supports /library routing and sidebar navigation', () => {
    expect(parseAppRoute('/library')).toEqual({ kind: 'page', page: 'library' });
    expect(routePath({ kind: 'page', page: 'library' })).toBe('/library');
    expect(APP_NAVIGATION).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'library', label: 'Library' })]));
  });

  it('preserves search, language filtering, available navigation, and coming-soon states', () => {
    const open = vi.fn();
    render(<LibraryPage onOpenCourse={open} />);
    const discovery = screen.getByRole('region', { name: 'Browse courses' }).querySelector('.home-discovery-bar');
    expect(discovery).toContainElement(screen.getByLabelText('Language filters'));
    expect(discovery).toContainElement(screen.getByRole('searchbox', { name: 'Search courses' }));
    expect(screen.queryByRole('group', { name: 'Browse courses by' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All Domains' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Browse Courses' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse courses' })).toBeInTheDocument();
    expect(screen.queryByText('Explore')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Languages' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Python' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Rust' }));
    expect(screen.getByRole('heading', { name: 'Rust' })).toBeInTheDocument();
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rust Essentials' }).closest('article')).toHaveAttribute('aria-disabled', 'true');
  });

  it('derives one stable language block per catalog language and uses the responsive four-column grid', () => {
    const { container } = render(<LibraryPage onOpenCourse={vi.fn()} />);
    const chips = within(screen.getByLabelText('Language filters')).getAllByRole('button');
    expect(chips[0]).toHaveTextContent('All Languages');
    expect(chips.slice(1).map((chip) => chip.textContent)).toEqual(browseCatalog.languages.map((course) => course.filter));
    expect(container.querySelectorAll('.library-language-section')).toHaveLength(browseCatalog.languages.length);
    const css = readFileSync('src/styles/pages/home.css', 'utf8');
    expect(css).toMatch(/\.library-language-course-grid \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 1200px\)[\s\S]*?\.library-language-course-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.library-language-course-grid[\s\S]*?grid-template-columns: 1fr/);
    expect(css).toMatch(/\.library-language-section \{[\s\S]*?background: var\(--color-surface\);[\s\S]*?border: 1px solid var\(--color-border\)/);
    expect(css).toMatch(/\.library-course-artwork img \{[\s\S]*?object-fit: contain/);
    expect(css).toMatch(/\.library-course-artwork \{[\s\S]*?width: min\(7\.5rem, 100%\);[\s\S]*?height: 7\.5rem/);
    expect(screen.getByRole('heading', { name: 'Python' }).querySelector('img')).toHaveAttribute('src', '/assets/languages/python.svg');
    expect(screen.getByRole('heading', { name: 'Java' }).querySelector('img')).toHaveAttribute('src', '/assets/languages/java.svg');
    expect(screen.getByRole('heading', { name: 'SQL' }).querySelector('svg')).toBeInTheDocument();
    expect(css).toMatch(/\.library-language-logo \{[\s\S]*?object-fit: contain/);
    expect(css).toMatch(/\.library-course-progress-value \{[\s\S]*?font-size: 1\.625rem;[\s\S]*?line-height: 1/);
    expect(css).toMatch(/\.library-course-card>h3 \{[\s\S]*?-webkit-line-clamp: 2/);
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

  it('uses canonical enrollment progress while whole-card navigation opens the overview', async () => {
    progressState.records = [{ courseId: 'python', completion: 25 }, { courseId: 'java', completion: 100 }];
    const open = vi.fn();
    render(<LibraryPage onOpenCourse={open} />);
    const pythonCard = screen.getByRole('heading', { name: 'Python Foundations' }).closest('article');
    await waitFor(() => expect(within(pythonCard).getByRole('img', { name: 'Course progress 25 percent' })).toBeInTheDocument());
    expect(within(pythonCard).queryByRole('button', { name: /Continue/i })).not.toBeInTheDocument();
    fireEvent.click(within(pythonCard).getByRole('button', { name: 'Bookmark course' }));
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(pythonCard);
    expect(open).toHaveBeenCalledWith('python');
    const javaCard = screen.getByRole('heading', { name: 'Java Basics' }).closest('article');
    expect(within(javaCard).getByRole('img', { name: 'Course progress 100 percent' })).toBeInTheDocument();
    expect(within(javaCard).queryByRole('button', { name: /Review/i })).not.toBeInTheDocument();
    fireEvent.keyDown(javaCard, { key: 'Enter' });
    expect(open).toHaveBeenCalledWith('java');
  });

  it.each([0, 25, 50, 75, 100])('renders %i percent with one shared wave clip for fill and contrast text', (progress) => {
    const course = { id: `wave-${progress}`, filter: 'Test', kind: 'languages', title: `Wave ${progress}`, duration: '1h', lessonCount: 4, progress, available: true };
    const { container } = render(<CourseCard course={course} onOpenCourse={vi.fn()} variant="list" />);
    const indicator = screen.getByRole('img', { name: `Course progress ${progress} percent` });
    const path = indicator.querySelector('clipPath path');
    expect(path).toHaveAttribute('d', progress === 0 ? 'M0 100 H100 V100 H0 Z' : progress === 100 ? 'M0 0 H100 V100 H0 Z' : expect.stringContaining(`M0 ${100 - progress}`));
    expect(indicator.querySelectorAll('.library-course-progress-value')).toHaveLength(2);
    expect(container.querySelector('.library-course-progress-fill')).toBeInTheDocument();
  });
});
