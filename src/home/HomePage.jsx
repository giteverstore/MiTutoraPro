import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { browseCatalog, homeData } from './homeData';
import {
  BrowseCoursesSection,
  ContinueLearningSection,
  LearningStatisticsSection,
  RecentlyViewedSection,
} from './HomeSections';

export function HomePage({ onOpenCourse }) {
  const { user } = useUser();
  const [browseMode, setBrowseMode] = useState('domains');
  const [activeFilter, setActiveFilter] = useState('all');
  const [courseSearch, setCourseSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [coursesPerPage, setCoursesPerPage] = useState(6);

  const visibleCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    return browseCatalog[browseMode].filter((course) => {
      const matchesFilter = activeFilter === 'all' || course.filter === activeFilter;
      const searchableContent = [
        course.title,
        course.description,
        course.filter,
        course.kind,
      ].join(' ').toLowerCase();
      return matchesFilter && (!query || searchableContent.includes(query));
    });
  }, [activeFilter, browseMode, courseSearch]);
  const totalPages = Math.max(1, Math.ceil(visibleCourses.length / coursesPerPage));
  const paginatedCourses = useMemo(() => {
    const pageStart = (currentPage - 1) * coursesPerPage;
    return visibleCourses.slice(pageStart, pageStart + coursesPerPage);
  }, [coursesPerPage, currentPage, visibleCourses]);

  useEffect(() => {
    const tabletQuery = window.matchMedia('(min-width: 761px) and (max-width: 1180px)');
    const updatePageSize = () => setCoursesPerPage(tabletQuery.matches ? 4 : 6);
    updatePageSize();
    tabletQuery.addEventListener('change', updatePageSize);
    return () => tabletQuery.removeEventListener('change', updatePageSize);
  }, []);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleModeChange = (mode) => {
    setBrowseMode(mode);
    setActiveFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="home-main" id="home-content">
        <div className="home-intro">
          <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
          <p>Continue your path or choose the next skill you want to build.</p>
        </div>
        <ContinueLearningSection
          course={homeData.continueLearning}
          onOpenCourse={onOpenCourse}
        />
        <BrowseCoursesSection
          mode={browseMode}
          modes={browseCatalog}
          courses={paginatedCourses}
          totalCourses={visibleCourses.length}
          currentPage={currentPage}
          totalPages={totalPages}
          activeFilter={activeFilter}
          search={courseSearch}
          onModeChange={handleModeChange}
          onFilterChange={(filter) => {
            setActiveFilter(filter);
            setCurrentPage(1);
          }}
          onSearchChange={(query) => {
            setCourseSearch(query);
            setCurrentPage(1);
          }}
          onPageChange={setCurrentPage}
          onOpenCourse={onOpenCourse}
        />
        <RecentlyViewedSection
          courses={homeData.recentlyViewed}
          onOpenCourse={onOpenCourse}
        />
        <LearningStatisticsSection statistics={homeData.statistics} />
    </div>
  );
}
