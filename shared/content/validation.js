import { CONTENT_TYPES } from './constants.js';
import * as compiled from './generatedValidators.js';
import { getTrustedValidator } from './validatorRegistry.js';

const issue = (path, code, message, severity = 'error') => Object.freeze({ path, code, message, severity });

function pathForAjv(error) {
  const missing = error.keyword === 'required' ? `/${error.params.missingProperty}` : '';
  return `${error.instancePath}${missing}`.replace(/^\//, '').replaceAll('/', '.') || '$';
}

function schemaErrors(validate) {
  return (validate.errors ?? []).map((error) => issue(pathForAjv(error), `schema.${error.keyword}`, error.message ?? 'Invalid value.'));
}

function duplicateIssues(items, key, path) {
  const seen = new Set();
  const errors = [];
  items.forEach((item, index) => {
    const value = item?.[key];
    if (seen.has(value)) errors.push(issue(`${path}[${index}].${key}`, 'identity.duplicate', `${key} must be unique; duplicate "${value}".`));
    seen.add(value);
  });
  return errors;
}

function orderIssues(items, path) {
  const errors = duplicateIssues(items, 'order', path);
  const actual = items.map(({ order }) => order);
  const sorted = [...actual].sort((a, b) => a - b);
  if (actual.some((value, index) => value !== sorted[index])) errors.push(issue(path, 'order.nondeterministic', 'Items must be stored in ascending order.'));
  return errors;
}

const forbiddenConfigurationKeys = /^(?:script|code|handler|module|moduleUrl|eval|command|shell)$/i;
function inspectSafeValue(value, path, errors, seen = new WeakSet()) {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    errors.push(issue(path, 'security.non_json_value', 'Validator configuration must contain JSON data only.'));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) { errors.push(issue(path, 'security.circular_value', 'Circular validator configuration is not allowed.')); return; }
  seen.add(value);
  Object.entries(value).forEach(([key, child]) => {
    const childPath = `${path}.${key}`;
    if (forbiddenConfigurationKeys.test(key)) errors.push(issue(childPath, 'security.executable_configuration', `Executable validator field "${key}" is not allowed.`));
    inspectSafeValue(child, childPath, errors, seen);
  });
}

const htmlTag = /<\/?[a-z][^>]*>/i;
function inspectBlocks(blocks, path, errors, supportedLanguages) {
  duplicateIssues(blocks, 'blockId', path).forEach((entry) => errors.push(entry));
  blocks.forEach((block, index) => {
    const blockPath = `${path}[${index}]`;
    if (!['code', 'expected-output'].includes(block.type)) {
      const variantText = block.text && typeof block.text === 'object' ? [block.text.default, ...Object.values(block.text.variants ?? {})] : [block.text];
      const textValues = [...variantText, block.title, block.caption, block.alt, ...(block.items ?? []), ...(block.columns ?? []), ...(block.rows ?? []).flat()];
      if (textValues.some((value) => typeof value === 'string' && htmlTag.test(value))) errors.push(issue(blockPath, 'security.raw_html', 'Raw HTML is not allowed in semantic content blocks.'));
    }
    if (block.type === 'table' && block.rows?.some((row) => row.length !== block.columns.length)) errors.push(issue(`${blockPath}.rows`, 'table.column_mismatch', 'Every table row must match the declared column count.'));
    for (const field of ['text', 'code', 'output', 'display']) {
      const variant = block[field];
      if (!variant || typeof variant === 'string') continue;
      (variant.requiredLanguages ?? []).forEach((language) => {
        if (!supportedLanguages.includes(language)) errors.push(issue(`${blockPath}.${field}.requiredLanguages`, 'language.unsupported', `Required language "${language}" is not supported by this project.`));
        if (!Object.hasOwn(variant.variants ?? {}, language) && variant.default === undefined) errors.push(issue(`${blockPath}.${field}.variants.${language}`, 'language.variant_missing', `A required ${language} variant is missing.`));
      });
    }
  });
}

