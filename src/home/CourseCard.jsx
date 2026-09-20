import { useId } from 'react';
import { ArrowRight, BookOpen, Clock3 } from 'lucide-react';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { getCourseOverviewPresentation } from '../course-overview/courseOverviewPresentation';

const boundedProgress = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

function LibraryProgress({ course }) {
  const maskId = `course-progress-${useId().replaceAll(':', '')}`;
  const progress = boundedProgress(course.progress);
  const boundary = 100 - progress;
  const wavePath = progress === 0
    ? 'M0 100 H100 V100 H0 Z'
    : progress === 100
      ? 'M0 0 H100 V100 H0 Z'
      : `M0 ${boundary} Q25 ${boundary - 4} 50 ${boundary} T100 ${boundary} V100 H0 Z`;
  return <div className="library-course-progress" role="img" aria-label={`Course progress ${progress} percent`}>
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs><clipPath id={maskId}><path d={wavePath} /></clipPath></defs>
      <circle className="library-course-progress-base" cx="50" cy="50" r="48" />
      <g clipPath={`url(#${maskId})`}><circle className="library-course-progress-fill" cx="50" cy="50" r="48" /></g>
      <text className="library-course-progress-value" x="50" y="50">{progress}%</text>
      <g clipPath={`url(#${maskId})`}><text className="library-course-progress-value is-contrast" x="50" y="50">{progress}%</text></g>
      <circle className="library-course-progress-border" cx="50" cy="50" r="48" />
    </svg>
  </div>;
}

export function CourseCard({ course, onOpenCourse, variant = 'card' }) {
  const isList = variant === 'list';
  const progress = boundedProgress(course.progress);
  const initials = (course.filter ?? course.title ?? '')
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const tone = [...course.id].reduce((total, character) => total + character.charCodeAt(0), 0) % 5;
  const bookmark = {
    id: `course:${course.id}`,
    type: 'course',
    contentId: course.id,
    title: course.title,
    description: course.description,
    language: course.kind === 'languages' ? course.filter : '',
    topic: course.kind === 'domains' ? course.filter : '',
    target: { page: 'course', courseId: course.id },
  };
  const artwork = getCourseOverviewPresentation(course.id)?.artwork ?? null;
  const openCard = () => { if (course.available !== false) onOpenCourse(course.id); };
  const handleKeyDown = (event) => {
    if (event.target.closest('button, a') || course.available === false || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openCard();
  };

  if (isList) return (
    <article className={`home-course-card is-list library-course-card${course.available === false ? ' is-unavailable' : ''}`} aria-labelledby={`course-title-${course.id}`} data-tone={tone} role={course.available === false ? undefined : 'link'} tabIndex={course.available === false ? undefined : 0} aria-disabled={course.available === false ? 'true' : undefined} onClick={(event) => { if (!event.target.closest('button, a')) openCard(); }} onKeyDown={handleKeyDown}>
      <header className="library-course-card-header">
        <span className="library-resource-type"><span aria-hidden="true" />Course</span>
        <BookmarkToggle bookmark={bookmark} iconOnly className="home-course-bookmark" />
      </header>
      <div className="library-course-artwork" aria-hidden="true">
        {artwork ? <img src={artwork} alt="" /> : <span>{initials}</span>}
      </div>
      <h3 id={`course-title-${course.id}`}>{course.title}</h3>
      <footer className="library-course-card-footer">
        <div className="library-course-divider" aria-hidden="true" />
        <LibraryProgress course={{ ...course, progress }} />
        <div className="library-course-meta">
          <span><Clock3 aria-hidden="true" />{course.duration}</span>
          <span><BookOpen aria-hidden="true" />{course.lessonCount} lessons</span>
        </div>
        {course.available === false ? <span className="library-course-coming-soon">Coming Soon</span> : null}
      </footer>
    </article>
  );

  return (
    <article
      className={`home-course-card ${isList ? 'is-list' : ''}`}
      aria-labelledby={`course-title-${course.id}`}
      data-tone={tone}
    >
      <div className="home-course-visual" aria-hidden="true">
        <span>{initials}</span>
        {course.badge ? <small>{course.badge}</small> : null}
      </div>
      <div className="home-course-body">
        <div className="home-course-copy">
          <div className="home-course-card-header">
            <span className="home-course-level">{course.level}</span>
            {isList ? <BookmarkToggle bookmark={bookmark} iconOnly className="home-course-bookmark" /> : null}
          </div>
          <h3 id={`course-title-${course.id}`}>{course.title}</h3>
          <p>{course.description}</p>
        </div>
        <div className="home-course-footer">
          <div className="home-course-meta">
            <span><Clock3 size={14} aria-hidden="true" /> {course.duration}</span>
            <span><BookOpen size={14} aria-hidden="true" /> {course.lessonCount} lessons</span>
            {course.available ? <span>3 lessons free</span> : null}
          </div>
          <div className="home-course-endcap">
            {isList && course.progress > 0 ? (
              <div className="home-course-list-progress">
                <div><span>Progress</span><strong>{course.progress}%</strong></div>
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
            ) : null}
            <div className="home-course-actions">
              <button
                className={isList ? 'button button--primary' : 'home-text-button'}
                type="button"
                disabled={!course.available}
                onClick={() => onOpenCourse(course.id)}
              >
                {isList ? status : course.available ? 'Open course' : 'Coming soon'}
                {course.available ? <ArrowRight size={16} /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
