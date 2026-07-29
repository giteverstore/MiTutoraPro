import { useEffect, useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { LessonItem } from './LessonItem';

export function ModuleItem({
  module,
  currentLessonId,
  onSelectLesson,
  completedLessonIds,
  visitedLessonIds,
  isCompleted,
}) {
  const [isExpanded, setIsExpanded] = useState(module.initiallyOpen);
  const reactId = useId();
  const contentId = `module-${reactId.replaceAll(':', '')}`;
  const containsCurrentLesson = module.lessons.some(
    (lesson) => lesson.id === currentLessonId,
  );

  useEffect(() => {
    if (containsCurrentLesson) setIsExpanded(true);
  }, [containsCurrentLesson]);

  return (
    <section className={`module-group ${isExpanded ? 'is-expanded' : ''}`}>
      <button
        className="button button--text module-trigger"
        type="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span>
          <strong>{module.title}</strong>
          <small>{module.meta}</small>
        </span>
        {isCompleted ? <Check className="module-complete-icon" size={ICON_SIZE.md} /> : null}
        <ChevronDown className="module-chevron" size={ICON_SIZE.md} />
      </button>
      <div className="lesson-list-wrap" id={contentId}>
        <div className="lesson-list">
          {module.lessons.map((lesson) => (
            <LessonItem
              lesson={lesson}
              isActive={lesson.id === currentLessonId}
              onSelect={onSelectLesson}
              isCompleted={completedLessonIds.has(lesson.id)}
              isVisited={visitedLessonIds.has(lesson.id)}
              key={lesson.id}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
