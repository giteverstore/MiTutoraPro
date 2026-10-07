import { validateContent } from '../../../../../shared/content/index.js';
import { serializeEditorDocument } from '../serialization/editorSerialization.js';

export function validateEditorDocument(document) {
  const result = validateContent(serializeEditorDocument(document));
  const mapped = result.errors.map((entry) => {
    const match = entry.path.match(/content\.blocks(?:\[(\d+)\]|\.(\d+))/);
    const index = Number(match?.[1] ?? match?.[2]);
    return { ...entry, blockIndex: Number.isInteger(index) ? index : null, blockId: Number.isInteger(index) ? document.blocks[index]?.blockId ?? null : null };
  });
  const issues = mapped.filter((entry, index) => {
    if (entry.blockIndex === null) return true;
    if (['schema.oneOf', 'schema.const', 'schema.additionalProperties'].includes(entry.code)) return false;
    const relativePath = entry.path.replace(/^content\.blocks(?:\[\d+\]|\.\d+)\.?/, '');
    const field = relativePath.split('.')[0];
    const block = document.blocks[entry.blockIndex];
    if (field && !Object.hasOwn(block, field)) return false;
    return mapped.findIndex((candidate) => candidate.path === entry.path && candidate.code === entry.code && candidate.message === entry.message) === index;
  }).map(({ blockIndex: _blockIndex, ...entry }) => entry);
  return { valid: issues.length === 0, errors: issues.filter(({ severity }) => severity === 'error'), warnings: issues.filter(({ severity }) => severity === 'warning') };
}
