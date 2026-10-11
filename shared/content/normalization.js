import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES, normalizeContentType } from './constants.js';
import { validateContent, validateCourseContent, validatePracticeContent, validateChallengeContent, validateProjectContent } from './validation.js';

export class ContentContractError extends TypeError {
  constructor(message, errors) {
    super(message);
    this.name = 'ContentContractError';
    this.errors = errors;
  }
}

function clone(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function assertValid(result, label) {
  if (!result.valid) {
    const summary = result.errors.slice(0, 3).map(({ path, message }) => `${path}: ${message}`).join('; ');
    throw new ContentContractError(`${label} is invalid${summary ? `: ${summary}` : ''}.`, result.errors);
  }
}

export function resolveLanguageVariant(value, languageId, { required = false } = {}) {
  if (typeof value === 'string') return value;
  const exact = value?.variants?.[languageId];
  if (exact !== undefined) return exact;
  if (value?.default !== undefined) return value.default;
  if (required || value?.requiredLanguages?.includes(languageId)) {
    throw new ContentContractError(`Missing required ${languageId} language variant.`, [{
      path: `variants.${languageId}`, code: 'language.variant_missing', message: `A required ${languageId} variant is missing.`, severity: 'error',
    }]);
  }
  return null;
}

export function normalizeProject(project) {
  assertValid(validateProjectContent(project), 'Project content');
  const output = clone(project);
  output.tags ??= [];
  output.prerequisites ??= [];
  output.projectFacts ??= [];
  output.finalValidators ??= [];
  output.checkpoints.sort((left, right) => left.order - right.order);
  output.checkpoints.forEach((checkpoint) => {
    checkpoint.validators ??= [];
    checkpoint.completionBlocks ??= [];
    checkpoint.tasks.sort((left, right) => left.order - right.order);
    checkpoint.tasks.forEach((task) => {
      task.implementationContractIds ??= [];
      task.validators ??= [];
      task.expectedBehavior ??= [];
    });
  });
  return deepFreeze(output);
}

const byOrder = (left, right) => left.order - right.order;
export function normalizeCourse(course) {
  assertValid(validateCourseContent(course), 'Course content');
  const output = clone(course);
  output.prerequisites ??= [];
  output.tags ??= [];
  output.modules.sort(byOrder);
  output.modules.forEach((module) => {
    if (module.sections) {
      module.sections.sort(byOrder);
      module.sections.forEach((section) => section.lessons.sort(byOrder));
    } else module.lessons.sort(byOrder);
  });
  return deepFreeze(output);
}

export function normalizePractice(question) {
  assertValid(validatePracticeContent(question), 'Practice content');
  const output = clone(question);
  output.tags ??= [];
  output.skills ??= [];
  output.prerequisites ??= [];
  output.verification.comparison ??= 'normalized-lines';
  return deepFreeze(output);
}

export function normalizeChallenge(challenge) {
  assertValid(validateChallengeContent(challenge), 'Challenge content');
  const output = clone(challenge);
  output.hints ??= [];
  output.verification.comparison ??= 'normalized-lines';
  return deepFreeze(output);
}

export function normalizeContent(document) {
  assertValid(validateContent(document), 'Content document');
  const output = clone(document);
  if (output.contentType === CONTENT_TYPES.PROJECT) output.content = normalizeProject(output.content);
  if (output.contentType === CONTENT_TYPES.COURSE && output.metadata?.editor !== 'structured-document-v1') output.content = normalizeCourse(output.content);
  if (output.contentType === CONTENT_TYPES.PRACTICE && output.metadata?.editor !== 'structured-document-v1') output.content = normalizePractice(output.content);
  if (output.contentType === CONTENT_TYPES.CHALLENGE) output.content = normalizeChallenge(output.content);
  return deepFreeze(output);
}

export function createContentEnvelope({ contentId, contentType, version = 1, status = 'draft', locale = 'en', metadata = {}, content }) {
  return normalizeContent({ contentId, contentType: normalizeContentType(contentType), schemaVersion: CONTENT_SCHEMA_VERSION, version, status, locale, metadata, content });
}

export function normalizeLegacyDomainContent({ contentId, contentType, content, version = 1, metadata = {} }) {
  if (normalizeContentType(contentType) === CONTENT_TYPES.PROJECT) throw new TypeError('Use normalizeLegacyProject for Projects.');
  const normalizedType = normalizeContentType(contentType);
  if (!normalizedType) throw new TypeError('Unknown legacy content type.');
  // Legacy adapters intentionally retain the domain-owned payload until it is
  // migrated through the corresponding Studio contract. This boundary does
  // not make legacy payloads publishable: server publication always calls the
  // strict canonical validator.
  return deepFreeze({ contentId, contentType: normalizedType, schemaVersion: CONTENT_SCHEMA_VERSION, version, status: 'draft', locale: 'en', metadata: { source: 'legacy-domain-adapter', ...metadata }, content: clone(content) });
}
