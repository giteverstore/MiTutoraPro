import { ArrowRight, BookOpen, Clock3 } from 'lucide-react';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';

export function CourseCard({ course, onOpenCourse, variant = 'card' }) {
  const isList = variant === 'list';
  const status = !course.available ? 'Coming Soon' : course.progress > 0 ? 'Continue' : 'Start';
  const initials = course.filter
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
