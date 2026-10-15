import {
  CANONICAL_LANGUAGE_IDS,
  COURSE_LANGUAGE_IDS,
  CONTENT_SCHEMA_VERSION,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  HINT_LEVELS,
  IMPLEMENTATION_CONTRACT_KINDS,
  VALIDATOR_SEVERITIES,
  VALIDATOR_TYPES,
} from './constants.js';

const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9]+(?:[._-][a-z0-9]+)*$' };
const nonEmptyText = { type: 'string', minLength: 1, maxLength: 20000 };
const shortText = { type: 'string', minLength: 1, maxLength: 300 };
const optionalShortText = { type: 'string', maxLength: 300 };
const languageId = { enum: CANONICAL_LANGUAGE_IDS };
const audience = {
  type: 'object', additionalProperties: false,
  properties: { languages: { type: 'array', minItems: 1, uniqueItems: true, items: languageId } },
};
const textVariant = {
  type: 'object', additionalProperties: false, minProperties: 1,
  properties: {
    default: nonEmptyText,
    variants: {
      type: 'object', minProperties: 1,
      propertyNames: languageId,
      additionalProperties: nonEmptyText,
    },
    requiredLanguages: { type: 'array', uniqueItems: true, items: languageId },
  },
};

const blockBase = {
  blockId: id,
  audience,
};

export const commonBlockSchema = {
  $id: 'https://schemas.ycoders.com/content/common-block-v1.json',
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'level', 'text'], properties: { ...blockBase, type: { const: 'heading' }, level: { type: 'integer', minimum: 2, maximum: 4 }, text: { oneOf: [nonEmptyText, textVariant] } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'text'], properties: { ...blockBase, type: { const: 'paragraph' }, text: { oneOf: [nonEmptyText, textVariant] } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'items'], properties: { ...blockBase, type: { const: 'list' }, style: { enum: ['unordered', 'ordered'] }, items: { type: 'array', minItems: 1, maxItems: 100, items: nonEmptyText } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'code'], properties: { ...blockBase, type: { const: 'code' }, language: languageId, filename: shortText, code: { oneOf: [nonEmptyText, textVariant] } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'variant', 'text'], properties: { ...blockBase, type: { const: 'callout' }, variant: { enum: ['note', 'warning', 'tip'] }, title: shortText, text: { oneOf: [nonEmptyText, textVariant] } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'assetId', 'alt'], properties: { ...blockBase, type: { const: 'image' }, assetId: id, alt: shortText, caption: shortText } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'columns', 'rows'], properties: { ...blockBase, type: { const: 'table' }, columns: { type: 'array', minItems: 1, maxItems: 12, items: shortText }, rows: { type: 'array', maxItems: 200, items: { type: 'array', items: nonEmptyText } } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'output'], properties: { ...blockBase, type: { const: 'expected-output' }, output: { oneOf: [nonEmptyText, textVariant] } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'commandId'], properties: { ...blockBase, type: { const: 'terminal-command' }, commandId: id, display: textVariant } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type'], properties: { ...blockBase, type: { const: 'divider' } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'conceptId', 'text'], properties: { ...blockBase, type: { const: 'concept' }, conceptId: id, title: shortText, text: nonEmptyText } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'items'], properties: { ...blockBase, type: { const: 'requirements' }, items: { type: 'array', minItems: 1, items: nonEmptyText } } },
    { type: 'object', additionalProperties: false, required: ['blockId', 'type', 'items'], properties: { ...blockBase, type: { const: 'common-mistakes' }, items: { type: 'array', minItems: 1, items: nonEmptyText } } },
  ],
};

