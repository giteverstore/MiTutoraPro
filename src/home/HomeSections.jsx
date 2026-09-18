import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  GraduationCap,
  Search,
  SearchX,
} from 'lucide-react';
import { CourseCard } from './CourseCard';

const LANGUAGE_ICONS = {
  Python: '/assets/languages/python.svg',
  Java: '/assets/languages/java.svg',
  'C++': '/assets/languages/cplusplus.svg',
  JavaScript: '/assets/languages/javascript.svg',
  TypeScript: '/assets/languages/typescript.svg',
  Go: '/assets/languages/go.svg',
  Rust: '/assets/languages/rust.svg',
  Kotlin: '/assets/languages/kotlin.svg',
  Swift: '/assets/languages/swift.svg',
  'C#': '/assets/languages/csharp.svg',
  SQL: Database,
  Dart: '/assets/languages/dart.svg',
};

function LanguageHeading({ language }) {
  const icon = LANGUAGE_ICONS[language];
  const Icon = typeof icon === 'string' ? null : (icon ?? Code2);
  return (
    <h2 id={languageSectionId(language)}>
      {typeof icon === 'string'
        ? <img className="library-language-logo" src={icon} alt="" aria-hidden="true" />
        : <Icon aria-hidden="true" />}
      {language}
    </h2>
  );
}

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

const languageSectionId = (language) => `library-language-${language.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

export function SectionHeading({ id, eyebrow, title, description }) {
  return (
    <header className="home-section-heading">
      {eyebrow ? <span>{eyebrow}</span> : null}
      <h2 id={id}>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function ContinueLearningSection({ courses = [], status, onOpenCourse, onBrowseLibrary }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCourses = expanded ? courses : courses.slice(0, 2);
  const canExpand = courses.length > 2;

  return (
    <section className="home-section home-continue" aria-labelledby="continue-title">
      <div className="home-continue-heading">
        <SectionHeading id="continue-title" title="Continue Learning" />
        {canExpand ? <button className="home-continue-toggle" type="button" aria-expanded={expanded} aria-controls="continue-learning-courses" onClick={() => setExpanded((current) => !current)}>{expanded ? 'Show less' : 'View all'}</button> : null}
      </div>
      {status === 'loading' ? <div className="home-course-empty" role="status"><p>Loading your learning state…</p></div> : visibleCourses.length ? <div className="home-continue-grid" id="continue-learning-courses">{visibleCourses.map((course) => <article className="home-continue-card" key={course.id}>
        <div className="home-continue-mark" aria-hidden="true"><BookOpen /></div>
        <div className="home-continue-copy">
          <span>{course.currentModule ?? 'Your saved course'}</span>
          <h3>{course.title}</h3>
          <p>{course.currentLesson ?? 'Start with the first lesson'}</p>
        </div>
        <div className="home-continue-progress">
          <div>
            <span>Course progress</span>
            <strong>{course.progress == null ? 'Unavailable' : `${course.progress}%`}</strong>
          </div>
          {course.progress == null ? null : <div
            className="home-progress-track"
            role="progressbar"
            aria-label={`${course.title} progress`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={course.progress}
          >
            <span style={{ width: `${course.progress}%` }} />
          </div>}
        </div>
        <button className="button button--primary" type="button" onClick={() => onOpenCourse(course.id, course.currentLesson)}>
          Continue Learning <ArrowRight size={17} />
        </button>
      </article>)}</div> : <div className="home-course-empty" role={status === 'error' ? 'alert' : 'status'}>
        <BookOpen aria-hidden="true" />
        <h3>{status === 'error' ? 'Learning state unavailable' : 'Start a new course'}</h3>
        <p>{status === 'error' ? 'Your saved learning data could not be loaded.' : ''}</p>
        {status === 'error' ? null : <button className="button button--primary" type="button" onClick={onBrowseLibrary}>Browse Library</button>}
      </div>}
    </section>
  );
}

export function BrowseCoursesSection({
  languageGroups,
  languages,
  activeLanguage,
  search,
  onLanguageChange,
  onSearchChange,
  onOpenCourse,
}) {
  const scrollFilters = (event) => {
    const container = event.currentTarget;
    if (container.scrollWidth <= container.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    container.scrollLeft += event.deltaY;
  };

  return (
    <section className="home-section" aria-label="Browse courses">
      <div className="home-discovery-bar">
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
        </div>
        <div className="home-filter-list" aria-label="Language filters" onWheel={scrollFilters}>
          <button
            type="button"
            className={activeLanguage === 'all' ? 'is-active' : ''}
            aria-pressed={activeLanguage === 'all'}
            onClick={() => onLanguageChange('all')}
          >
            All Languages
          </button>
          {languages.map((language) => (
            <button
              type="button"
              className={activeLanguage === language ? 'is-active' : ''}
              aria-pressed={activeLanguage === language}
              onClick={() => onLanguageChange(language)}
              key={language}
            >
              {language}
            </button>
          ))}
        </div>
      </div>
      <div className="library-language-sections" aria-live="polite" key={`${activeLanguage}-${search}`}>
        {languageGroups.length ? languageGroups.map((group) => (
          <section className="library-language-section" aria-labelledby={languageSectionId(group.language)} key={group.language}>
            <header className="library-language-section-header">
              <LanguageHeading language={group.language} />
            </header>
            <div className="library-language-course-grid">
              {group.courses.map((course) => <CourseCard course={course} onOpenCourse={onOpenCourse} variant="list" key={course.id} />)}
            </div>
          </section>
        )) : (
          <div className="home-course-empty" role="status">
            <SearchX aria-hidden="true" />
            <h3>No courses found</h3>
            <p>Try another search or choose a different language.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function RecentlyViewedSection({ courses, onOpenCourse }) {
  return (
    <section className="home-section home-recent" aria-labelledby="recent-title">
      <SectionHeading
        id="recent-title"
        title="Recently Viewed"
      />
      <div className="home-course-grid">
        {courses.length ? courses.map((course) => (
          <CourseCard course={course} onOpenCourse={onOpenCourse} key={course.id} />
        )) : <div className="home-course-empty" role="status"><BookOpen aria-hidden="true" /><h3>No recently viewed courses</h3></div>}
      </div>
    </section>
  );
}

const statisticIcons = {
  courses: GraduationCap,
  lessons: CheckCircle2,
  challenges: CalendarCheck2,
};

export function LearningStatisticsSection({ statistics, status, challengeStatus = status }) {
  return (
    <section className="home-section home-statistics" aria-labelledby="statistics-title">
      <SectionHeading id="statistics-title" title="Learning Statistics" />
      <div className="home-stat-grid">
        {statistics.map((statistic) => {
          const Icon = statisticIcons[statistic.id];
          const metricStatus = statistic.id === 'challenges' ? challengeStatus : status;
          return (
            <article className="home-stat-card" key={statistic.id}>
              <Icon aria-hidden="true" />
              <div>
                <strong>{metricStatus === 'loading' ? '—' : metricStatus === 'error' || statistic.value == null ? 'Unavailable' : statistic.value}</strong>
                <span>{statistic.label}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
