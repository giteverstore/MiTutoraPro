import { LessonSkeleton } from './LoadingSkeleton';
import { ErrorState } from '../errors/ErrorState';
import { useEffect } from 'react';
import { phase5Mark } from '../performance/phase5Mark.js';

export function courseErrorPresentation(error, message) {
  if (error?.code === 'content/course-coming-soon' || message === 'This course is coming soon.') {
    return { title: 'Course unavailable', description: 'This course is coming soon.', kind: 'unavailable', alert: false };
  }
  if (['content/not-found', 'content/not-published', 'content/metadata-missing'].includes(error?.code)) {
    return { title: 'Course not found', description: 'This course does not exist or is no longer available.', kind: 'not-found', alert: false };
  }
  return { title: 'Course could not be loaded', description: 'Please try again later. Your saved progress is unaffected.', kind: 'failure', alert: true };
}

export function CourseLoadState({ state, message, error }) {
  useEffect(() => {
    if (state !== 'loading') return undefined;
    phase5Mark('course:skeleton:shown');
    return () => phase5Mark('course:skeleton:removed');
  }, [state]);
  if (state === 'loading') {
    return (
      <div className="app-shell course-load-state">
        <LessonSkeleton />
      </div>
    );
  }

  return <div className="app-shell course-load-state"><ErrorState {...courseErrorPresentation(error, message)} /></div>;
}