export const implementationContractSchema = {
  $id: 'https://schemas.ycoders.com/content/implementation-contract-v1.json',
  type: 'object', additionalProperties: false,
  required: ['contractId', 'name', 'kind', 'semanticType', 'purpose'],
  properties: {
    contractId: id, name: shortText, kind: { enum: IMPLEMENTATION_CONTRACT_KINDS }, semanticType: shortText, purpose: nonEmptyText,
    parameters: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['parameterId', 'name', 'semanticType'], properties: { parameterId: id, name: shortText, semanticType: shortText, optional: { type: 'boolean' } } } },
    returns: { type: 'object', additionalProperties: false, required: ['semanticType'], properties: { semanticType: shortText, description: nonEmptyText } },
    elementType: shortText,
    shape: { type: 'array', minItems: 1, items: { type: 'integer', minimum: 1 } },
    requiredValue: {},
    languageVariants: { type: 'object', propertyNames: languageId, additionalProperties: { type: 'object', additionalProperties: false, properties: { typeDisplay: shortText, declaration: nonEmptyText, modifiers: { type: 'array', uniqueItems: true, items: shortText } } } },
    constraints: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind'], properties: { kind: { enum: ['equals', 'range', 'length', 'unique', 'nonempty'] }, value: {}, minimum: { type: 'number' }, maximum: { type: 'number' } } } },
  },
};

export const validatorDescriptorSchema = {
  $id: 'https://schemas.ycoders.com/content/validator-descriptor-v1.json',
  type: 'object', additionalProperties: false,
  required: ['validatorId', 'type', 'version', 'severity', 'configuration', 'failureMessage'],
  properties: {
    validatorId: id, type: { enum: VALIDATOR_TYPES }, version: { const: 1 }, severity: { enum: VALIDATOR_SEVERITIES },
    languages: { type: 'array', minItems: 1, uniqueItems: true, items: languageId },
    contractId: id,
    configuration: { type: 'object', maxProperties: 20 },
    failureMessage: shortText,
  },
};

export const mentorConfigurationSchema = {
  $id: 'https://schemas.ycoders.com/content/mentor-configuration-v1.json',
  type: 'object', additionalProperties: false,
  properties: {
    additionalContext: { type: 'string', maxLength: 2000 },
    expectedState: { type: 'string', maxLength: 1000 },
    conceptsIntroduced: { type: 'array', uniqueItems: true, items: id },
    conceptsNotIntroduced: { type: 'array', uniqueItems: true, items: id },
    hints: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['hintId', 'level', 'text'], properties: { hintId: id, level: { enum: HINT_LEVELS }, text: nonEmptyText, languages: { type: 'array', uniqueItems: true, items: languageId }, requiresExplicitReveal: { type: 'boolean' } } } },
    revealPolicy: { type: 'object', additionalProperties: false, properties: { referenceAllowed: { type: 'boolean' }, requiresCompletedTaskIds: { type: 'array', uniqueItems: true, items: id } } },
  },
};

const blocks = { type: 'array', items: { $ref: commonBlockSchema.$id } };
const validators = { type: 'array', items: { $ref: validatorDescriptorSchema.$id } };

export const taskSchema = {
  $id: 'https://schemas.ycoders.com/content/project-task-v1.json',
  type: 'object', additionalProperties: false,
  required: ['taskId', 'order', 'title', 'objective', 'blocks'],
  properties: {
    taskId: id, order: { type: 'integer', minimum: 1 }, title: shortText, objective: nonEmptyText, why: nonEmptyText,
    blocks, implementationContractIds: { type: 'array', uniqueItems: true, items: id }, validators,
    expectedBehavior: { type: 'array', items: nonEmptyText },
    mentor: { $ref: mentorConfigurationSchema.$id },
  },
};

export const checkpointSchema = {
  $id: 'https://schemas.ycoders.com/content/project-checkpoint-v1.json',
  type: 'object', additionalProperties: false,
  required: ['checkpointId', 'order', 'title', 'summary', 'blocks', 'tasks'],
  properties: {
    checkpointId: id, order: { type: 'integer', minimum: 1 }, title: shortText, summary: nonEmptyText,
    blocks, tasks: { type: 'array', minItems: 1, items: { $ref: taskSchema.$id } }, validators,
    completionBlocks: blocks, mentor: { $ref: mentorConfigurationSchema.$id },
  },
};