function inspectValidators(validators, path, errors, supportedLanguages) {
  const configurationRules = {
    execution_succeeds: { allowed: ['timeoutProfile'] },
    output_contains: { allowed: ['values', 'stream'], required: ['values'] },
    file_exists: { allowed: ['paths', 'pathByLanguage'], oneOf: ['paths', 'pathByLanguage'] },
    source_pattern: { allowed: ['patterns', 'patternsByLanguage', 'caseInsensitive', 'visible'], oneOf: ['patterns', 'patternsByLanguage'] },
    function_behavior: { allowed: ['cases'], required: ['cases'] },
    runtime_scenario: { allowed: ['stdin', 'outputIncludes', 'outputCaseInsensitive', 'filePathByLanguage', 'requiresFilesystem', 'visible'] },
  };
  duplicateIssues(validators, 'validatorId', path).forEach((entry) => errors.push(entry));
  validators.forEach((validator, index) => {
    const validatorPath = `${path}[${index}]`;
    if (!getTrustedValidator(validator.type, validator.version)) errors.push(issue(`${validatorPath}.type`, 'validator.untrusted', 'Validator type/version is not registered.'));
    inspectSafeValue(validator.configuration, `${validatorPath}.configuration`, errors);
    const rule = configurationRules[validator.type];
    if (rule) {
      const keys = Object.keys(validator.configuration ?? {});
      keys.filter((key) => !rule.allowed.includes(key)).forEach((key) => errors.push(issue(`${validatorPath}.configuration.${key}`, 'validator.configuration_unknown', `Configuration field "${key}" is not allowed for ${validator.type}.`)));
      (rule.required ?? []).filter((key) => !Object.hasOwn(validator.configuration ?? {}, key)).forEach((key) => errors.push(issue(`${validatorPath}.configuration.${key}`, 'validator.configuration_required', `Configuration field "${key}" is required for ${validator.type}.`)));
      if (rule.oneOf && !rule.oneOf.some((key) => Object.hasOwn(validator.configuration ?? {}, key))) errors.push(issue(`${validatorPath}.configuration`, 'validator.configuration_required', `${validator.type} requires one of: ${rule.oneOf.join(', ')}.`));
    }
    if (validator.type === 'source_pattern') {
      const patterns = [...(validator.configuration?.patterns ?? []), ...Object.values(validator.configuration?.patternsByLanguage ?? {}).flat()];
      patterns.forEach((pattern, patternIndex) => {
        if (typeof pattern !== 'string' || pattern.length > 500) errors.push(issue(`${validatorPath}.configuration.patterns[${patternIndex}]`, 'validator.pattern_limit', 'Source patterns must be strings no longer than 500 characters.'));
        if (typeof pattern === 'string' && /\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) errors.push(issue(`${validatorPath}.configuration.patterns[${patternIndex}]`, 'validator.pattern_unsafe', 'Nested quantified source patterns are not allowed.'));
      });
    }
    (validator.languages ?? []).forEach((language) => {
      if (!supportedLanguages.includes(language)) errors.push(issue(`${validatorPath}.languages`, 'language.unsupported', `Validator language "${language}" is not supported by this project.`));
    });
  });
}

