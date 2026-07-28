import { CircleAlert } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { LessonSkeleton } from './LoadingSkeleton';

export function CourseLoadState({ state, message }) {
  if (state === 'loading') {
    return (
      <div className="app-shell course-load-state">
        <LessonSkeleton />
      </div>
    );
  }

  return (
    <div className="app-shell course-load-state" role="alert">
      <div className="empty-state">
        <span><CircleAlert size={ICON_SIZE.xl} /></span>
        <strong>Course unavailable</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
