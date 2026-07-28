export function createCourseNavigation(course) {
  const entries = course.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ lesson, module })),
  );
  const entryByLessonId = new Map(
    entries.map((entry, index) => [entry.lesson.id, { ...entry, index }]),
  );
  const skipLocked = course.navigation?.skipLockedLessons ?? true;

  const isNavigable = (lesson) =>
    !skipLocked || !['locked', 'coming-soon'].includes(lesson.status);

  const resolveEntry = (lessonId) => {
    const entry = entryByLessonId.get(lessonId);
    return entry && isNavigable(entry.lesson) ? entry : null;
  };

  const findLinearEntry = (currentIndex, direction) => {
    for (
      let index = currentIndex + direction;
      index >= 0 && index < entries.length;
      index += direction
    ) {
      if (isNavigable(entries[index].lesson)) return { ...entries[index], index };
    }
    return null;
  };

  const getNextOptions = (currentEntry) => {
    const lessonNavigation = currentEntry.lesson.navigation;

    if (lessonNavigation?.branches?.length) {
      return lessonNavigation.branches.flatMap((branch) => {
        const target = resolveEntry(branch.targetLessonId);
        return target ? [{ ...branch, lesson: target.lesson, module: target.module }] : [];
      });
    }

    if (lessonNavigation?.nextLessonId) {
      const target = resolveEntry(lessonNavigation.nextLessonId);
      return target ? [{
        id: `next-${target.lesson.id}`,
        label: target.lesson.title,
        isDefault: true,
        lesson: target.lesson,
        module: target.module,
      }] : [];
    }

    const target = findLinearEntry(currentEntry.index, 1);
    return target ? [{
      id: `next-${target.lesson.id}`,
      label: target.lesson.title,
      isDefault: true,
      lesson: target.lesson,
      module: target.module,
    }] : [];
  };

  const getPreviousEntry = (currentEntry) => {
    const explicitPreviousId = currentEntry.lesson.navigation?.previousLessonId;
    if (explicitPreviousId) return resolveEntry(explicitPreviousId);

    const incomingEntry = entries.find((entry) => {
      const navigation = entry.lesson.navigation;
      return navigation?.nextLessonId === currentEntry.lesson.id
        || navigation?.branches?.some(
          (branch) => branch.targetLessonId === currentEntry.lesson.id,
        );
    });

    return incomingEntry
      ? resolveEntry(incomingEntry.lesson.id)
      : findLinearEntry(currentEntry.index, -1);
  };

  const getState = (currentLessonId) => {
    const currentEntry = entryByLessonId.get(currentLessonId) ?? null;
    if (!currentEntry) {
      return {
        currentModule: null,
        currentLesson: null,
        previousLesson: null,
        nextLesson: null,
        nextLessonOptions: [],
        currentBlockList: [],
      };
    }

    const nextLessonOptions = getNextOptions(currentEntry);
    const defaultOption = nextLessonOptions.find((option) => option.isDefault)
      ?? nextLessonOptions[0]
      ?? null;
    const previousEntry = getPreviousEntry(currentEntry);

    return {
      currentModule: currentEntry.module,
      currentLesson: currentEntry.lesson,
      previousLesson: previousEntry?.lesson ?? null,
      nextLesson: defaultOption?.lesson ?? null,
      nextLessonOptions,
      currentBlockList: currentEntry.lesson.blocks ?? [],
    };
  };

  return {
    getState,
    canNavigateTo: (lessonId) => Boolean(resolveEntry(lessonId)),
  };
}
