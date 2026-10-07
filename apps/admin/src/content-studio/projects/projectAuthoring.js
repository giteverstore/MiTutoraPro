import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES, validateProjectContent } from '../../../../../shared/content/index.js';
import { createBlock } from '../blocks/blockDefinitions.js';

export const PROJECT_LANGUAGES = Object.freeze([
  ['python', 'Python', 'main.py'], ['java', 'Java', 'Main.java'], ['javascript', 'JavaScript', 'main.js'],
  ['typescript', 'TypeScript', 'main.ts'], ['cpp', 'C++', 'main.cpp'], ['c', 'C', 'main.c'],
]);
export const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export function createProjectDraft(projectId = uid('project')) {
  return { documentId: projectId, contentId: projectId, contentType: CONTENT_TYPES.PROJECT, schemaVersion: CONTENT_SCHEMA_VERSION, version: 1, status: 'draft', locale: 'en', metadata: { editor: 'project-studio-v1' }, content: {
    projectId, title: 'Untitled Project', description: 'Describe what learners will build.', difficulty: 'Beginner', estimatedMinutes: 60,
    category: 'Project', tags: [], prerequisites: [], learningOutcomes: ['Complete the guided project.'], supportedLanguages: ['python'],
    starterWorkspaces: { python: { entrypoint: 'main.py', runtimeId: 'python', files: [{ path: 'main.py', content: '# Start building here\n' }] } },
    projectFacts: [], implementationContracts: [], checkpoints: [], finalValidators: [], completionBlocks: [], mentor: {},
  } };
}
export const reindex = (items) => items.map((item, index) => ({ ...item, order: index + 1 }));
export const newCheckpoint = () => ({ checkpointId: uid('checkpoint'), order: 1, title: 'New checkpoint', summary: 'Describe this checkpoint goal.', blocks: [], tasks: [], validators: [], completionBlocks: [], mentor: {} });
export const newTask = () => ({ taskId: uid('task'), order: 1, title: 'New task', objective: 'Describe what the learner will build.', why: 'Explain why this task matters.', blocks: [], implementationContractIds: [], expectedBehavior: [], validators: [], mentor: {} });
export const newContract = () => ({ contractId: uid('contract'), name: 'NEW_CONTRACT', kind: 'constant', semanticType: 'integer', purpose: 'Describe this implementation contract.', languageVariants: {} });
export const newValidator = () => ({ validatorId: uid('validator'), type: 'execution_succeeds', version: 1, severity: 'error', configuration: {}, failureMessage: 'Your program must compile and run successfully.' });
export const newHint = () => ({ hintId: uid('hint'), level: 'hint', text: 'Add a helpful conceptual hint.' });
export const validateProjectDraft = (draft) => validateProjectContent(draft.content);
export const addDefaultBlock = () => createBlock('paragraph');
