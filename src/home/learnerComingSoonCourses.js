// Learner presentation placeholders only; canonical Course records are unchanged.
export const learnerComingSoonCourses = Object.freeze([
  { id: 'c-programming', title: 'C Programming', filter: 'C' },
  { id: 'html-fundamentals-for-webpage', title: 'HTML Fundamentals for Webpage', filter: 'HTML' },
  { id: 'css-fundamentals-for-webpage', title: 'CSS Fundamentals for Webpage', filter: 'CSS' },
  { id: 'build-your-web-app-with-react', title: 'Build Your Web App with React', filter: 'React' },
  { id: 'react-beyond-basics', title: 'React Beyond Basics', filter: 'React' },
  { id: 'sql-basics', title: 'SQL Basics', filter: 'SQL' },
].map((course) => Object.freeze({ ...course, description: '', available: false, kind: 'languages' })));

export const learnerComingSoonIds = new Set(learnerComingSoonCourses.map(({ id }) => id));
