import { describe, expect, it } from 'vitest';
import { BLOCK_DEFINITIONS, createBlock } from '../src/content-studio/blocks/blockDefinitions.js';
import { createEmptyEditorDocument, serializeEditorDocument, stringifyEditorDocument } from '../src/content-studio/serialization/editorSerialization.js';
import { validateEditorDocument } from '../src/content-studio/validation/editorValidation.js';

describe('structured content serialization and validation', () => {
  it('serializes all canonical blocks through the shared content envelope', () => {
    const document = { ...createEmptyEditorDocument(), blocks: BLOCK_DEFINITIONS.map(({ type }) => createBlock(type)) };
    const serialized = serializeEditorDocument(document);
    expect(validateEditorDocument(document)).toMatchObject({ valid: true, errors: [] });
    expect(serialized.content.blocks).toHaveLength(BLOCK_DEFINITIONS.length);
    expect(serialized.metadata.draftDocumentId).toBe(document.documentId);
    expect(stringifyEditorDocument(document)).toBe(`${JSON.stringify(serialized, null, 2)}\n`);
  });

  it('preserves language variants and maps validation issues to their block', () => {
    const heading = { ...createBlock('heading'), text: { variants: { python: 'Python title', java: 'Java title' }, requiredLanguages: ['python', 'java'] } };
    const document = { ...createEmptyEditorDocument(), blocks: [heading] };
    expect(validateEditorDocument(document).valid).toBe(true);
    const invalid = { ...document, blocks: [{ ...heading, text: '' }] };
    const result = validateEditorDocument(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(({ blockId }) => blockId === heading.blockId)).toBe(true);
  });

  it('validates a large 200-block document without changing its order', () => {
    const blocks = Array.from({ length: 200 }, (_, index) => ({ ...createBlock('paragraph'), text: `Paragraph ${index}` }));
    const document = { ...createEmptyEditorDocument(), blocks };
    const started = performance.now();
    const result = validateEditorDocument(document);
    expect(performance.now() - started).toBeLessThan(1500);
    expect(result.valid).toBe(true);
    expect(serializeEditorDocument(document).content.blocks.map(({ blockId }) => blockId)).toEqual(blocks.map(({ blockId }) => blockId));
  });
});
