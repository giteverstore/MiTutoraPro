import { fundamentalsVariablesBatch1 } from './data/fundamentalsVariablesBatch1.js';
import { fundamentalsConditionalsBatch2 } from './data/fundamentalsConditionalsBatch2.js';
import { fundamentalsLoopsBatch3 } from './data/fundamentalsLoopsBatch3.js';
import { fundamentalsFunctionsBatch4 } from './data/fundamentalsFunctionsBatch4.js';
import { fundamentalsStringsBatch5 } from './data/fundamentalsStringsBatch5.js';
import { fundamentalsArraysBatch6 } from './data/fundamentalsArraysBatch6.js';
import { fundamentalsDictionariesBatch7 } from './data/fundamentalsDictionariesBatch7.js';
import { fundamentalsSetsBatch8 } from './data/fundamentalsSetsBatch8.js';
import { fundamentalsInputOutputBatch9 } from './data/fundamentalsInputOutputBatch9.js';
import { fundamentalsErrorsMixedBatch10 } from './data/fundamentalsErrorsMixedBatch10.js';

const compiler = (id, starterCode, expectedOutput, stdin = '') => ({
  id,
  type: 'compiler',
  language: 'python',
  starterCode,
  stdin,
  expectedOutput,
  validator: 'normalized',
  runLabel: 'Run Code',
  resetLabel: 'Reset',
});

