import { useEffect, useRef } from 'react';
import { BookOpen, Check, FileQuestion, LockKeyhole, SquareTerminal } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

function LessonStatusIcon({ status, lesson }) {
  if (status === 'complete') return <Check size={ICON_SIZE.xs} strokeWidth={3} />;
  if (status === 'locked') return <LockKeyhole size={ICON_SIZE.xs} />;
  if (lesson.blocks?.some((block) => block.type === 'quiz')) {
    return <FileQuestion size={ICON_SIZE.sm} />;
  }
  if (lesson.blocks?.some((block) => block.type === 'exercise')) {
    return <SquareTerminal size={ICON_SIZE.sm} />;
  }
  return <BookOpen size={ICON_SIZE.sm} />;
}

export function LessonItem({ lesson, isActive, isCompleted, onSelect }) {
  const itemRef = useRef(null);
  const isLocked = lesson.status === 'locked';
  const displayStatus = isActive ? 'active' : isCompleted ? 'complete' : lesson.status;

  useEffect(() => {
    if (isActive) {
      itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  return (
    <button
      ref={itemRef}
      className={`button button--text lesson-link is-${displayStatus}`}
      type="button"
      disabled={isLocked}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onSelect(lesson.id)}
    >
      <span className="lesson-status">
        <LessonStatusIcon status={displayStatus} lesson={lesson} />
      </span>
      <span className="lesson-label">
        {lesson.title}
      </span>
    </button>
  );
}
