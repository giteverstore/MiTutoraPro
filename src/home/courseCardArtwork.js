// Only artwork with an unambiguous match to an existing Course is listed here.
const COURSE_CARD_ARTWORK = Object.freeze({
  python: '/assets/course-cards/python-basics.webp',
  java: '/assets/course-cards/java-basics.webp',
  'practical-git-and-github': '/assets/course-cards/git.webp',
  'ai-prompt-tutorial': '/assets/course-cards/ai-prompt-tutorial.webp',
  'c-programming': '/assets/course-cards/c-programming.webp',
  'html-fundamentals-for-webpage': '/assets/course-cards/html-fundamentals-for-webpage.webp',
  'css-fundamentals-for-webpage': '/assets/course-cards/css-fundamentals-for-webpage.webp',
  'build-your-web-app-with-react': '/assets/course-cards/build-your-web-app-with-react.webp',
  'react-beyond-basics': '/assets/course-cards/react-beyond-basics.webp',
  'sql-basics': '/assets/course-cards/sql-basics.webp',
});

export function getCourseCardArtwork(courseId) {
  return COURSE_CARD_ARTWORK[courseId] ?? null;
}
