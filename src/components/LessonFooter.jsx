import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { useLearningProgress } from '../progress/LearningProgressContext';

function completionErrorMessage(error) {
  const code = String(error?.code ?? '').replace(/^functions\//, '');
  if (code === 'unauthenticated') return 'Lesson was not completed. Sign in again and retry.';
  if (code === 'invalid-argument' || code === 'not-found') return 'Lesson was not completed because it does not match the published course version. Refresh the course and retry.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Lesson was not completed because trusted verification is temporarily unavailable. Try again.';
  return 'Lesson was not completed because trusted verification failed. Try again.';
}

export function LessonFooter({
  lesson,
  previousLesson,
  nextLesson,
  onPrevious,
  onNext,
  lessonCount,
  currentLessonIndex,
  scopeLabel,
}) {
  const {
    completedLessons,
    quizScores,
    exerciseCompletion,
    completeLesson,
  } = useLearningProgress();
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [completionState, setCompletionState] = useState({ status: 'idle', message: '' });
  const isCompleted = completedLessons.includes(lesson.id);

  const requirement = useMemo(() => {
    const quizzes = lesson.blocks.filter((block) => block.type === 'quiz');
    const exercises = lesson.blocks.filter((block) => block.type === 'exercise');
    if (quizzes.length) return { type: 'quiz', blocks: quizzes };
    if (exercises.length) return { type: 'exercise', blocks: exercises };
    return { type: 'reading', blocks: [] };
  }, [lesson.blocks]);

  useEffect(() => {
    setHasReachedEnd(false);
    setCompletionState({ status: 'idle', message: '' });
    const sentinel = document.querySelector(`[data-lesson-end="${CSS.escape(lesson.id)}"]`);
    if (!sentinel || requirement.type !== 'reading') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasReachedEnd(true);
      },
      { threshold: 0.65 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [lesson.id, requirement.type]);

  const canComplete = requirement.type === 'quiz'
    ? requirement.blocks.every((block) =>
        quizScores[block.id]?.passed === true || quizScores[block.id]?.percentage === 100)
    : requirement.type === 'exercise'
      ? requirement.blocks.every((block) => exerciseCompletion[block.id]?.completed)
      : hasReachedEnd;

  const lockedMessage = requirement.type === 'quiz'
    ? 'Complete the quiz correctly to finish this lesson.'
    : requirement.type === 'exercise'
      ? 'Run your code, verify its output, and mark the exercise complete.'
      : 'Read to the end of the lesson to enable completion.';

  const handleComplete = async () => {
    if (!canComplete || completionState.status === 'saving') return;
    setCompletionState({ status: 'saving', message: 'Recording trusted completion…' });
    try {
      await completeLesson(lesson.id, requirement.type);
      setCompletionState({ status: 'complete', message: 'Lesson completion verified.' });
    } catch (error) {
      setCompletionState({ status: 'error', message: completionErrorMessage(error) });
    }
  };

  const statusLabel = completionState.status === 'error'
    ? 'Lesson not completed'
    : isCompleted
      ? 'Lesson completed'
      : canComplete
        ? 'Ready to complete'
        : lockedMessage;
  const lessonPosition = currentLessonIndex >= 0 && lessonCount
    ? `Lesson ${currentLessonIndex + 1} of ${lessonCount}`
    : statusLabel;
  const primaryStatus = completionState.status === 'saving'
    ? 'Verifying…'
    : isCompleted
      ? 'Lesson completed'
      : lessonPosition;

  return (
    <footer className="lesson-completion-footer">
      <button
        className="button button--secondary lesson-footer-button"
        type="button"
        disabled={!previousLesson}
        onClick={onPrevious}
      >
        <ArrowLeft size={ICON_SIZE.md} /> <span>Previous Lesson</span>
      </button>
      <div className={`lesson-footer-status is-${completionState.status}`}>
        <span className="lesson-footer-status-main">
          {isCompleted
            ? <CheckCircle2 size={ICON_SIZE.md} />
            : canComplete
              ? <CheckCircle2 size={ICON_SIZE.md} />
              : <LockKeyhole size={ICON_SIZE.md} />}
          <span>{primaryStatus}</span>
        </span>
        <small
          className="lesson-footer-status-detail"
          role={completionState.status === 'error' ? 'alert' : 'status'}
          title={completionState.message || statusLabel}
        >
          {completionState.message || [scopeLabel, statusLabel].filter(Boolean).join(' · ')}
        </small>
      </div>
      {isCompleted ? (
          <button
            className="button button--primary lesson-footer-button"
            type="button"
            disabled={!nextLesson}
            onClick={onNext}
          >
            <span>{nextLesson ? 'Next Lesson' : 'Course Complete'}</span>
            {nextLesson ? <ArrowRight size={ICON_SIZE.md} /> : <CheckCircle2 size={ICON_SIZE.md} />}
          </button>
        ) : (
          <button
            className="button button--primary lesson-footer-button"
            type="button"
            disabled={!canComplete || completionState.status === 'saving'}
            onClick={handleComplete}
          >
            <CheckCircle2 size={ICON_SIZE.md} /> <span>{completionState.status === 'error' ? 'Try Again' : 'Complete Lesson'}</span>
          </button>
        )}
    </footer>
  );
}
