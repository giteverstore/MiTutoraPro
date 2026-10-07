export const CONTENT_SCHEMA_VERSION = '1.0.0';

export const CONTENT_TYPES = Object.freeze({
  PROJECT: 'PROJECT',
  COURSE: 'COURSE',
  PRACTICE: 'PRACTICE',
  CHALLENGE: 'CHALLENGE',
});

export const CONTENT_STATUSES = Object.freeze(['draft', 'published', 'archived']);

// These IDs mirror the compiler registry IDs. New languages must be added here
// as part of the same change that registers the runtime, preventing aliases in content.
export const CANONICAL_LANGUAGE_IDS = Object.freeze([
  'python', 'java', 'javascript', 'typescript', 'html-css', 'react', 'sql',
  'c', 'cpp', 'mysql', 'php', 'r', 'csharp', 'visualbasic', 'assembly', 'go', 'rust',
]);

export const COMMON_BLOCK_TYPES = Object.freeze([
  'heading', 'paragraph', 'list', 'code', 'callout', 'image', 'table',
  'expected-output', 'terminal-command', 'divider', 'concept', 'requirements',
  'common-mistakes',
]);

export const IMPLEMENTATION_CONTRACT_KINDS = Object.freeze([
  'variable', 'constant', 'function', 'method', 'class', 'file', 'collection',
]);

export const VALIDATOR_TYPES = Object.freeze([
  'execution_succeeds', 'output_contains', 'file_exists', 'source_pattern',
  'function_behavior', 'runtime_scenario',
]);

export const VALIDATOR_SEVERITIES = Object.freeze(['error', 'warning']);
export const HINT_LEVELS = Object.freeze(['hint', 'deeper_hint', 'focused_example', 'reference']);

const CONTENT_TYPE_ALIASES = Object.freeze({ project: CONTENT_TYPES.PROJECT, course: CONTENT_TYPES.COURSE, practice: CONTENT_TYPES.PRACTICE, challenge: CONTENT_TYPES.CHALLENGE });
export function normalizeContentType(value) {
  if (Object.values(CONTENT_TYPES).includes(value)) return value;
  return CONTENT_TYPE_ALIASES[String(value ?? '').trim().toLowerCase()] ?? null;
}
