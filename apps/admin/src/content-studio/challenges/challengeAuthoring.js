import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES, validateContent } from '../../../../../shared/content/index.js';

export const challengeUid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const slug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || challengeUid('challenge');

export function createChallengeDraft(id) {
  const challengeId = slug(id);
  return {
    documentId: challengeId, contentId: challengeId, contentType: CONTENT_TYPES.CHALLENGE,
    schemaVersion: CONTENT_SCHEMA_VERSION, version: 1, status: 'draft', locale: 'en',
    metadata: { editor: 'challenge-studio-v1' },
    content: {
      challengeId, date: new Date().toISOString().slice(0, 10), title: 'Untitled Challenge',
      summary: 'Describe the daily coding challenge.', motivation: 'Practice one focused problem today.',
      language: 'python', difficulty: 'easy', topic: 'Fundamentals', estimatedMinutes: 10,
      reward: { coins: 20, streakIncrement: 1 },
      blocks: [{ id: challengeUid('problem'), type: 'paragraph', content: 'Describe the problem.', format: 'plain' }],
      starterCode: '# Write your solution here\n', stdin: '',
      verification: { type: 'expected-output', expectedOutput: 'Hello, World!', comparison: 'normalized-lines' },
      hints: [],
    },
  };
}

export function validateChallengeDraft(draft) {
  const { documentId, draftRevision, lifecycleState, validationSummary, ...canonical } = draft;
  return validateContent(canonical);
}


export function adaptLegacyChallenge(legacy) {
  const compiler = legacy.blocks?.find((block) => block.type === 'compiler');
  if (!compiler) throw new TypeError('Legacy Challenge requires a compiler block.');
  const draft = createChallengeDraft(legacy.id);
  return {
    ...draft,
    content: {
      challengeId: legacy.id, date: legacy.date, title: legacy.title, summary: legacy.summary,
      motivation: legacy.motivation, language: String(compiler.language ?? legacy.language).toLowerCase(),
      difficulty: String(legacy.difficulty).toLowerCase(), topic: legacy.topic,
      estimatedMinutes: legacy.estimatedMinutes, reward: { ...legacy.reward },
      blocks: legacy.blocks.filter((block) => block.type !== 'compiler'),
      starterCode: compiler.starterCode ?? '', stdin: compiler.stdin ?? '',
      verification: { type: 'expected-output', expectedOutput: compiler.expectedOutput ?? '', comparison: compiler.validator === 'exact' ? 'exact' : 'normalized-lines' },
      hints: legacy.hints ?? [],
    },
  };
}
