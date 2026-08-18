import { useEffect, useRef } from 'react';
import { BookOpen, Check, Circle, FileQuestion, SquareTerminal } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

function LessonStatusIcon({ state, lesson }) {
  if (state === 'complete') return <Check size={ICON_SIZE.xs} strokeWidth={2.5} aria-hidden="true" />;
  if (lesson.blocks?.some((block) => block.type === 'quiz')) {
    return <FileQuestion size={ICON_SIZE.xs} strokeWidth={1.8} aria-hidden="true" />;
  }
  if (lesson.blocks?.some((block) => block.type === 'exercise')) {
    return <SquareTerminal size={ICON_SIZE.xs} strokeWidth={1.8} aria-hidden="true" />;
  }
  if (state === 'not-started') return <Circle size={ICON_SIZE.xs} strokeWidth={1.6} aria-hidden="true" />;
  return <BookOpen size={ICON_SIZE.xs} strokeWidth={1.8} aria-hidden="true" />;
}

export function LessonItem({ lesson, isActive, isCompleted, isVisited, onSelect }) {
  const itemRef = useRef(null);
  const state = isCompleted ? 'complete' : isVisited ? 'visited' : 'not-started';

  useEffect(() => {
    if (isActive) {
      itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  return (
    <button
      ref={itemRef}
      className={`button button--text lesson-link is-${state} ${isActive ? 'is-active' : ''}`}
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onSelect(lesson.id)}
    >
      <span className="lesson-status">
        <LessonStatusIcon state={state} lesson={lesson} />
      </span>
      <span className="lesson-label">
        {lesson.title}
      </span>
    </button>
  );
}
