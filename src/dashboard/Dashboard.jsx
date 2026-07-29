import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { ICON_SIZE } from '../design-system/theme';
import { CategoryGrid } from './CategoryGrid';
import { ContinueLearningCard } from './ContinueLearningCard';
import { CourseSection } from './CourseSection';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DashboardTopNavigation } from './DashboardTopNavigation';
import {
  courseCategories,
  dashboardCourses,
  dashboardSections,
} from './dashboardData';

export function Dashboard({ onOpenCourse }) {
  const { user, signOut } = useUser();
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem('mi-tutora:theme') ?? 'light',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('learn');
  const [activeCategory, setActiveCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const courses = useMemo(() => dashboardCourses.map((course) =>
    course.id === 'mi-tutora-python-course'
      ? { ...course, progress: user.courseProgress ?? 0 }
      : course), [user.courseProgress]);
  const continueCourse = courses[0];

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 550);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('.dashboard-search input')?.focus();
      }
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dashboardSections.map((section) => ({
      ...section,
      courses: section.courseIds
        .map((courseId) => courses.find((course) => course.id === courseId))
        .filter(Boolean)
        .filter((course) => !activeCategory || course.category === activeCategory)
        .filter((course) =>
          !normalizedQuery
          || `${course.name} ${course.description} ${course.difficulty}`
            .toLowerCase()
            .includes(normalizedQuery)),
    })).filter((section) => section.courses.length > 0);
  }, [activeCategory, courses, query]);

  const handleCourseAction = (course) => {
    if (course.available) {
      onOpenCourse(course.id);
      return;
    }
    setNotice(`${course.name} is represented with mock data and will be available soon.`);
  };

  const handleNavigation = (item) => {
    setIsSidebarOpen(false);
    if (item.comingSoon) {
      setNotice(`${item.label} is coming soon.`);
      return;
    }
    setActiveNav(item.id);
    const targetId = item.id === 'learn'
      ? 'dashboard-start'
      : item.id === 'my-courses'
        ? 'my-courses'
        : item.id === 'bookmarks'
          ? 'recent'
          : 'dashboard-start';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
    if (['practice', 'settings'].includes(item.id)) {
      setNotice(`${item.label} controls are ready for future content.`);
    }
  };

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('mi-tutora:theme', next);
      return next;
    });
  };

  return (
    <div className="dashboard-shell" data-theme={theme}>
      <DashboardSidebar
        activeItem={activeNav}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelect={handleNavigation}
      />
      <DashboardTopNavigation
        user={user}
        query={query}
        onQueryChange={setQuery}
        theme={theme}
        onThemeToggle={toggleTheme}
        onMenuClick={() => setIsSidebarOpen(true)}
        onContinue={() => handleCourseAction(continueCourse)}
        isNotificationsOpen={isNotificationsOpen}
        onNotificationsToggle={() => {
          setIsProfileOpen(false);
          setIsNotificationsOpen((value) => !value);
        }}
        isProfileOpen={isProfileOpen}
        onProfileToggle={() => {
          setIsNotificationsOpen(false);
          setIsProfileOpen((value) => !value);
        }}
        onSignOut={signOut}
      />
      <main className="dashboard-main" id="dashboard-start">
        {isLoading ? <DashboardSkeleton /> : (
          <div className="dashboard-content">
            <section className="dashboard-welcome">
              <div>
                <span className="welcome-pill"><Sparkles size={ICON_SIZE.sm} /> Your learning space</span>
                <h1>Good to see you, {user.name.split(' ')[0]}.</h1>
                <p>Keep building momentum with a focused lesson, or discover something new.</p>
              </div>
              <div className="welcome-stat">
                <div>
                  <strong>{user.sequentialCompletedLessons ?? 0}</strong>
                  <span>Sequential progress</span>
                </div>
                <div>
                  <strong>{user.visitedLessons?.length ?? 0}</strong>
                  <span>Lessons visited</span>
                </div>
              </div>
            </section>
            <ContinueLearningCard course={continueCourse} onContinue={handleCourseAction} />
            <CategoryGrid
              categories={courseCategories}
              activeCategory={activeCategory}
              onSelect={(categoryId) =>
                setActiveCategory((current) => current === categoryId ? null : categoryId)}
            />
            {visibleSections.length ? visibleSections.map((section) => (
              <CourseSection
                section={section}
                courses={section.courses}
                onContinue={handleCourseAction}
                onViewAll={() => {
                  setActiveCategory(null);
                  setQuery('');
                  setNotice(`Showing all ${section.title.toLowerCase()}.`);
                }}
                key={section.id}
              />
            )) : (
              <section className="dashboard-no-results">
                <strong>No courses match your search.</strong>
                <p>Try a broader keyword or clear the selected category.</p>
                <button className="button button--secondary" type="button" onClick={() => { setQuery(''); setActiveCategory(null); }}>
                  Clear filters
                </button>
              </section>
            )}
          </div>
        )}
      </main>
      {notice ? <div className="dashboard-toast" role="status">{notice}</div> : null}
    </div>
  );
}
