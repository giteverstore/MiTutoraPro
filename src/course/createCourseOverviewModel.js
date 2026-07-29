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
  const lessons = course.modules.flatMap((module) => module.lessons);
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
    moduleCount: course.modules.length,
    lessonCount: lessons.length,
    quizCount: blocks.filter(({ type }) => type === 'quiz').length,
    exerciseCount: blocks.filter(({ type }) => type === 'exercise').length,
    certificateAvailable: course.status !== 'archived',
    skills: skills.length ? skills : ['Core concepts', 'Practical problem solving'],
    prerequisites: course.metadata?.level === 'beginner'
      ? ['No prior programming experience required', 'A computer and a willingness to practise']
      : ['Foundational subject knowledge is recommended'],
    modules: course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      lessonCount: module.lessons.length,
      completedCount: module.lessons.filter((lesson) => completedSet.has(lesson.id)).length,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        number: lesson.number,
        title: lesson.title,
        completed: completedSet.has(lesson.id),
      })),
    })),
  };
}
