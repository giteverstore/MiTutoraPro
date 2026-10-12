import { resolveLanguageVariant } from './normalization.js';

function textFromBlock(block, language) {
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'callout') return resolveLanguageVariant(block.text, language);
  if (block.type === 'list' || block.type === 'requirements' || block.type === 'common-mistakes') return block.items.join('\n');
  if (block.type === 'concept') return `${block.title ?? block.conceptId}: ${block.text}`;
  return null;
}

export function deriveMentorContext(project, checkpointId, taskId, language) {
  if (!project.supportedLanguages.includes(language)) throw new TypeError(`Unsupported project language: ${language}`);
  const checkpoint = project.checkpoints.find((entry) => entry.checkpointId === checkpointId);
  const task = checkpoint?.tasks.find((entry) => entry.taskId === taskId);
  if (!checkpoint || !task) throw new TypeError('Unknown checkpoint/task mentor context.');
  const contracts = (task.implementationContractIds ?? []).map((contractId) => project.implementationContracts.find((entry) => entry.contractId === contractId)).filter(Boolean);
  const commonMistakes = task.blocks.filter(({ type }) => type === 'common-mistakes').flatMap(({ items }) => items);
  return Object.freeze({
    project: Object.freeze({ projectId: project.projectId, title: project.title, facts: Object.freeze([...(project.projectFacts ?? [])]) }),
    checkpoint: Object.freeze({ checkpointId, title: checkpoint.title, goal: checkpoint.summary, expectedState: checkpoint.mentor?.expectedState ?? '' }),
    task: Object.freeze({ taskId, title: task.title, objective: task.objective, why: task.why ?? '', expectedBehavior: Object.freeze([...(task.expectedBehavior ?? [])]), commonMistakes: Object.freeze(commonMistakes) }),
    contracts: Object.freeze(contracts.map((contract) => Object.freeze({ ...contract, resolvedLanguage: contract.languageVariants?.[language] ?? null }))),
    guideFacts: Object.freeze(task.blocks.map((block) => textFromBlock(block, language)).filter(Boolean)),
    hints: Object.freeze([...(task.mentor?.hints ?? [])].filter((hint) => !hint.languages || hint.languages.includes(language))),
    revealPolicy: Object.freeze({ referenceAllowed: false, ...(task.mentor?.revealPolicy ?? {}) }),
    additionalContext: task.mentor?.additionalContext ?? '',
  });
}
