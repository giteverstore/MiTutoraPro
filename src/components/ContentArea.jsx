import { BlockRenderer } from './BlockRenderer';
import { EmptyState } from './EmptyState';
import { LessonHeader } from './LessonHeader';
import { LessonSkeleton } from './LoadingSkeleton';

export function ContentArea({
  lesson,
  module,
  blocks,
  children,
  isLoading = false,
  emptyState,
  unavailableState,
  footer,
}) {
  return (
    <main className="lesson-panel">
      {isLoading ? <LessonSkeleton /> : lesson && module ? (
        <article className="lesson-document">
          <LessonHeader
            moduleName={module.title}
            lessonNumber={lesson.numberLabel}
            title={lesson.title}
            summary={lesson.summary}
            details={lesson.details}
          />
          <BlockRenderer
            lesson={{ ...lesson, blocks }}
            emptyState={emptyState}
          />
          {children}
          {footer}
        </article>
      ) : (
        <div className="lesson-document">
          <EmptyState
            title={unavailableState.title}
            description={unavailableState.description}
          />
        </div>
      )}
    </main>
  );
}
