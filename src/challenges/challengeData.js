export const dailyChallenge = {
  schemaVersion: '1.0.0',
  id: 'challenge-balanced-brackets',
  date: '2026-07-30',
  title: 'Balanced Brackets',
  summary: 'Use a stack to decide whether every opening bracket is closed in the correct order.',
  motivation: 'One focused problem today keeps your problem-solving momentum alive.',
  language: 'Python',
  difficulty: 'medium',
  topic: 'Stacks',
  estimatedMinutes: 18,
  reward: {
    coins: 10,
    streakIncrement: 1,
  },
  blocks: [
    {
      id: 'challenge-heading',
      type: 'heading',
      level: 2,
      text: 'Problem Statement',
    },
    {
      id: 'challenge-description',
      type: 'paragraph',
      content: 'Read a string containing only `()`, `[]`, and `{}`. Print `Balanced` when every opening bracket has a matching closing bracket in the correct order. Otherwise, print `Not Balanced`.',
      format: 'markdown',
    },
    {
      id: 'challenge-example-heading',
      type: 'heading',
      level: 3,
      text: 'Example',
    },
    {
      id: 'challenge-example',
      type: 'code',
      language: 'text',
      code: 'Input\n{[()]}\n\nOutput\nBalanced',
      caption: 'Nested bracket pairs close in reverse order.',
    },
    {
      id: 'challenge-constraints',
      type: 'note',
      title: 'Constraints',
      content: 'The input contains between 1 and 10,000 bracket characters. No spaces or other characters are included.',
      format: 'plain',
    },
    {
      id: 'challenge-compiler',
      type: 'compiler',
      language: 'python',
      starterCode: "brackets = input().strip()\nstack = []\npairs = {')': '(', ']': '[', '}': '{'}\n\n# Check whether the brackets are balanced\n\n",
      stdin: '{[()]}',
      expectedOutput: 'Balanced',
      validator: 'normalized',
      runLabel: 'Run Code',
      resetLabel: 'Reset',
    },
  ],
};

export const challengeHistory = [
  { id: 'history-1', date: 'Jul 29', title: 'First Unique Character', difficulty: 'medium', reward: 10, completed: true },
  { id: 'history-2', date: 'Jul 28', title: 'Count the Vowels', difficulty: 'easy', reward: 10, completed: true },
  { id: 'history-3', date: 'Jul 27', title: 'Rotate a List', difficulty: 'medium', reward: 10, completed: true },
  { id: 'history-4', date: 'Jul 26', title: 'Prime Number Check', difficulty: 'easy', reward: 10, completed: false },
  { id: 'history-5', date: 'Jul 25', title: 'Flatten One Level', difficulty: 'hard', reward: 10, completed: true },
];

export const challengeStats = {
  currentStreak: 7,
  longestStreak: 14,
  completedThisMonth: 19,
};
