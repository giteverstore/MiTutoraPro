import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

export function LessonFooter({ previousLesson, nextLesson, onPrevious, onNext, lessonCount, currentLessonIndex }) {
  const lessonPosition = currentLessonIndex >= 0 && lessonCount
    ? `Lesson ${currentLessonIndex + 1} of ${lessonCount}`
    : '';
  return (
    <footer className="lesson-completion-footer">
      <button className="button button--secondary lesson-footer-button" type="button" disabled={!previousLesson} onClick={onPrevious}>
        <ArrowLeft size={ICON_SIZE.md} aria-hidden="true" />
        <span className="lesson-footer-button-label">Previous Lesson</span>
      </button>
      <div className="lesson-footer-status"><span className="lesson-footer-status-main">{lessonPosition}</span></div>
      <button className="button button--primary lesson-footer-button" type="button" disabled={!nextLesson} onClick={onNext}>
        <span className="lesson-footer-button-label">Next Lesson</span>
        <ArrowRight size={ICON_SIZE.md} aria-hidden="true" />
      </button>
    </footer>
  );
}
