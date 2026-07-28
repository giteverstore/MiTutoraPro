import { ArrowUpRight, Clock3 } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { DashboardIcon } from './dashboardIcons';

export function CourseCard({ course, onContinue, compact = false }) {
  return (
    <article className={`dashboard-course-card ${compact ? 'is-compact' : ''}`}>
      <div className={`course-thumbnail tone-${course.thumbnail}`}>
        <DashboardIcon name={course.thumbnail} size={30} strokeWidth={1.7} />
        {course.badge ? <span>{course.badge}</span> : null}
      </div>
      <div className="dashboard-course-content">
        <div>
          <span className="course-difficulty">{course.difficulty}</span>
          <h3>{course.name}</h3>
          <p>{course.description}</p>
        </div>
        <div className="course-card-footer">
          <div className="course-meta">
            <span><Clock3 size={ICON_SIZE.sm} /> {course.duration}</span>
            <span>{course.progress}% complete</span>
          </div>
          <div className="course-progress-track" aria-label={`${course.progress}% complete`}>
            <span style={{ width: `${course.progress}%` }} />
          </div>
          <button
            className="button button--secondary course-card-action"
            type="button"
            onClick={() => onContinue(course)}
            aria-label={`${course.progress ? 'Continue' : 'View'} ${course.name}`}
          >
            {course.progress ? 'Continue' : 'View course'}
            <ArrowUpRight size={ICON_SIZE.sm} />
          </button>
        </div>
      </div>
    </article>
  );
}

