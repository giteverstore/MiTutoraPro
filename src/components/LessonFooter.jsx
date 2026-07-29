import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { useLearningProgress } from '../progress/LearningProgressContext';

export function LessonFooter({
  lesson,
  previousLesson,
  nextLesson,
  onPrevious,
  onNext,
}) {
  const {
    completedLessons,
    quizScores,
    exerciseCompletion,
    completeLesson,
  } = useLearningProgress();
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const footerRef = useRef(null);
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
    const footer = footerRef.current;
    if (!footer || requirement.type !== 'reading') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasReachedEnd(true);
      },
      { threshold: 0.65 },
    );
    observer.observe(footer);
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

  return (
    <footer className="lesson-completion-footer" ref={footerRef}>
      <div className="lesson-footer-status">
        {isCompleted
          ? <CheckCircle2 size={ICON_SIZE.md} />
          : canComplete
            ? <CheckCircle2 size={ICON_SIZE.md} />
            : <LockKeyhole size={ICON_SIZE.md} />}
        <span>{isCompleted ? 'Lesson completed' : canComplete ? 'Ready to complete' : lockedMessage}</span>
      </div>
      <div className="lesson-footer-actions">
        <button
          className="button button--secondary lesson-footer-button"
          type="button"
          disabled={!previousLesson}
          onClick={onPrevious}
        >
          <ArrowLeft size={ICON_SIZE.md} /> Previous Lesson
        </button>
        {isCompleted ? (
          <button
            className="button button--primary lesson-footer-button"
            type="button"
            disabled={!nextLesson}
            onClick={onNext}
          >
            {nextLesson ? 'Next Lesson' : 'Course Complete'}
            {nextLesson ? <ArrowRight size={ICON_SIZE.md} /> : <CheckCircle2 size={ICON_SIZE.md} />}
          </button>
        ) : (
          <button
            className="button button--primary lesson-footer-button"
            type="button"
            disabled={!canComplete}
            onClick={() => completeLesson(lesson.id)}
          >
            <CheckCircle2 size={ICON_SIZE.md} /> Complete Lesson
          </button>
        )}
      </div>
    </footer>
  );
}
