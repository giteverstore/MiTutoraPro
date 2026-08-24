const unique = (values = []) => [...new Set(values)];

function mergeRecord(remote = {}, incoming = {}) {
  return Object.fromEntries(unique([...Object.keys(remote), ...Object.keys(incoming)]).map((key) => {
    const previous = remote[key];
    const next = incoming[key];
    if (!previous) return [key, next];
    if (!next) return [key, previous];
    if (previous.completed && !next.completed) return [key, previous];
    const previousTime = Date.parse(previous.completedAt ?? previous.verifiedAt ?? previous.lastAttemptAt ?? 0) || 0;
    const nextTime = Date.parse(next.completedAt ?? next.verifiedAt ?? next.lastAttemptAt ?? 0) || 0;
    return [key, nextTime >= previousTime ? { ...previous, ...next } : previous];
  }));
}

export function reconcileStaleProgress(remote, incoming) {
  return {
    ...incoming,
    currentModule: remote.currentModule ?? incoming.currentModule ?? null,
    currentLesson: remote.currentLesson ?? incoming.currentLesson ?? null,
    completedLessons: unique([...(remote.completedLessons ?? []), ...(incoming.completedLessons ?? [])]),
    visitedLessons: unique([...(remote.visitedLessons ?? []), ...(incoming.visitedLessons ?? [])]),
    completedModules: unique([...(remote.completedModules ?? []), ...(incoming.completedModules ?? [])]),
    bookmarks: unique([...(remote.bookmarks ?? []), ...(incoming.bookmarks ?? [])]),
    completedExercises: mergeRecord(remote.completedExercises, incoming.completedExercises),
    exerciseCompletion: mergeRecord(remote.exerciseCompletion, incoming.exerciseCompletion),
    completedQuizzes: mergeRecord(remote.completedQuizzes, incoming.completedQuizzes),
    quizScores: mergeRecord(remote.quizScores, incoming.quizScores),
    sequentialCompletedLessons: Math.max(remote.sequentialCompletedLessons ?? 0, incoming.sequentialCompletedLessons ?? 0),
    completedLessonCount: Math.max(remote.completedLessonCount ?? 0, incoming.completedLessonCount ?? 0),
    visitedLessonCount: Math.max(remote.visitedLessonCount ?? 0, incoming.visitedLessonCount ?? 0),
    completion: Math.max(remote.completion ?? 0, incoming.completion ?? 0),
    courseProgress: Math.max(remote.courseProgress ?? 0, incoming.courseProgress ?? 0),
    startedAt: remote.startedAt ?? incoming.startedAt,
  };
}

export function prepareProgressWrite(remote, incoming, expectedRevision = 0) {
  const remoteRevision = remote?.revision ?? 0;
  const data = expectedRevision < remoteRevision
    ? reconcileStaleProgress(remote, incoming)
    : incoming;
  return { ...data, revision: remoteRevision + 1 };
}
