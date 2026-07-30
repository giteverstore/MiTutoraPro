export const BOOKMARK_TYPES = Object.freeze({
  course: 'course',
  practice: 'practice',
  challenge: 'challenge',
});

export function createBookmark({
  type,
  contentId,
  title,
  description = '',
  language = '',
  topic = '',
  target,
}) {
  if (!Object.values(BOOKMARK_TYPES).includes(type)) {
    throw new Error(`Unsupported bookmark type "${type}".`);
  }
  return {
    id: `${type}:${contentId}`,
    type,
    contentId,
    title,
    description,
    language,
    topic,
    target,
    savedAt: new Date().toISOString(),
  };
}

export const createCourseLessonBookmark = ({ course, module, lesson }) => createBookmark({
  type: BOOKMARK_TYPES.course,
  contentId: lesson.id,
  title: lesson.title,
  description: lesson.summary,
  language: course.metadata?.tags?.includes('python') ? 'Python' : '',
  topic: module?.title ?? course.title,
  target: { page: 'course', courseId: course.id, lessonId: lesson.id },
});

export const createPracticeBookmark = (question) => createBookmark({
  type: BOOKMARK_TYPES.practice,
  contentId: question.id,
  title: question.title,
  description: question.summary,
  language: question.language,
  topic: question.topic,
  target: { page: 'practice', questionId: question.id },
});

export const createChallengeBookmark = (challenge) => createBookmark({
  type: BOOKMARK_TYPES.challenge,
  contentId: challenge.id,
  title: challenge.title,
  description: challenge.summary,
  language: challenge.language,
  topic: challenge.topic,
  target: { page: 'challenges', challengeId: challenge.id },
});
