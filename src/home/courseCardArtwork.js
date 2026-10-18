// Only artwork with an unambiguous match to an existing Course is listed here.
const COURSE_CARD_ARTWORK = Object.freeze({
  python: '/assets/course-cards/python-basics.png',
  java: '/assets/course-cards/java-basics.png',
  'practical-git-and-github': '/assets/course-cards/git.png',
  'ai-prompt-tutorial': '/assets/course-cards/ai-prompt-tutorial.png',
});

export function getCourseCardArtwork(courseId) {
  return COURSE_CARD_ARTWORK[courseId] ?? null;
}
