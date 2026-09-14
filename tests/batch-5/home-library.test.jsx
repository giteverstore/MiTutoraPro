import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_NAVIGATION } from '../../src/app-shell/navigation';
import { ContinueLearningSection, RecentlyViewedSection } from '../../src/home/HomeSections';
import { LibraryPage } from '../../src/home/LibraryPage';
import { createHomeLearningModel } from '../../src/home/homeLearningModel';
import { createRecentCourseRepository } from '../../src/home/recentCourseRepository';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';

vi.mock('../../src/bookmarks/BookmarkToggle', () => ({ BookmarkToggle: () => null }));

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

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
    render(<ContinueLearningSection course={null} status="ready" onBrowseLibrary={browse} />);
    expect(screen.getByRole('heading', { name: 'Start a new course' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browse Library' }));
    expect(browse).toHaveBeenCalledOnce();
    expect(screen.queryByText('38%')).not.toBeInTheDocument();
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

  it('preserves search, mode filtering, available navigation, and coming-soon states', () => {
    const open = vi.fn();
    render(<LibraryPage onOpenCourse={open} />);
    const discovery = screen.getByRole('region', { name: 'Browse courses' }).querySelector('.home-discovery-bar');
    expect(discovery).toContainElement(screen.getByLabelText('domains filters'));
    expect(discovery).toContainElement(screen.getByRole('searchbox', { name: 'Search courses' }));
    expect(discovery).toContainElement(screen.getByRole('group', { name: 'Browse courses by' }));
    expect(screen.queryByRole('heading', { name: 'Browse Courses' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse courses' })).toBeInTheDocument();
    expect(screen.queryByText('Explore')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Languages' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: 'Python' } });
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    expect(open).toHaveBeenCalledWith('python');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: 'Rust' } });
    expect(screen.getByRole('button', { name: 'Coming Soon' })).toBeDisabled();
  });
});