function inspectProject(project) {
  const errors = [];
  const unsafePath = (value) => typeof value !== 'string' || !value || value.includes('\0') || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\') || value.split(/[\\/]+/).includes('..');
  const allTaskIds = new Set();
  const languages = project.supportedLanguages ?? [];
  const workspaces = Object.keys(project.starterWorkspaces ?? {});
  languages.forEach((language) => {
    if (!workspaces.includes(language)) errors.push(issue(`starterWorkspaces.${language}`, 'language.workspace_missing', `Starter workspace is required for ${language}.`));
  });
  workspaces.forEach((language) => {
    if (!languages.includes(language)) errors.push(issue(`starterWorkspaces.${language}`, 'language.workspace_unlisted', `Workspace language "${language}" is not listed in supportedLanguages.`));
    const workspace = project.starterWorkspaces[language];
    if (unsafePath(workspace?.entrypoint)) errors.push(issue(`starterWorkspaces.${language}.entrypoint`, 'security.unsafe_path', 'Entrypoint must be a safe project-relative path.'));
    (workspace?.files ?? []).forEach((file, index) => { if (unsafePath(file.path)) errors.push(issue(`starterWorkspaces.${language}.files[${index}].path`, 'security.unsafe_path', 'File path must be project-relative and cannot contain traversal.')); });
  });
  duplicateIssues(project.implementationContracts ?? [], 'contractId', 'implementationContracts').forEach((entry) => errors.push(entry));
  const contractIds = new Set((project.implementationContracts ?? []).map(({ contractId }) => contractId));
  duplicateIssues(project.checkpoints ?? [], 'checkpointId', 'checkpoints').forEach((entry) => errors.push(entry));
  orderIssues(project.checkpoints ?? [], 'checkpoints').forEach((entry) => errors.push(entry));
  inspectBlocks(project.completionBlocks ?? [], 'completionBlocks', errors, languages);
  inspectValidators(project.finalValidators ?? [], 'finalValidators', errors, languages);
  (project.checkpoints ?? []).forEach((checkpoint, checkpointIndex) => {
    const checkpointPath = `checkpoints[${checkpointIndex}]`;
    inspectBlocks(checkpoint.blocks ?? [], `${checkpointPath}.blocks`, errors, languages);
    inspectBlocks(checkpoint.completionBlocks ?? [], `${checkpointPath}.completionBlocks`, errors, languages);
    inspectValidators(checkpoint.validators ?? [], `${checkpointPath}.validators`, errors, languages);
    duplicateIssues(checkpoint.tasks ?? [], 'taskId', `${checkpointPath}.tasks`).forEach((entry) => errors.push(entry));
    orderIssues(checkpoint.tasks ?? [], `${checkpointPath}.tasks`).forEach((entry) => errors.push(entry));
    (checkpoint.tasks ?? []).forEach((task, taskIndex) => {
      const taskPath = `${checkpointPath}.tasks[${taskIndex}]`;
      if (allTaskIds.has(task.taskId)) errors.push(issue(`${taskPath}.taskId`, 'identity.duplicate', `taskId must be unique across the project; duplicate "${task.taskId}".`));
      allTaskIds.add(task.taskId);
      inspectBlocks(task.blocks ?? [], `${taskPath}.blocks`, errors, languages);
      inspectValidators(task.validators ?? [], `${taskPath}.validators`, errors, languages);
      (task.implementationContractIds ?? []).forEach((contractId, contractIndex) => {
        if (!contractIds.has(contractId)) errors.push(issue(`${taskPath}.implementationContractIds[${contractIndex}]`, 'reference.contract_missing', `Unknown implementation contract "${contractId}".`));
      });
    });
  });
  return errors;
}

function courseLessons(module) {
  return module.sections?.flatMap((section) => section.lessons ?? []) ?? module.lessons ?? [];
}

