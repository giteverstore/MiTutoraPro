// Only artwork with an unambiguous match to an existing Course is listed here.
const COURSE_CARD_ARTWORK = Object.freeze({
  python: '/assets/course-cards/python-basics.png',
  java: '/assets/course-cards/java-basics.png',
  'practical-git-and-github': '/assets/course-cards/git.png',
  'ai-prompt-tutorial': '/assets/course-cards/ai-prompt-tutorial.png',
  'c-programming': '/assets/course-cards/c-programming.png',
  'html-fundamentals-for-webpage': '/assets/course-cards/html-fundamentals-for-webpage.png',
  'css-fundamentals-for-webpage': '/assets/course-cards/css-fundamentals-for-webpage.png',
  'build-your-web-app-with-react': '/assets/course-cards/build-your-web-app-with-react.png',
  'react-beyond-basics': '/assets/course-cards/react-beyond-basics.png',
  'sql-basics': '/assets/course-cards/sql-basics.png',
});

export function getCourseCardArtwork(courseId) {
  return COURSE_CARD_ARTWORK[courseId] ?? null;
}
