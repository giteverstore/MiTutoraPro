import { CONTENT_TYPES } from './constants.js';
import { createContentEnvelope } from './normalization.js';

const safeId = (value, fallback) => String(value ?? fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '');
const variantFromLanguageContent = (project, key) => ({
  variants: Object.fromEntries(project.supportedLanguages.map((language) => [language, project.languageContent?.[language]?.[key]]).filter(([, value]) => typeof value === 'string' && value)),
  requiredLanguages: [...project.supportedLanguages],
});

function legacyBlock(project, checkpointId, block, index, resolveRuntime) {
  const blockId = `${checkpointId}-block-${index + 1}`;
  if (block.type === 'heading') return { blockId, type: 'heading', level: 2, text: block.text };
  if (block.type === 'paragraph') return { blockId, type: 'paragraph', text: block.text };
  if (block.type === 'note') return { blockId, type: 'callout', variant: 'note', text: block.text };
  if (block.type === 'list') return { blockId, type: 'list', style: 'unordered', items: block.items };
  if (block.type === 'expected-output') return { blockId, type: 'expected-output', output: block.text };
  if (block.type === 'runtime-command') return { blockId, type: 'terminal-command', commandId: safeId(block.command, 'run'), display: { variants: Object.fromEntries(project.supportedLanguages.map((language) => [language, resolveRuntime(project, language)?.[block.command === 'build' ? 'buildCommand' : 'runCommand']]).filter(([, value]) => typeof value === 'string' && value)), requiredLanguages: project.supportedLanguages.filter((language) => Boolean(resolveRuntime(project, language)?.[block.command === 'build' ? 'buildCommand' : 'runCommand'])) } };
  if (block.type === 'language-hint') return { blockId, type: 'paragraph', text: variantFromLanguageContent(project, block.key) };
  if (block.type === 'code') return { blockId, type: 'code', code: block.codeKey ? variantFromLanguageContent(project, block.codeKey) : block.code };
  if (block.type === 'language-section') return { blockId, type: 'paragraph', text: variantFromLanguageContent(project, block.key) };
  throw new TypeError(`Unsupported legacy guide block: ${block.type}`);
}

function adaptCheck(check, index, languages) {
  const base = { validatorId: safeId(check.id, `validator-${index + 1}`), version: 1, severity: 'error', failureMessage: check.name ?? 'The project requirement is not satisfied.' };
  if (check.type === 'source_matches') return { ...base, type: 'source_pattern', languages, configuration: { patternsByLanguage: check.patternsByLanguage ?? {}, caseInsensitive: true, visible: check.visible !== false } };
  if (check.type === 'execution') return { ...base, type: 'runtime_scenario', languages, configuration: { stdin: check.stdin ?? '', outputIncludes: check.outputIncludes ?? [], outputCaseInsensitive: true, filePathByLanguage: check.filePathByLanguage ?? {}, requiresFilesystem: check.requiresFilesystem === true, visible: check.visible !== false } };
  throw new TypeError(`Unsupported legacy project validator: ${check.type}`);
}

function adaptValidation(validation, languages) {
  if (!validation) return [];
  if (validation.type === 'project-checks') return validation.checks.map((check, index) => adaptCheck(check, index, languages));
  if (validation.type === 'python-function') return [{
    validatorId: 'function-behavior', type: 'function_behavior', version: 1, severity: 'error', languages,
    configuration: { cases: validation.tests }, failureMessage: 'The function behavior does not match the project requirements.',
  }];
  return [];
}

function workspaceFor(project, language, resolveRuntime) {
  if (project.template && language === project.language) return { entrypoint: project.template.sourcePath, runtimeId: language, files: [{ path: project.template.sourcePath, content: project.starterCode }] };
  const runtime = resolveRuntime?.(project, language);
  if (!runtime) throw new TypeError(`Legacy adapter requires a runtime resolver for ${project.id}/${language}.`);
  return { entrypoint: runtime.entrypoint, runtimeId: runtime.id, files: runtime.defaultFiles.map(({ path, content }) => ({ path, content })) };
}

export function normalizeLegacyProject(project, { resolveRuntime } = {}) {
  const languages = [...project.supportedLanguages];
  const functionContract = project.functionDefinition ? [{
    contractId: safeId(project.functionDefinition.name, 'primary-function'), name: project.functionDefinition.name, kind: 'function', semanticType: 'callable',
    purpose: project.instructions ?? project.description,
    parameters: project.functionDefinition.parameters.map((name) => ({ parameterId: safeId(name, 'parameter'), name, semanticType: 'value' })),
    returns: { semanticType: project.functionDefinition.returns },
  }] : [];
  const checkpoints = project.checkpoints.map((checkpoint, checkpointIndex) => {
    const checkpointId = safeId(checkpoint.id, `checkpoint-${checkpointIndex + 1}`);
    const taskId = `${checkpointId}-task`;
    return {
      checkpointId, order: checkpointIndex + 1, title: checkpoint.title, summary: checkpoint.objective,
      blocks: checkpoint.guide.map((block, index) => legacyBlock(project, checkpointId, block, index, resolveRuntime)),
      tasks: [{
        taskId, order: 1, title: checkpoint.title, objective: checkpoint.objective,
        blocks: [{ blockId: `${taskId}-requirements`, type: 'requirements', items: checkpoint.requirements }],
        implementationContractIds: functionContract.map(({ contractId }) => contractId),
        validators: adaptValidation(checkpoint.validation, languages),
        expectedBehavior: checkpoint.expectedOutput ? [checkpoint.expectedOutput] : [],
      }],
      validators: adaptValidation(checkpoint.validation, languages),
      completionBlocks: [{ blockId: `${checkpointId}-completion`, type: 'paragraph', text: checkpoint.completionMessage }],
    };
  });
  const canonical = {
    projectId: project.id, title: project.title, description: project.description, difficulty: project.difficulty,
    estimatedMinutes: project.estimatedMinutes ?? 30, category: project.category, tags: project.skills ?? [], prerequisites: project.prerequisites ?? [],
    learningOutcomes: project.learningObjectives?.length ? project.learningObjectives : [project.instructions ?? project.description],
    supportedLanguages: languages,
    starterWorkspaces: Object.fromEntries(languages.map((language) => [language, workspaceFor(project, language, resolveRuntime)])),
    projectFacts: [project.whatYouWillBuild ?? project.why ?? project.description], implementationContracts: functionContract,
    checkpoints, finalValidators: adaptValidation(project.finalValidation ?? project.validation, languages),
    completionBlocks: [{ blockId: 'project-completion', type: 'paragraph', text: `${project.title} is complete.` }],
  };
  return createContentEnvelope({ contentId: project.id, contentType: CONTENT_TYPES.PROJECT, metadata: { source: 'legacy-project-adapter', slug: project.slug }, content: canonical });
}