function inspectCourse(course) {
  const errors = [];
  duplicateIssues(course.modules ?? [], 'id', 'modules').forEach((entry) => errors.push(entry));
  orderIssues(course.modules ?? [], 'modules').forEach((entry) => errors.push(entry));
  const lessonIds = new Set();
  const blockIds = new Set();
  (course.modules ?? []).forEach((module, moduleIndex) => {
    const modulePath = `modules[${moduleIndex}]`;
    if (module.sections) {
      duplicateIssues(module.sections, 'id', `${modulePath}.sections`).forEach((entry) => errors.push(entry));
      orderIssues(module.sections, `${modulePath}.sections`).forEach((entry) => errors.push(entry));
    }
    const groups = module.sections ?? [{ lessons: module.lessons ?? [] }];
    groups.forEach((group, groupIndex) => {
      const path = module.sections ? `${modulePath}.sections[${groupIndex}].lessons` : `${modulePath}.lessons`;
      duplicateIssues(group.lessons ?? [], 'id', path).forEach((entry) => errors.push(entry));
      orderIssues(group.lessons ?? [], path).forEach((entry) => errors.push(entry));
      (group.lessons ?? []).forEach((lesson, lessonIndex) => {
        const lessonPath = `${path}[${lessonIndex}]`;
        if (lessonIds.has(lesson.id)) errors.push(issue(`${lessonPath}.id`, 'identity.duplicate', `Lesson ID must be unique across the course; duplicate "${lesson.id}".`));
        lessonIds.add(lesson.id);
        (lesson.blocks ?? []).forEach((block, blockIndex) => {
          const blockPath = `${lessonPath}.blocks[${blockIndex}]`;
          if (blockIds.has(block.id)) errors.push(issue(`${blockPath}.id`, 'identity.duplicate', `Block ID must be unique across the course; duplicate "${block.id}".`));
          blockIds.add(block.id);
          if (block.type === 'quiz') {
            const options = new Set((block.options ?? []).map((option) => option.id));
            (block.correctOptionIds ?? []).forEach((optionId) => { if (!options.has(optionId)) errors.push(issue(`${blockPath}.correctOptionIds`, 'quiz.answer_missing', `Correct option "${optionId}" does not exist.`)); });
          }
          if (['compiler', 'code', 'solution'].includes(block.type) && block.language && !['text', 'plaintext', course.language].includes(block.language)) errors.push(issue(`${blockPath}.language`, 'language.mismatch', 'Executable Course code blocks must use the course language.'));
          if (['compiler', 'exercise'].includes(block.type) && block.validation) inspectSafeValue(block.validation, `${blockPath}.validation`, errors);
          if (block.type === 'image' && block.src && (!block.src.startsWith('/assets/') || block.src.includes('..'))) errors.push(issue(`${blockPath}.src`, 'security.asset_reference', 'Images must use a safe /assets/ reference.'));
        });
      });
    });
  });
  if (course.defaultLessonId && !lessonIds.has(course.defaultLessonId)) errors.push(issue('defaultLessonId', 'reference.lesson_missing', 'Default lesson must reference a reachable lesson.'));
  return errors;
}

function inspectPractice(question) {
  const errors = [];
  duplicateIssues(question.blocks ?? [], 'id', 'blocks').forEach((entry) => errors.push(entry));
  if (!(question.blocks ?? []).some((block) => ['paragraph', 'heading', 'callout', 'note'].includes(block.type))) errors.push(issue('blocks', 'practice.problem_missing', 'Practice content must include a problem statement block.'));
  (question.blocks ?? []).forEach((block, index) => {
    if (block.type === 'image' && block.src && (!block.src.startsWith('/assets/') || block.src.includes('..'))) errors.push(issue(`blocks[${index}].src`, 'security.asset_reference', 'Images must use a safe /assets/ reference.'));
  });
  if (question.verification?.type !== 'expected-output') errors.push(issue('verification.type', 'validator.untrusted', 'Practice V1 supports declarative expected-output validation only.'));
  return errors;
}

