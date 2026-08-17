const domainNames = [
  'Artificial Intelligence',
  'Machine Learning',
  'Data Science',
  'Data Analytics',
  'Cloud Computing',
  'DevOps',
  'Cyber Security',
  'Web Development',
  'Backend Development',
  'Frontend Development',
  'Mobile Development',
  'Game Development',
  'Blockchain',
  'Networking',
  'Databases',
];

const languageNames = [
  'Python',
  'Java',
  'C++',
  'JavaScript',
  'TypeScript',
  'Go',
  'Rust',
  'Kotlin',
  'Swift',
  'C#',
  'SQL',
  'Dart',
];

const courseDetails = {
  Python: {
    id: 'python',
    title: 'Python Foundations',
    description: 'Build a practical foundation through guided lessons, quizzes, and exercises.',
    level: 'Beginner',
    duration: '12h 32m',
    lessonCount: 109,
    progress: 38,
    available: true,
  },
  'Artificial Intelligence': {
    title: 'AI Foundations',
    description: 'Understand intelligent systems, modern models, and responsible AI workflows.',
    level: 'Beginner',
    duration: '7h 20m',
    lessonCount: 24,
    badge: 'Popular',
  },
  'Web Development': {
    title: 'Modern Web Development',
    description: 'Create accessible, responsive websites with the core tools of the web.',
    level: 'Beginner',
    duration: '9h 10m',
    lessonCount: 32,
  },
  'Data Science': {
    title: 'Data Science Essentials',
    description: 'Turn raw datasets into useful insights with a repeatable analysis process.',
    level: 'Intermediate',
    duration: '8h 30m',
    lessonCount: 28,
  },
  JavaScript: {
    title: 'JavaScript Essentials',
    description: 'Learn the language of the web through focused examples and practice.',
    level: 'Beginner',
    duration: '6h 45m',
    lessonCount: 30,
  },
};

function toId(value) {
  return value.toLowerCase().replace(/[+#]/g, (match) => ({ '+': 'plus', '#': 'sharp' })[match])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function createCourse(name, kind, index) {
  const details = courseDetails[name] ?? {};
  return {
    id: details.id ?? `${kind}-${toId(name)}`,
    title: details.title ?? `${name} Essentials`,
    description: details.description
      ?? `Develop job-ready ${name.toLowerCase()} skills through structured, practical learning.`,
    level: details.level ?? (index % 4 === 3 ? 'Intermediate' : 'Beginner'),
    duration: details.duration ?? `${4 + (index % 5)}h ${10 + ((index * 7) % 5) * 10}m`,
    lessonCount: details.lessonCount ?? 18 + ((index * 3) % 17),
    progress: details.progress ?? 0,
    badge: details.badge,
    available: details.available ?? false,
    filter: name,
    kind,
  };
}

export const browseCatalog = {
  domains: domainNames.map((name, index) => createCourse(name, 'domains', index)),
  languages: languageNames.map((name, index) => createCourse(name, 'languages', index)),
};

export const homeData = {
  continueLearning: {
    ...browseCatalog.languages[0],
    currentModule: 'Module 4 · Python Variables',
    currentLesson: 'Print Variables',
  },
  recentlyViewed: [
    browseCatalog.languages[0],
    browseCatalog.domains[2],
    browseCatalog.domains[7],
  ],
  statistics: [
    { id: 'courses', label: 'Courses enrolled', value: '3' },
    { id: 'lessons', label: 'Lessons completed', value: '26' },
    { id: 'streak', label: 'Current streak', value: '8 days' },
    { id: 'hours', label: 'Hours learned', value: '14.5' },
  ],
};