export const projectSchema = {
  $id: 'https://schemas.ycoders.com/content/project-v1.json',
  type: 'object', additionalProperties: false,
  required: ['projectId', 'title', 'description', 'difficulty', 'estimatedMinutes', 'supportedLanguages', 'learningOutcomes', 'starterWorkspaces', 'implementationContracts', 'checkpoints', 'completionBlocks'],
  properties: {
    projectId: id, title: shortText, description: nonEmptyText, difficulty: { enum: ['Beginner', 'Easy', 'Intermediate', 'Advanced'] }, estimatedMinutes: { type: 'integer', minimum: 1 },
    category: shortText, tags: { type: 'array', uniqueItems: true, items: shortText }, prerequisites: { type: 'array', items: nonEmptyText }, learningOutcomes: { type: 'array', minItems: 1, items: nonEmptyText },
    supportedLanguages: { type: 'array', minItems: 1, uniqueItems: true, items: languageId },
    starterWorkspaces: { type: 'object', minProperties: 1, propertyNames: languageId, additionalProperties: { type: 'object', additionalProperties: false, required: ['entrypoint', 'files'], properties: { entrypoint: shortText, runtimeId: id, files: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['path', 'content'], properties: { path: shortText, content: { type: 'string', maxLength: 200000 } } } } } } },
    projectFacts: { type: 'array', uniqueItems: true, items: nonEmptyText },
    implementationContracts: { type: 'array', items: { $ref: implementationContractSchema.$id } },
    checkpoints: { type: 'array', minItems: 1, items: { $ref: checkpointSchema.$id } },
    finalValidators: validators, completionBlocks: blocks, mentor: { $ref: mentorConfigurationSchema.$id },
  },
};

const legacyBlockId = { ...id };
const courseBlockTypes = ['heading', 'paragraph', 'list', 'code', 'callout', 'note', 'warning', 'image', 'table', 'expected-output', 'quiz', 'exercise', 'compiler', 'solution', 'divider'];
export const courseBlockSchema = {
  $id: 'https://schemas.ycoders.com/content/course-block-v1.json',
  type: 'object',
  required: ['id', 'type'],
  properties: {
    id: legacyBlockId, type: { enum: courseBlockTypes }, text: nonEmptyText, content: nonEmptyText,
    level: { type: 'integer', minimum: 1, maximum: 6 }, format: { enum: ['plain', 'markdown'] },
    language: { anyOf: [languageId, { enum: ['text', 'plaintext'] }] }, runtime: { type: 'string', maxLength: 80 }, code: { type: 'string', maxLength: 200000 },
    starterCode: { type: 'string', maxLength: 200000 }, stdin: { type: 'string', maxLength: 50000 }, expectedOutput: { type: 'string', maxLength: 50000 },
    question: nonEmptyText, selectionMode: { enum: ['single', 'multiple'] },
    options: { type: 'array', minItems: 2, maxItems: 12, items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id, text: nonEmptyText } } },
    correctOptionIds: { type: 'array', minItems: 1, uniqueItems: true, items: id },
    src: { type: 'string', minLength: 1, maxLength: 1000 }, assetId: id, alt: shortText,
    title: optionalShortText, caption: { type: 'string', maxLength: 300 }, tone: { type: 'string', maxLength: 30 },
    items: { type: 'array' }, columns: { type: 'array' }, rows: { type: 'array' },
    objectives: { type: 'array', items: nonEmptyText }, hints: { type: 'array', items: nonEmptyText },
    starterFiles: { type: 'array', items: { type: 'object', required: ['name', 'content'], properties: { name: shortText, content: { type: 'string', maxLength: 200000 } } } },
    files: { type: 'array' }, validation: { type: 'object' }, instructions: {}, difficulty: shortText,
    mode: shortText, runLabel: shortText, resetLabel: shortText, submitLabel: shortText, actionLabel: shortText,
    activeFile: shortText, description: { type: 'string', maxLength: 20000 }, loading: shortText, iconSrc: optionalShortText, iconAlt: optionalShortText,
  },
};

const courseLessonSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'order', 'title', 'blocks'],
  properties: { id, order: { type: 'integer', minimum: 1 }, number: shortText, title: shortText, summary: { type: 'string', maxLength: 20000 }, status: { enum: ['available', 'locked', 'coming-soon'] }, estimatedMinutes: { type: 'integer', minimum: 0 }, tags: { type: 'array', uniqueItems: true, items: shortText }, blocks: { type: 'array', items: { $ref: courseBlockSchema.$id } } },
};
const courseSectionSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'order', 'title', 'lessons'],
  properties: { id, order: { type: 'integer', minimum: 1 }, title: shortText, description: { type: 'string', maxLength: 20000 }, initiallyExpanded: { type: 'boolean' }, lessons: { type: 'array', minItems: 1, items: courseLessonSchema } },
};
export const courseSchema = {
  $id: 'https://schemas.ycoders.com/content/course-v1.json', type: 'object', additionalProperties: false,
  required: ['courseId', 'slug', 'title', 'description', 'language', 'difficulty', 'estimatedMinutes', 'learningOutcomes', 'modules'],
  properties: {
    courseId: id, slug: id, title: shortText, subtitle: { type: 'string', maxLength: 300 }, description: nonEmptyText,
    language: { enum: COURSE_LANGUAGE_IDS }, difficulty: { enum: ['Beginner', 'Easy', 'Intermediate', 'Advanced', 'beginner', 'easy', 'intermediate', 'advanced'] },
    estimatedMinutes: { type: 'integer', minimum: 1 }, prerequisites: { type: 'array', items: nonEmptyText }, learningOutcomes: { type: 'array', minItems: 1, items: nonEmptyText },
    tags: { type: 'array', uniqueItems: true, items: shortText }, artworkAssetId: id, defaultLessonId: id, comingSoon: { type: 'boolean' },
    modules: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id', 'order', 'title'], properties: { id, order: { type: 'integer', minimum: 1 }, title: shortText, description: { type: 'string', maxLength: 20000 }, initiallyExpanded: { type: 'boolean' }, sections: { type: 'array', minItems: 1, items: courseSectionSchema }, lessons: { type: 'array', minItems: 1, items: courseLessonSchema } }, oneOf: [{ required: ['sections'], properties: { sections: {} } }, { required: ['lessons'], properties: { lessons: {} } }] } },
  },
};

export const practiceSchema = {
  $id: 'https://schemas.ycoders.com/content/practice-v1.json', type: 'object', additionalProperties: false,
  required: ['questionId', 'title', 'summary', 'language', 'difficulty', 'topic', 'category', 'questionType', 'estimatedMinutes', 'xp', 'blocks', 'starterCode', 'verification'],
  properties: {
    questionId: id, title: shortText, summary: nonEmptyText, language: languageId,
    difficulty: { enum: ['Easy', 'Medium', 'Hard', 'easy', 'medium', 'hard'] }, topic: shortText, category: shortText, subtopic: shortText, questionType: shortText,
    estimatedMinutes: { type: 'integer', minimum: 1 }, xp: { type: 'integer', minimum: 0 }, position: { type: 'integer', minimum: 0 },
    tags: { type: 'array', uniqueItems: true, items: shortText }, skills: { type: 'array', uniqueItems: true, items: shortText }, prerequisites: { type: 'array', items: nonEmptyText },
    blocks: { type: 'array', minItems: 1, items: { $ref: courseBlockSchema.$id } }, starterCode: { type: 'string', maxLength: 200000 }, stdin: { type: 'string', maxLength: 50000 },
    verification: { type: 'object', additionalProperties: false, required: ['type', 'expectedOutput'], properties: { type: { const: 'expected-output' }, expectedOutput: { type: 'string', maxLength: 50000 }, comparison: { enum: ['normalized-lines', 'trimmed', 'exact'] } } },
    examples: { type: 'array' }, constraints: { type: 'array', items: nonEmptyText }, hints: { type: 'array', items: nonEmptyText }, publicTests: { type: 'array' }, contract: { type: 'object' }, expectedComplexity: { type: 'object' }, commonMistakes: { type: 'array' }, concepts: { type: 'array' },
  },
};

