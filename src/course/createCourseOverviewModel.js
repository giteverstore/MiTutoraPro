import { getModuleLessons, getModuleSections } from './courseStructure.js';

function titleCase(value) {
  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDuration(minutes = 0) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function createCourseOverviewModel(course, progress) {
  const lessons = course.modules.flatMap(getModuleLessons);
  const blocks = lessons.flatMap((lesson) => lesson.blocks ?? []);
  const completedSet = new Set(progress.completedLessons);
  const skills = [...new Set(course.metadata?.tags ?? [])]
    .filter((tag) => !['beginner', 'intermediate', 'advanced'].includes(tag.toLowerCase()))
    .map(titleCase);

  return {
    id: course.id,
    title: course.name ?? course.title,
    description: course.description,
    difficulty: titleCase(course.metadata?.level ?? 'All levels'),
    estimatedDuration: formatDuration(course.metadata?.estimatedMinutes),
    moduleCount: course.contentLoadState?.totalModuleCount ?? course.modules.length,
    lessonCount: course.contentLoadState?.totalLessonCount ?? lessons.length,
    quizCount: blocks.filter(({ type }) => type === 'quiz').length,
    exerciseCount: blocks.filter(({ type }) => type === 'exercise').length,
    certificateAvailable: course.status !== 'archived',
    skills: skills.length ? skills : ['Core concepts', 'Practical problem solving'],
    prerequisites: course.metadata?.level === 'beginner'
      ? ['No prior programming experience required', 'A computer and a willingness to practise']
      : ['Foundational subject knowledge is recommended'],
    modules: course.modules.map((module) => {
      const moduleLessons = getModuleLessons(module);
      const mapLesson = (lesson) => ({
        id: lesson.id,
        number: lesson.number,
        title: lesson.title,
        completed: completedSet.has(lesson.id),
      });
      return {
        id: module.id,
        title: module.title,
        description: module.description,
        lessonCount: moduleLessons.length,
        completedCount: moduleLessons.filter((lesson) => completedSet.has(lesson.id)).length,
        lessons: moduleLessons.map(mapLesson),
        sections: getModuleSections(module).map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          lessonCount: section.lessons.length,
          completedCount: section.lessons.filter((lesson) => completedSet.has(lesson.id)).length,
          lessons: section.lessons.map(mapLesson),
        })),
      };
    }),
  };
}
