import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { useLearningProgress } from '../progress/LearningProgressContext';
import { CompletionCelebration } from './CompletionCelebration';

function completionErrorMessage(error) {
  const code = String(error?.code ?? '').replace(/^functions\//, '');
  if (code === 'unauthenticated') return 'Lesson was not completed. Sign in again and retry.';
  if (code === 'invalid-argument' || code === 'not-found') return 'Lesson was not completed because it does not match the published course version. Refresh the course and retry.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Lesson completion is temporarily unavailable. Try again.';
  return 'Lesson could not be completed. Try again.';
}

export function LessonFooter({
  lesson,
  previousLesson,
  nextLesson,
  onPrevious,
  onNext,
  lessonCount,
  currentLessonIndex,
}) {
  const {
    completedLessons,
    completeLesson,
  } = useLearningProgress();
  const [completionState, setCompletionState] = useState({ status: 'idle', message: '' });
  const [celebration, setCelebration] = useState(null);
  const isCompleted = completedLessons.includes(lesson.id);

  useEffect(() => {
    setCompletionState({ status: 'idle', message: '' });
  }, [lesson.id]);

  const handleComplete = async () => {
    if (isCompleted || ['saving', 'complete'].includes(completionState.status)) return;
    setCompletionState({ status: 'saving', message: 'Saving lesson completion…' });
    try {
      await completeLesson(lesson.id);
      setCompletionState({ status: 'complete', message: 'Lesson completed.' });
      if (!isCompleted) setCelebration(lessonCount > 0 && new Set([...completedLessons, lesson.id]).size === lessonCount
        ? { variant: 'course', message: 'Course complete!' }
        : { variant: 'lesson', message: 'Lesson complete!' });
    } catch (error) {
      setCompletionState({ status: 'error', message: completionErrorMessage(error) });
    }
  };

  const statusLabel = completionState.status === 'error'
    ? 'Lesson not completed'
    : isCompleted
      ? 'Lesson completed'
      : 'Ready to complete';
  const lessonPosition = currentLessonIndex >= 0 && lessonCount
    ? `Lesson ${currentLessonIndex + 1} of ${lessonCount}`
    : statusLabel;
  const primaryStatus = completionState.status === 'saving'
    ? 'Saving…'
    : isCompleted
      ? 'Lesson completed'
      : lessonPosition;

  return (
    <footer className="lesson-completion-footer">
      <CompletionCelebration event={celebration} />
      <button
        className="button button--secondary lesson-footer-button"
        type="button"
        disabled={!previousLesson}
        onClick={onPrevious}
      >
        <ArrowLeft size={ICON_SIZE.md} aria-hidden="true" />
        <span className="lesson-footer-button-label">Previous Lesson</span>
      </button>
      <div className={`lesson-footer-status is-${completionState.status}`}>
        <span className="lesson-footer-status-main">
          <CheckCircle2 size={ICON_SIZE.md} />
          <span>{primaryStatus}</span>
        </span>
        <small
          className="lesson-footer-status-detail"
          role={completionState.status === 'error' ? 'alert' : 'status'}
          title={completionState.message || statusLabel}
        >
          {completionState.message || statusLabel}
        </small>
      </div>
      {isCompleted ? (
          <button
            className="button button--primary lesson-footer-button"
            type="button"
            disabled={!nextLesson}
            onClick={onNext}
          >
            <span className="lesson-footer-button-label">{nextLesson ? 'Next Lesson' : 'Course Complete'}</span>
            {nextLesson ? <ArrowRight size={ICON_SIZE.md} aria-hidden="true" /> : <CheckCircle2 size={ICON_SIZE.md} aria-hidden="true" />}
          </button>
        ) : (
          <button
            className="button button--primary lesson-footer-button"
            type="button"
            disabled={['saving', 'complete'].includes(completionState.status)}
            onClick={handleComplete}
          >
            <CheckCircle2 size={ICON_SIZE.md} aria-hidden="true" />
            <span className="lesson-footer-button-label">{completionState.status === 'error' ? 'Try Again' : 'Complete Lesson'}</span>
          </button>
        )}
    </footer>
  );
}
