import { useEffect, useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { LessonItem } from './LessonItem';
import { getModuleLessons } from '../course/courseStructure';

function ChapterGroup({
  group,
  currentLessonId,
  onSelectLesson,
  completedLessonIds,
  visitedLessonIds,
}) {
  const containsCurrentLesson = group.lessons.some((lesson) => lesson.id === currentLessonId);
  const [isExpanded, setIsExpanded] = useState(group.initiallyExpanded || containsCurrentLesson);
  const reactId = useId();
  const contentId = `chapter-group-${reactId.replaceAll(':', '')}`;
  const completedCount = group.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;

  useEffect(() => {
    if (containsCurrentLesson) setIsExpanded(true);
  }, [containsCurrentLesson]);

  return (
    <section className={`course-section-group ${isExpanded ? 'is-expanded' : ''}`}>
      <button
        className="button button--text course-section-trigger"
        type="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span>
          <strong>{group.title}</strong>
          <small>{completedCount}/{group.lessons.length}</small>
        </span>
        <ChevronDown className="course-section-chevron" size={ICON_SIZE.sm} aria-hidden="true" />
      </button>
      <div className="course-section-lessons" id={contentId}>
        <div>
          {group.lessons.map((lesson) => (
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
  const containsCurrentLesson = getModuleLessons(module).some(
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
          {module.sections?.length ? module.sections.map((section) => (
            <ChapterGroup
              group={section}
              currentLessonId={currentLessonId}
              onSelectLesson={onSelectLesson}
              completedLessonIds={completedLessonIds}
              visitedLessonIds={visitedLessonIds}
              key={section.id}
            />
          )) : module.lessons.map((lesson) => (
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
