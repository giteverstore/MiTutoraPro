export function getModuleSections(module) {
  return Array.isArray(module?.sections) ? module.sections : [];
}

export function getModuleLessons(module) {
  const sections = getModuleSections(module);
  return sections.length
    ? sections.flatMap((section) => section.lessons ?? [])
    : module?.lessons ?? [];
}

export function getCourseLessons(course) {
  return (course?.modules ?? []).flatMap(getModuleLessons);
}

export function resolveLessonModuleNumber(lessonId, modulesOrCount) {
  if (Array.isArray(modulesOrCount)) {
    const moduleIndex = modulesOrCount.findIndex((module) =>
      getModuleLessons(module).some((lesson) => lesson.id === lessonId));
    return moduleIndex >= 0 ? moduleIndex + 1 : null;
  }

  const moduleCount = modulesOrCount;
  if (!Number.isInteger(moduleCount) || moduleCount < 1) return null;
  const match = String(lessonId ?? '').match(/(?:^|-)(\d+)(?:-|$)/);
  const moduleNumber = Number(match?.[1]);
  return Number.isInteger(moduleNumber) && moduleNumber >= 1 && moduleNumber <= moduleCount
    ? moduleNumber
    : 1;
}

export function findLessonProgressScope(course, lessonId) {
  for (const module of course?.modules ?? []) {
    const section = getModuleSections(module).find((candidate) =>
      (candidate.lessons ?? []).some((lesson) => lesson.id === lessonId));
    if (section) {
      const lessons = section.lessons ?? [];
      return { id: section.id, title: section.title, lessons, index: lessons.findIndex((lesson) => lesson.id === lessonId), module };
    }

    const lessons = module.lessons ?? [];
    const index = lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index >= 0) return { id: module.id, title: module.title, lessons, index, module };
  }
  return null;
}

export function mapModuleLessons(module, mapper) {
  const sections = getModuleSections(module);
  if (!sections.length) return { ...module, lessons: getModuleLessons(module).map(mapper) };
  const mappedSections = sections.map((section) => ({
    ...section,
    lessons: (section.lessons ?? []).map(mapper),
  }));
  return {
    ...module,
    sections: mappedSections,
    lessons: mappedSections.flatMap((section) => section.lessons),
  };
}
