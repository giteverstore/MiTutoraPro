import { BlockRenderer } from './BlockRenderer';
import { EmptyState } from './EmptyState';
import { LessonHeader } from './LessonHeader';
import { LessonSkeleton } from './LoadingSkeleton';
import { useSelectionAskAI } from './SelectionAskAIAction';

export function ContentArea({
  lesson,
  module,
  blocks,
  children,
  isLoading = false,
  emptyState,
  unavailableState,
  blockRuntimeProps,
  onAskAISelection,
}) {
  const selection = useSelectionAskAI({ sourceType: 'lesson_text', onAskAI: onAskAISelection });
  return (
    <main ref={selection.containerRef} className="lesson-panel" tabIndex="0" aria-label="Lesson content" onMouseUp={selection.captureSelection}>
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
            blockRuntimeProps={blockRuntimeProps}
          />
          {children}
        </article>
      ) : (
        <div className="lesson-document">
          <EmptyState
            title={unavailableState.title}
            description={unavailableState.description}
          />
        </div>
      )}
      {selection.action}
    </main>
  );
}
