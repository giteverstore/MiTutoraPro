import { useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  GraduationCap,
  Search,
  SearchX,
} from 'lucide-react';
import { CourseCard } from './CourseCard';

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const visiblePages = [...pages].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
  return visiblePages.flatMap((page, index) => {
    const previousPage = visiblePages[index - 1];
    return index > 0 && page - previousPage > 1 ? [`ellipsis-${page}`, page] : [page];
  });
}

function CoursePagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const items = getPaginationItems(currentPage, totalPages);

  return (
    <nav className="home-course-pagination" aria-label="Course catalog pages">
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        <ChevronLeft aria-hidden="true" /> Previous
      </button>
      <div>
        {items.map((item) => typeof item === 'string' ? (
          <span aria-hidden="true" key={item}>…</span>
        ) : (
          <button
            type="button"
            className={item === currentPage ? 'is-active' : ''}
            aria-current={item === currentPage ? 'page' : undefined}
            aria-label={`Page ${item}`}
            onClick={() => onPageChange(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        Next <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}

export function SectionHeading({ id, eyebrow, title, description }) {
  return (
    <header className="home-section-heading">
      <span>{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function ContinueLearningSection({ course, onOpenCourse }) {
  return (
    <section className="home-section home-continue" aria-labelledby="continue-title">
      <SectionHeading id="continue-title" eyebrow="Your learning" title="Continue Learning" />
      <article className="home-continue-card">
        <div className="home-continue-mark" aria-hidden="true"><BookOpen /></div>
        <div className="home-continue-copy">
          <span>{course.currentModule}</span>
          <h3>{course.title}</h3>
          <p>{course.currentLesson}</p>
        </div>
        <div className="home-continue-progress">
          <div>
            <span>Course progress</span>
            <strong>{course.progress}%</strong>
          </div>
          <div
            className="home-progress-track"
            role="progressbar"
            aria-label={`${course.title} progress`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={course.progress}
          >
            <span style={{ width: `${course.progress}%` }} />
          </div>
        </div>
        <button className="button button--primary" type="button" onClick={() => onOpenCourse(course.id)}>
          Continue Learning <ArrowRight size={17} />
        </button>
      </article>
    </section>
  );
}

export function BrowseCoursesSection({
  mode,
  modes,
  courses,
  totalCourses,
  currentPage,
  totalPages,
  activeFilter,
  search,
  onModeChange,
  onFilterChange,
  onSearchChange,
  onPageChange,
  onOpenCourse,
}) {
  const sectionRef = useRef(null);
  const changePage = (page) => {
    if (page === currentPage || page < 1 || page > totalPages) return;
    onPageChange(page);
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    }));
  };
  const scrollFilters = (event) => {
    const container = event.currentTarget;
    if (container.scrollWidth <= container.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    container.scrollLeft += event.deltaY;
  };

  return (
    <section className="home-section" aria-labelledby="browse-title" ref={sectionRef}>
      <div className="home-browse-header">
        <SectionHeading
          id="browse-title"
          eyebrow="Explore"
          title="Browse Courses"
          description="Choose a focused path by domain or programming language."
        />
        <div className="home-browse-controls">
          <label className="home-course-search">
            <span className="sr-only">Search courses</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search courses..."
            />
          </label>
          <div className="home-mode-switch" role="group" aria-label="Browse courses by">
            {Object.keys(modes).map((key) => (
              <button
                type="button"
                className={mode === key ? 'is-active' : ''}
                aria-pressed={mode === key}
                onClick={() => onModeChange(key)}
                key={key}
              >
                {key === 'domains' ? 'Domains' : 'Languages'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="home-filter-list" aria-label={`${mode} filters`} onWheel={scrollFilters}>
        <button
          type="button"
          className={activeFilter === 'all' ? 'is-active' : ''}
          aria-pressed={activeFilter === 'all'}
          onClick={() => onFilterChange('all')}
        >
          {mode === 'domains' ? 'All Domains' : 'All Languages'}
        </button>
        {modes[mode].map((course) => (
          <button
            type="button"
            className={activeFilter === course.filter ? 'is-active' : ''}
            aria-pressed={activeFilter === course.filter}
            onClick={() => onFilterChange(course.filter)}
            key={course.id}
          >
            {course.filter}
          </button>
        ))}
      </div>
      <div
        className="home-course-list"
        aria-live="polite"
        key={`${mode}-${activeFilter}-${search}-${currentPage}`}
      >
        {totalCourses ? courses.map((course) => (
          <CourseCard course={course} onOpenCourse={onOpenCourse} variant="list" key={course.id} />
        )) : (
          <div className="home-course-empty" role="status">
            <SearchX aria-hidden="true" />
            <h3>No courses found</h3>
            <p>Try another search or choose a different {mode === 'domains' ? 'domain' : 'language'}.</p>
          </div>
        )}
      </div>
      <CoursePagination currentPage={currentPage} totalPages={totalPages} onPageChange={changePage} />
    </section>
  );
}

export function RecentlyViewedSection({ courses, onOpenCourse }) {
  return (
    <section className="home-section" aria-labelledby="recent-title">
      <SectionHeading
        id="recent-title"
        eyebrow="Pick up where you left off"
        title="Recently Viewed"
        description="Return to courses you explored recently."
      />
      <div className="home-course-grid">
        {courses.map((course) => (
          <CourseCard course={course} onOpenCourse={onOpenCourse} key={course.id} />
        ))}
      </div>
    </section>
  );
}

const statisticIcons = {
  courses: GraduationCap,
  lessons: CheckCircle2,
  streak: Flame,
  hours: Clock3,
};

export function LearningStatisticsSection({ statistics }) {
  return (
    <section className="home-section" aria-labelledby="statistics-title">
      <SectionHeading id="statistics-title" eyebrow="Your momentum" title="Learning Statistics" />
      <div className="home-stat-grid">
        {statistics.map((statistic) => {
          const Icon = statisticIcons[statistic.id];
          return (
            <article className="home-stat-card" key={statistic.id}>
              <Icon aria-hidden="true" />
              <div>
                <strong>{statistic.value}</strong>
                <span>{statistic.label}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
