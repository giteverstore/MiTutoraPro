import { describe, expect, it } from 'vitest';
import { ProjectCatalog } from '../../src/projects/repositories/ProjectCatalog.js';
import { resolveProjectRuntime } from '../../src/projects/runtime/projectRuntimeRegistry.js';
import {
  CONTENT_TYPES, ContentContractError, deriveMentorContext, normalizeContent, normalizeLegacyProject,
  resolveLanguageVariant, validateContent, validateProjectContent, validateSchema,
} from '../../shared/content/index.js';
import { createBingoContractFixture } from './fixtures.js';

describe('canonical common blocks and language variants', () => {
  it('accepts valid blocks and rejects invalid payloads', () => {
    expect(validateSchema({ blockId: 'intro', type: 'paragraph', text: 'Safe plain text.' }, 'block').valid).toBe(true);
    expect(validateSchema({ blockId: 'intro', type: 'paragraph' }, 'block').valid).toBe(false);
  });

  it('resolves exact variants, then defaults, and reports missing required values', () => {
    const value = { default: 'shared', variants: { java: 'Java' }, requiredLanguages: ['java'] };
    expect(resolveLanguageVariant(value, 'java')).toBe('Java');
    expect(resolveLanguageVariant(value, 'python')).toBe('shared');
    expect(() => resolveLanguageVariant({ variants: {} }, 'cpp', { required: true })).toThrow(ContentContractError);
  });

  it('rejects unsafe raw HTML in prose', () => {
    const fixture = createBingoContractFixture();
    fixture.content.checkpoints[0].tasks[0].blocks[1].text = '<img src=x onerror=alert(1)>';
    expect(validateContent(fixture).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'security.raw_html' })]));
  });
});

describe('Project contracts', () => {
  it('normalizes a multilingual 8-checkpoint, 17-task stress fixture', () => {
    const normalized = normalizeContent(createBingoContractFixture());
    expect(normalized.contentType).toBe(CONTENT_TYPES.PROJECT);
    expect(normalized.content.checkpoints).toHaveLength(8);
    expect(normalized.content.checkpoints.flatMap(({ tasks }) => tasks)).toHaveLength(17);
    expect(normalized.content.supportedLanguages).toEqual(['python', 'java', 'cpp']);
  });

  it('rejects duplicate stable IDs and nondeterministic order', () => {
    const project = createBingoContractFixture().content;
    project.checkpoints[1].checkpointId = project.checkpoints[0].checkpointId;
    [project.checkpoints[0].order, project.checkpoints[1].order] = [2, 1];
    const result = validateProjectContent(project);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'identity.duplicate' }), expect.objectContaining({ code: 'order.nondeterministic' })]));
  });

  it('supports variable, function/method, and collection implementation contracts', () => {
    const contracts = createBingoContractFixture().content.implementationContracts;
    expect(contracts.map(({ kind }) => kind)).toEqual(['constant', 'collection', 'method']);
    contracts.forEach((contract) => expect(validateSchema(contract, 'implementationContract').valid).toBe(true));
    expect(validateSchema({ contractId: 'score', name: 'score', kind: 'variable', semanticType: 'integer', purpose: 'Current score.' }, 'implementationContract').valid).toBe(true);
    expect(validateSchema({ contractId: 'calculate', name: 'calculate', kind: 'function', semanticType: 'callable', purpose: 'Calculate a result.', parameters: [{ parameterId: 'value', name: 'value', semanticType: 'integer' }], returns: { semanticType: 'integer' } }, 'implementationContract').valid).toBe(true);
  });
});

describe('trusted validator and mentor boundaries', () => {
  it('accepts allowlisted descriptors and rejects unknown or executable configuration', () => {
    const valid = { validatorId: 'run', type: 'execution_succeeds', version: 1, severity: 'error', configuration: {}, failureMessage: 'Run the program.' };
    expect(validateSchema(valid, 'validator').valid).toBe(true);
    expect(validateSchema({ ...valid, type: 'javascript' }, 'validator').valid).toBe(false);
    const fixture = createBingoContractFixture();
    fixture.content.finalValidators[0].configuration.script = 'process.exit()';
    expect(validateContent(fixture).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'security.executable_configuration' })]));
  });

  it('derives task facts, contracts, mistakes, and hints without duplicating them', () => {
    const project = normalizeContent(createBingoContractFixture()).content;
    const context = deriveMentorContext(project, 'checkpoint-1', 'task-1', 'java');
    expect(context.task.objective).toContain('task 1');
    expect(context.contracts[0].name).toBe('FREE_INDEX');
    expect(context.contracts[0].resolvedLanguage.typeDisplay).toBe('int');
    expect(context.task.commonMistakes).toHaveLength(2);
    expect(context.hints).toHaveLength(2);
  });
});

describe('legacy compatibility', () => {
  it('normalizes every current Project without mutating it', () => {
    const projects = new ProjectCatalog().getProjects();
    projects.forEach((project) => {
      const before = JSON.stringify(project);
      const document = normalizeLegacyProject(project, { resolveRuntime: resolveProjectRuntime });
      expect(document.content.projectId).toBe(project.id);
      expect(document.content.checkpoints.length).toBe(project.checkpoints.length);
      expect(JSON.stringify(project)).toBe(before);
    });
  });

  it('detects a missing required project language workspace', () => {
    const fixture = createBingoContractFixture();
    delete fixture.content.starterWorkspaces.java;
    expect(validateContent(fixture).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'language.workspace_missing' })]));
  });

  it('wraps existing domain payloads without forcing them into the Project schema', async () => {
    const { normalizeLegacyDomainContent } = await import('../../shared/content/index.js');
    const wrapped = normalizeLegacyDomainContent({ contentId: 'practice-1', contentType: 'practice', content: { existingSchemaVersion: '2.0.0' } });
    expect(wrapped.contentType).toBe(CONTENT_TYPES.PRACTICE);
    expect(wrapped.content.existingSchemaVersion).toBe('2.0.0');
  });
});