const legacyPracticeQuestions = [
  {
    schemaVersion: '1.0.0',
    id: 'practice-even-or-odd',
    title: 'Even or Odd',
    summary: 'Determine whether a given integer is even or odd.',
    language: 'Python',
    difficulty: 'easy',
    topic: 'Conditionals',
    estimatedMinutes: 8,
    xp: 40,
    blocks: [
      { id: 'even-heading', type: 'heading', level: 2, text: 'Problem Statement' },
      { id: 'even-copy', type: 'paragraph', content: 'Read one integer and print `Even` when it is divisible by 2. Otherwise, print `Odd`.', format: 'markdown' },
      { id: 'even-example-heading', type: 'heading', level: 3, text: 'Example' },
      { id: 'even-example', type: 'code', language: 'text', code: 'Input\n8\n\nOutput\nEven', caption: 'A single even input' },
      { id: 'even-constraints', type: 'note', title: 'Constraints', content: 'The input is an integer between -1,000,000 and 1,000,000.', format: 'plain' },
      compiler('even-compiler', 'number = int(input())\n# Print Even or Odd\n', 'Even', '8'),
    ],
  },
  {
    schemaVersion: '1.0.0',
    id: 'practice-sum-range',
    title: 'Sum from 1 to N',
    summary: 'Use iteration to calculate a simple arithmetic total.',
    language: 'Python',
    difficulty: 'easy',
    topic: 'Loops',
    estimatedMinutes: 10,
    xp: 50,
    blocks: [
      { id: 'sum-heading', type: 'heading', level: 2, text: 'Problem Statement' },
      { id: 'sum-copy', type: 'paragraph', content: 'Read a positive integer `n` and print the sum of every integer from 1 through `n`.', format: 'markdown' },
      { id: 'sum-example-heading', type: 'heading', level: 3, text: 'Example' },
      { id: 'sum-example', type: 'code', language: 'text', code: 'Input\n5\n\nOutput\n15' },
      { id: 'sum-constraints', type: 'note', title: 'Constraints', content: '1 ≤ n ≤ 10,000', format: 'plain' },
      compiler('sum-compiler', 'n = int(input())\ntotal = 0\n# Add the numbers from 1 to n\nprint(total)\n', '15', '5'),
    ],
  },
  {
    schemaVersion: '1.0.0',
    id: 'practice-reverse-text',
    title: 'Reverse a String',
    summary: 'Transform a string while preserving every character.',
    language: 'Python',
    difficulty: 'easy',
    topic: 'Strings',
    estimatedMinutes: 8,
    xp: 45,
    blocks: [
      { id: 'reverse-heading', type: 'heading', level: 2, text: 'Problem Statement' },
      { id: 'reverse-copy', type: 'paragraph', content: 'Read one line of text and print its characters in reverse order.' },
      { id: 'reverse-example-heading', type: 'heading', level: 3, text: 'Example' },
      { id: 'reverse-example', type: 'code', language: 'text', code: 'Input\nMiTutora\n\nOutput\narotuTiM' },
      compiler('reverse-compiler', 'text = input()\n# Print text in reverse\n', 'arotuTiM', 'MiTutora'),
    ],
  },
  {
    schemaVersion: '1.0.0',
    id: 'practice-largest-number',
    title: 'Largest Number',
    summary: 'Find the maximum value without changing the input order.',
    language: 'Python',
    difficulty: 'medium',
    topic: 'Lists',
    estimatedMinutes: 12,
    xp: 70,
    blocks: [
      { id: 'largest-heading', type: 'heading', level: 2, text: 'Problem Statement' },
      { id: 'largest-copy', type: 'paragraph', content: 'Read space-separated integers and print the largest value.' },
      { id: 'largest-example-heading', type: 'heading', level: 3, text: 'Example' },
      { id: 'largest-example', type: 'code', language: 'text', code: 'Input\n4 9 2 7\n\nOutput\n9' },
      { id: 'largest-constraints', type: 'note', title: 'Constraints', content: 'The list contains between 1 and 1,000 integers.' },
      compiler('largest-compiler', 'numbers = list(map(int, input().split()))\n# Find and print the largest number\n', '9', '4 9 2 7'),
    ],
  },
  {
    schemaVersion: '1.0.0',
    id: 'practice-word-frequency',
    title: 'Word Frequency',
    summary: 'Count repeated words with a dictionary.',
    language: 'Python',
    difficulty: 'medium',
    topic: 'Dictionaries',
    estimatedMinutes: 16,
    xp: 90,
    blocks: [
      { id: 'frequency-heading', type: 'heading', level: 2, text: 'Problem Statement' },
      { id: 'frequency-copy', type: 'paragraph', content: 'Read a line of lowercase words. Print the count of `python`.' },
      { id: 'frequency-example-heading', type: 'heading', level: 3, text: 'Example' },
      { id: 'frequency-example', type: 'code', language: 'text', code: 'Input\npython makes python approachable\n\nOutput\n2' },
      compiler('frequency-compiler', 'words = input().split()\n# Count the word python\n', '2', 'python makes python approachable'),
    ],
  },
  {
    schemaVersion: '1.0.0',
    id: 'practice-palindrome',
    title: 'Palindrome Check',
    summary: 'Combine normalization and comparison to inspect text.',
    language: 'Python',
    difficulty: 'hard',
    topic: 'Strings',
    estimatedMinutes: 20,
    xp: 120,
    blocks: [
      { id: 'palindrome-heading', type: 'heading', level: 2, text: 'Problem Statement' },
      { id: 'palindrome-copy', type: 'paragraph', content: 'Read a phrase, ignore spaces and letter case, then print `True` if it is a palindrome and `False` otherwise.', format: 'markdown' },
      { id: 'palindrome-example-heading', type: 'heading', level: 3, text: 'Example' },
      { id: 'palindrome-example', type: 'code', language: 'text', code: 'Input\nNever odd or even\n\nOutput\nTrue' },
      compiler('palindrome-compiler', 'phrase = input()\n# Normalize the phrase and check it\n', 'True', 'Never odd or even'),
    ],
  },
];

export const practiceQuestions = [
  ...fundamentalsVariablesBatch1,
  ...legacyPracticeQuestions,
  ...fundamentalsConditionalsBatch2,
  ...fundamentalsLoopsBatch3,
  ...fundamentalsFunctionsBatch4,
  ...fundamentalsStringsBatch5,
  ...fundamentalsArraysBatch6,
  ...fundamentalsDictionariesBatch7,
  ...fundamentalsSetsBatch8,
  ...fundamentalsInputOutputBatch9,
  ...fundamentalsErrorsMixedBatch10,
];

export const practiceStatistics = {
  solved: 12,
  attempted: 18,
  successRate: 67,
};

export const initiallySolvedQuestionIds = ['practice-even-or-odd'];
