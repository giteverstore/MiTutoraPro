import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES, validateContent } from '../../../../../shared/content/index.js';

const slug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `practice-${Date.now()}`;
export const practiceUid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
export function createPracticeDraft(id) {
  const questionId = slug(id);
  return { documentId: questionId, contentId: questionId, contentType: CONTENT_TYPES.PRACTICE, schemaVersion: CONTENT_SCHEMA_VERSION, version: 1, status: 'draft', locale: 'en', metadata: { editor: 'practice-studio-v1' }, content: { questionId, title: 'Untitled Practice Question', summary: 'Describe the coding problem.', language: 'python', difficulty: 'Easy', topic: 'Fundamentals', category: 'Programming', subtopic: 'Output', questionType: 'coding', estimatedMinutes: 5, xp: 10, position: 0, tags: [], skills: [], prerequisites: [], blocks: [{ id: practiceUid('problem'), type: 'paragraph', content: 'Write a program that prints Hello, World!', format: 'plain' }], starterCode: '# Write your solution here\n', stdin: '', verification: { type: 'expected-output', expectedOutput: 'Hello, World!', comparison: 'normalized-lines' }, examples: [], constraints: [], hints: [], publicTests: [] } };
}
export const validatePracticeDraft = (draft) => { const { documentId, draftRevision, lifecycleState, validationSummary, ...canonical } = draft; return validateContent(canonical); };

export function practiceArtifact(question, version) {
  const compiler = { id: `${question.questionId}-compiler`, type: 'compiler', language: question.language, starterCode: question.starterCode, stdin: question.stdin, expectedOutput: question.verification.expectedOutput, validation: { type: question.verification.type, comparison: question.verification.comparison } };
  return { id: question.questionId, ...question, blocks: [...question.blocks, compiler], version };
}

export function adaptLegacyPracticeQuestion(question, position = 0) {
  const compiler = question.blocks?.find((block) => block.type === 'compiler') ?? {};
  const language = String(question.implementations ? Object.keys(question.implementations)[0] : question.language).toLowerCase();
  const difficulty = `${String(question.difficulty ?? 'easy').charAt(0).toUpperCase()}${String(question.difficulty ?? 'easy').slice(1).toLowerCase()}`;
  return { ...createPracticeDraft(question.id), content: { questionId: question.id, title: question.title, summary: question.summary, language, difficulty, topic: question.topic, category: question.category, subtopic: question.subtopic, questionType: question.questionType, estimatedMinutes: question.estimatedMinutes, xp: question.xp, position, tags: [], skills: question.skills ?? [], prerequisites: question.prerequisites ?? [], blocks: (question.blocks ?? []).filter((block) => block.type !== 'compiler'), starterCode: compiler.starterCode ?? '', stdin: compiler.stdin ?? '', verification: { type: 'expected-output', expectedOutput: compiler.expectedOutput ?? '', comparison: compiler.validator === 'exact' ? 'exact' : 'normalized-lines' }, examples: question.examples ?? [], constraints: question.constraints ?? [], hints: question.hints ?? [], publicTests: question.publicTests ?? [], contract: question.contract, expectedComplexity: question.expectedComplexity, commonMistakes: question.commonMistakes ?? [], concepts: question.concepts ?? [] } };
}
