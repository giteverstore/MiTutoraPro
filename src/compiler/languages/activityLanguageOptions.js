import { CANONICAL_LANGUAGE_IDS } from '../../../shared/content/constants.js';

const ACTIVITY_LANGUAGE_IDS = Object.freeze([
  'python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'php', 'r', 'csharp',
]);

const LABELS = Object.freeze({
  python: 'Python', java: 'Java', javascript: 'JavaScript', typescript: 'TypeScript',
  c: 'C', cpp: 'C++', php: 'PHP', r: 'R', csharp: 'C#',
});

const canonicalIds = new Set(CANONICAL_LANGUAGE_IDS);
export const ACTIVITY_LANGUAGE_OPTIONS = Object.freeze(ACTIVITY_LANGUAGE_IDS.map((id) => {
  if (!canonicalIds.has(id)) throw new Error(`Activity language is not canonical: ${id}`);
  return Object.freeze({ id, label: LABELS[id] });
}));
