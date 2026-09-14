import { useEffect, useMemo, useState } from 'react';
import { browseCatalog } from './homeData';
import { BrowseCoursesSection } from './HomeSections';

export function LibraryPage({ onOpenCourse }) {
  const [browseMode, setBrowseMode] = useState('domains');
  const [activeFilter, setActiveFilter] = useState('all');
  const [courseSearch, setCourseSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [coursesPerPage, setCoursesPerPage] = useState(6);
  const visibleCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    return browseCatalog[browseMode].filter((course) => {
      const matchesFilter = activeFilter === 'all' || course.filter === activeFilter;
      const searchable = [course.title, course.description, course.filter, course.kind].join(' ').toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [activeFilter, browseMode, courseSearch]);
  const totalPages = Math.max(1, Math.ceil(visibleCourses.length / coursesPerPage));
  const courses = useMemo(() => visibleCourses.slice((currentPage - 1) * coursesPerPage, currentPage * coursesPerPage), [coursesPerPage, currentPage, visibleCourses]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 761px) and (max-width: 1180px)');
    const update = () => setCoursesPerPage(query.matches ? 4 : 6);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => setCurrentPage((page) => Math.min(page, totalPages)), [totalPages]);
  const changeMode = (mode) => { setBrowseMode(mode); setActiveFilter('all'); setCurrentPage(1); };
  return <div className="home-main library-main" id="library-content">
    <BrowseCoursesSection mode={browseMode} modes={browseCatalog} courses={courses} totalCourses={visibleCourses.length}
      currentPage={currentPage} totalPages={totalPages} activeFilter={activeFilter} search={courseSearch}
      onModeChange={changeMode} onFilterChange={(value) => { setActiveFilter(value); setCurrentPage(1); }}
      onSearchChange={(value) => { setCourseSearch(value); setCurrentPage(1); }} onPageChange={setCurrentPage} onOpenCourse={onOpenCourse} />
  </div>;
}