function inspectChallenge(challenge) {
  const errors = [];
  duplicateIssues(challenge.blocks ?? [], 'id', 'blocks').forEach((entry) => errors.push(entry));
  if (!(challenge.blocks ?? []).some((block) => ['paragraph', 'heading', 'note', 'callout'].includes(block.type))) errors.push(issue('blocks', 'challenge.problem_missing', 'Challenge content needs a problem statement.'));
  (challenge.blocks ?? []).forEach((block, index) => {
    if (!['heading', 'paragraph', 'list', 'code', 'callout', 'note', 'warning', 'image', 'table', 'divider'].includes(block.type)) errors.push(issue(`blocks[${index}].type`, 'challenge.block_unavailable', 'This block type is not available in Challenges.'));
    if (block.type === 'image' && block.src && (!block.src.startsWith('/assets/') || block.src.includes('..'))) errors.push(issue(`blocks[${index}].src`, 'security.asset_reference', 'Images must use a safe /assets/ reference.'));
    if (block.type === 'compiler' || block.type === 'solution') errors.push(issue(`blocks[${index}].type`, 'challenge.hidden_solution', 'Compiler and solution blocks cannot be authored in public problem blocks.'));
    if (block.validation) inspectSafeValue(block.validation, `blocks[${index}].validation`, errors);
  });
  if (challenge.verification?.type !== 'expected-output') errors.push(issue('verification.type', 'validator.untrusted', 'Challenges support declarative expected-output verification only.'));
  return errors;
}

export function validateSchema(value, schemaName) {
  const validate = compiled[schemaName];
  if (!validate) throw new TypeError(`Unknown content schema: ${schemaName}`);
  const valid = validate(value);
  return Object.freeze({ valid, errors: Object.freeze(valid ? [] : schemaErrors(validate)), warnings: Object.freeze([]) });
}

export function validateProjectContent(project) {
  const base = validateSchema(project, 'project');
  const errors = [...base.errors];
  if (base.valid) errors.push(...inspectProject(project));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), warnings: Object.freeze([]) });
}

export function validateCourseContent(course) {
  const base = validateSchema(course, 'course');
  const errors = [...base.errors];
  if (base.valid) errors.push(...inspectCourse(course));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), warnings: Object.freeze([]) });
}

export function validatePracticeContent(question) {
  const base = validateSchema(question, 'practice');
  const errors = [...base.errors];
  if (base.valid) errors.push(...inspectPractice(question));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), warnings: Object.freeze([]) });
}

export function validateChallengeContent(challenge) {
  const base = validateSchema(challenge, 'challenge');
  const errors = [...base.errors];
  if (base.valid) errors.push(...inspectChallenge(challenge));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), warnings: Object.freeze([]) });
}

export function validateContent(document) {
  const base = validateSchema(document, 'envelope');
  const errors = [...base.errors];
  const structuredDocument = document.metadata?.editor === 'structured-document-v1';
  if (base.valid && document.contentType === CONTENT_TYPES.PROJECT) errors.push(...inspectProject(document.content));
  if (base.valid && document.contentType === CONTENT_TYPES.COURSE && !structuredDocument) errors.push(...inspectCourse(document.content));
  if (base.valid && document.contentType === CONTENT_TYPES.PRACTICE && !structuredDocument) errors.push(...inspectPractice(document.content));
  if (base.valid && document.contentType === CONTENT_TYPES.CHALLENGE) errors.push(...inspectChallenge(document.content));
  if (base.valid && document.contentType === CONTENT_TYPES.COURSE && !structuredDocument && document.contentId !== document.content.courseId) errors.push(issue('content.courseId', 'identity.envelope_mismatch', 'Course ID must match the canonical envelope contentId.'));
  if (base.valid && document.contentType === CONTENT_TYPES.PRACTICE && !structuredDocument && document.contentId !== document.content.questionId) errors.push(issue('content.questionId', 'identity.envelope_mismatch', 'Question ID must match the canonical envelope contentId.'));
  if (base.valid && document.contentType === CONTENT_TYPES.CHALLENGE && document.contentId !== document.content.challengeId) errors.push(issue('content.challengeId', 'identity.envelope_mismatch', 'Challenge ID must match the canonical envelope contentId.'));
  if (base.valid && document.contentType !== CONTENT_TYPES.PROJECT && document.metadata?.editor === 'structured-document-v1' && Array.isArray(document.content?.blocks)) {
    inspectBlocks(document.content.blocks, 'content.blocks', errors, document.content.supportedLanguages ?? []);
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), warnings: Object.freeze([]) });
}
