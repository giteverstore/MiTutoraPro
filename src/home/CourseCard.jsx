import { ArrowRight, BookOpen, Clock3 } from 'lucide-react';
import { ProgressCircle } from '../components/ProgressCircle';
import { ContentTypeBadge } from '../components/ContentTypeBadge';
import { DifficultyBadge, courseDifficultyBadge } from '../components/DifficultyBadge';
import { getCourseCardArtwork } from './courseCardArtwork';
import '../styles/components/card-footer.css';

const boundedProgress = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

export function CourseCard({ course, onOpenCourse, variant = 'card' }) {
  const isList = variant === 'list';
  const comingSoon = course.available === false;
  const progress = boundedProgress(course.progress);
  const hasProgress = !comingSoon && course.started === true;
  const tone = [...course.id].reduce((total, character) => total + character.charCodeAt(0), 0) % 5;
  const artwork = getCourseCardArtwork(course.id);
  const difficulty = courseDifficultyBadge(course.difficulty ?? course.level);
  const openCard = () => { if (!comingSoon) onOpenCourse(course.id); };
  const handleKeyDown = (event) => {
    if (event.target.closest('button, a') || comingSoon || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openCard();
  };

  if (isList) return (
    <article className={`home-course-card is-list library-course-card${hasProgress ? ' course-card--has-progress' : ''}${comingSoon ? ' is-unavailable' : ''}`} aria-labelledby={`course-title-${course.id}`} data-tone={tone} role={comingSoon ? undefined : 'link'} tabIndex={comingSoon ? undefined : 0} aria-disabled={comingSoon ? 'true' : undefined} onClick={(event) => { if (!event.target.closest('button, a')) openCard(); }} onKeyDown={handleKeyDown}>
      <header className="library-course-card-header">
        <ContentTypeBadge type="Course" />
        {difficulty ? <DifficultyBadge difficulty={difficulty} /> : null}
      </header>
      <div className={`library-course-artwork${artwork ? '' : ' is-empty'}`} aria-hidden="true">
        {artwork ? <img src={artwork} alt="" loading="lazy" decoding="async" /> : null}
      </div>
      <h3 id={`course-title-${course.id}`}>{course.title}</h3>
      <footer className="library-course-card-footer">
        <div className="library-course-divider" aria-hidden="true" />
        {comingSoon ? <span className="card-footer-coming-soon">Coming Soon</span> : <>
          {hasProgress ? <ProgressCircle progress={progress} label="Course" /> : null}
          <div className="library-course-meta card-footer-meta">
            <span><Clock3 aria-hidden="true" />{course.duration}</span>
            <span><BookOpen aria-hidden="true" />{course.lessonCount} lessons</span>
          </div>
        </>}
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
        {artwork ? <img src={artwork} alt="" loading="lazy" decoding="async" /> : null}
        {course.badge ? <small>{course.badge}</small> : null}
      </div>
      <div className="home-course-body">
        <div className="home-course-copy">
          <div className="home-course-card-header">
            <span className="home-course-level">{course.level}</span>
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
