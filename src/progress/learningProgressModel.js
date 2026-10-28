function getEstimatedMinutes(lesson) {
  if (Number.isFinite(lesson.estimatedMinutes)) return lesson.estimatedMinutes;
  const detail = lesson.details?.find((item) => /\d+\s*min/i.test(item));
  return detail ? Number.parseInt(detail, 10) : 10;
}

export function getCourseLessons(course) {
  return course.modules.flatMap((module) => module.lessons.map((lesson) => ({ lesson, module })));
}

export function getModuleIdForLesson(course, lessonId) {
  return course.modules.find((module) => module.lessons.some((lesson) => lesson.id === lessonId))?.id ?? null;
}

export function deriveProgress(course, stored) {
  const entries = getCourseLessons(course);
  const lessonIds = new Set(entries.map(({ lesson }) => lesson.id));
  const contentIsComplete = course.contentLoadState?.isComplete !== false;
  const completedLessons = [...new Set(stored.completedLessons ?? [])].filter((lessonId) => !contentIsComplete || lessonIds.has(lessonId));
  const completedSet = new Set(completedLessons);
  const visitedLessons = [...new Set([...(stored.visitedLessons ?? []), ...completedLessons])].filter((lessonId) => !contentIsComplete || lessonIds.has(lessonId));
  let sequentialCompletedLessons = 0;
  const contiguousModuleCount = course.contentLoadState?.contiguousModuleCount ?? course.modules.length;
  const sequentialEntries = contentIsComplete
    ? entries
    : course.modules.slice(0, contiguousModuleCount).flatMap((module) => module.lessons.map((lesson) => ({ lesson, module })));
  for (const { lesson } of sequentialEntries) {
    if (!completedSet.has(lesson.id)) break;
    sequentialCompletedLessons += 1;
  }
  if (!contentIsComplete && sequentialEntries.length === 0) sequentialCompletedLessons = stored.sequentialCompletedLessons ?? 0;
  const completedModules = course.modules
    .filter((module) => {
      const availableLessons = module.lessons.filter((lesson) => lessonIds.has(lesson.id));
      return availableLessons.length > 0 && availableLessons.every((lesson) => completedSet.has(lesson.id));
    })
    .map((module) => module.id);
  if (!contentIsComplete) {
    const loadedModuleIds = new Set(course.modules.map((module) => module.id));
    for (const moduleId of stored.completedModules ?? []) if (!loadedModuleIds.has(moduleId)) completedModules.push(moduleId);
  }
  const estimatedTimeRemaining = entries.reduce((minutes, { lesson }) => completedSet.has(lesson.id) ? minutes : minutes + getEstimatedMinutes(lesson), 0);

  return {
    ...stored,
    completedLessons,
    visitedLessons,
    completedModules,
    bookmarks: [...new Set(stored.bookmarks ?? [])].filter((lessonId) => !contentIsComplete || lessonIds.has(lessonId)),
    quizScores: stored.quizScores ?? {},
    exerciseCompletion: stored.exerciseCompletion ?? {},
    sequentialCompletedLessons,
    visitedLessonCount: visitedLessons.length,
    completedLessonCount: completedLessons.length,
    courseProgress: (course.contentLoadState?.totalLessonCount ?? entries.length)
      ? Math.round((sequentialCompletedLessons / (course.contentLoadState?.totalLessonCount ?? entries.length)) * 100)
      : 0,
    estimatedTimeRemaining: contentIsComplete ? estimatedTimeRemaining : stored.estimatedTimeRemaining ?? estimatedTimeRemaining,
  };
}

export function createInitialProgress(course, currentLessonId, existingCompletedLessons = [], existingBookmarks = [], existingVisitedLessons = []) {
  const completedLessons = [...existingCompletedLessons, ...course.modules.flatMap((module) => module.lessons.filter((lesson) => lesson.status === 'complete').map((lesson) => lesson.id))];
  const currentLesson = currentLessonId ?? course.navigation?.defaultLessonId ?? course.defaultLessonId;
  return deriveProgress(course, {
    contentVersion: Number.isSafeInteger(course.contentVersion ?? course.publishedVersion) ? (course.contentVersion ?? course.publishedVersion) : null,
    currentLesson,
    currentModule: getModuleIdForLesson(course, currentLesson),
    completedLessons,
    visitedLessons: [...new Set(existingVisitedLessons)],
    completedModules: [],
    quizScores: {},
    exerciseCompletion: {},
    bookmarks: [...new Set(existingBookmarks)],
    courseProgress: 0,
    sequentialCompletedLessons: 0,
    visitedLessonCount: 0,
    completedLessonCount: 0,
    estimatedTimeRemaining: 0,
    updatedAt: null,
  });
}
