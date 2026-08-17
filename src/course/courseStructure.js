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
