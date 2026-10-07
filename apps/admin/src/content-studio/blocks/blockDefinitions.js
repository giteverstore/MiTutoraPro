import {
  AlignLeft, Code2, Columns3, Heading2, Image, List, ListChecks, MessageSquareWarning,
  Minus, Quote, SquareTerminal, Table2, Tags,
} from 'lucide-react';

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  const bytes = new Uint32Array(4);
  globalThis.crypto?.getRandomValues?.(bytes);
  return `${prefix}-${[...bytes].map((value) => value.toString(36)).join('')}`;
}

const definition = (type, label, icon, create) => Object.freeze({ type, label, icon, create });
export const BLOCK_DEFINITIONS = Object.freeze([
  definition('heading', 'Heading', Heading2, () => ({ type: 'heading', level: 2, text: 'New heading' })),
  definition('paragraph', 'Paragraph', AlignLeft, () => ({ type: 'paragraph', text: 'Write your content here.' })),
  definition('list', 'List', List, () => ({ type: 'list', style: 'unordered', items: ['First item'] })),
  definition('code', 'Code', Code2, () => ({ type: 'code', language: 'python', code: 'Write code here' })),
  definition('callout', 'Callout', Quote, () => ({ type: 'callout', variant: 'note', title: 'Note', text: 'Add a helpful note.' })),
  definition('image', 'Image', Image, () => ({ type: 'image', assetId: 'asset-placeholder', alt: 'Describe this image', caption: 'Image caption' })),
  definition('table', 'Table', Table2, () => ({ type: 'table', columns: ['Column 1', 'Column 2'], rows: [['Value 1', 'Value 2']] })),
  definition('expected-output', 'Expected output', SquareTerminal, () => ({ type: 'expected-output', output: 'Expected output' })),
  definition('terminal-command', 'Terminal command', SquareTerminal, () => ({ type: 'terminal-command', commandId: 'run', display: { default: 'Run the project' } })),
  definition('divider', 'Divider', Minus, () => ({ type: 'divider' })),
  definition('concept', 'Concept', Tags, () => ({ type: 'concept', conceptId: randomId('concept'), title: 'Concept', text: 'Explain the concept.' })),
  definition('requirements', 'Requirements', ListChecks, () => ({ type: 'requirements', items: ['Add a requirement'] })),
  definition('common-mistakes', 'Common mistakes', MessageSquareWarning, () => ({ type: 'common-mistakes', items: ['Describe a common mistake'] })),
]);

export const BLOCK_DEFINITION_BY_TYPE = Object.freeze(Object.fromEntries(BLOCK_DEFINITIONS.map((entry) => [entry.type, entry])));

export function createBlock(type) {
  const entry = BLOCK_DEFINITION_BY_TYPE[type];
  if (!entry) throw new TypeError(`Unknown canonical block type: ${type}`);
  return Object.freeze({ blockId: randomId('block'), ...entry.create() });
}

export function duplicateBlock(block) {
  return Object.freeze({ ...structuredClone(block), blockId: randomId('block') });
}

export function createDraftId() {
  return randomId('draft');
}