export const challengeSchema = {
  $id: 'https://schemas.ycoders.com/content/challenge-v1.json', type: 'object', additionalProperties: false,
  required: ['challengeId', 'date', 'title', 'summary', 'motivation', 'language', 'difficulty', 'topic', 'estimatedMinutes', 'reward', 'blocks', 'starterCode', 'verification'],
  properties: {
    challengeId: id, date: { type: 'string', format: 'date' }, title: shortText, summary: nonEmptyText,
    motivation: nonEmptyText, language: { enum: ['python', 'java', 'cpp'] }, difficulty: { enum: ['easy', 'medium', 'hard'] },
    topic: shortText, estimatedMinutes: { type: 'integer', minimum: 1 },
    reward: { type: 'object', additionalProperties: false, required: ['coins', 'streakIncrement'], properties: { coins: { const: 20 }, streakIncrement: { const: 1 } } },
    blocks: { type: 'array', minItems: 1, items: { $ref: courseBlockSchema.$id } },
    starterCode: { type: 'string', maxLength: 200000 }, stdin: { type: 'string', maxLength: 50000 },
    verification: { type: 'object', additionalProperties: false, required: ['type', 'expectedOutput'], properties: { type: { const: 'expected-output' }, expectedOutput: { type: 'string', maxLength: 50000 }, comparison: { enum: ['normalized-lines', 'trimmed', 'exact'] } } },
    hints: { type: 'array', items: nonEmptyText },
  },
};

const genericDomainPayload = {
  type: 'object',
  properties: {
    title: shortText,
    supportedLanguages: { type: 'array', uniqueItems: true, items: languageId },
    // Legacy domain adapters already expose domain-owned `blocks` shapes. The
    // structured editor marker below narrows this field to canonical blocks.
    blocks: { type: 'array' },
  },
};
export const contentEnvelopeSchema = {
  $id: 'https://schemas.ycoders.com/content/envelope-v1.json',
  type: 'object', additionalProperties: false,
  required: ['contentId', 'contentType', 'schemaVersion', 'version', 'status', 'locale', 'metadata', 'content'],
  properties: {
    contentId: id, contentType: { enum: Object.values(CONTENT_TYPES) }, schemaVersion: { const: CONTENT_SCHEMA_VERSION },
    version: { type: 'integer', minimum: 1 }, status: { enum: CONTENT_STATUSES }, locale: { const: 'en' },
    metadata: { type: 'object', additionalProperties: true },
    content: genericDomainPayload,
  },
  allOf: [
    { if: { properties: { contentType: { const: CONTENT_TYPES.PROJECT } } }, then: { properties: { content: { $ref: projectSchema.$id } } } },
    { if: { properties: { contentType: { const: CONTENT_TYPES.COURSE }, metadata: { type: 'object', not: { type: 'object', required: ['editor'], properties: { editor: { const: 'structured-document-v1' } } } } } }, then: { properties: { content: { $ref: courseSchema.$id } } } },
    { if: { properties: { contentType: { const: CONTENT_TYPES.PRACTICE }, metadata: { type: 'object', not: { type: 'object', required: ['editor'], properties: { editor: { const: 'structured-document-v1' } } } } } }, then: { properties: { content: { $ref: practiceSchema.$id } } } },
    { if: { properties: { contentType: { const: CONTENT_TYPES.CHALLENGE } } }, then: { properties: { content: { $ref: challengeSchema.$id } } } },
    {
      if: { properties: { metadata: { type: 'object', required: ['editor'], properties: { editor: { const: 'structured-document-v1' } } } } },
      then: { properties: { content: { type: 'object', required: ['title', 'supportedLanguages', 'blocks'], properties: { title: shortText, supportedLanguages: { type: 'array', uniqueItems: true, items: languageId }, blocks: { type: 'array', items: { $ref: commonBlockSchema.$id } } } } } },
    },
  ],
};

export const CONTENT_SCHEMAS = Object.freeze({
  envelope: contentEnvelopeSchema,
  project: projectSchema,
  course: courseSchema,
  practice: practiceSchema,
  challenge: challengeSchema,
  courseBlock: courseBlockSchema,
  checkpoint: checkpointSchema,
  task: taskSchema,
  block: commonBlockSchema,
  implementationContract: implementationContractSchema,
  validator: validatorDescriptorSchema,
  mentor: mentorConfigurationSchema,
});
