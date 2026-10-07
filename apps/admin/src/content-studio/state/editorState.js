import { duplicateBlock } from '../blocks/blockDefinitions.js';

export const EDITOR_HISTORY_LIMIT = 50;

const copyDocument = (document) => structuredClone(document);
const withHistory = (state, document, selectedBlockId = state.selectedBlockId) => ({
  ...state,
  document,
  selectedBlockId,
  past: [...state.past, copyDocument(state.document)].slice(-EDITOR_HISTORY_LIMIT),
  future: [], dirty: true, saveState: 'unsaved', validation: null,
});

export function createEditorState(document, { readOnly = false } = {}) {
  return { document: copyDocument(document), selectedBlockId: null, past: [], future: [], dirty: false, saveState: 'saved', validation: null, view: 'editor', readOnly };
}

export function editorReducer(state, action) {
  if (action.type === 'select') return { ...state, selectedBlockId: action.blockId };
  if (action.type === 'view') return { ...state, view: action.view };
  if (action.type === 'validation') return { ...state, validation: action.result };
  if (action.type === 'saving') return { ...state, saveState: 'saving' };
  if (action.type === 'saved') return action.document && action.document !== state.document ? state : { ...state, dirty: false, saveState: 'saved' };
  if (action.type === 'save-failed') return { ...state, saveState: 'failed' };
  if (action.type === 'hydrate') return state.dirty ? state : createEditorState(action.document, { readOnly: state.readOnly });
  if (state.readOnly) return state;
  if (action.type === 'add') {
    const blocks = [...state.document.blocks];
    const selectedIndex = blocks.findIndex(({ blockId }) => blockId === (action.afterBlockId ?? state.selectedBlockId));
    blocks.splice(selectedIndex < 0 ? blocks.length : selectedIndex + 1, 0, action.block);
    return withHistory(state, { ...state.document, blocks }, action.block.blockId);
  }
  if (action.type === 'update') {
    const blocks = state.document.blocks.map((block) => block.blockId === action.blockId ? { ...block, ...action.patch, blockId: block.blockId } : block);
    return withHistory(state, { ...state.document, blocks }, action.blockId);
  }
  if (action.type === 'metadata') return withHistory(state, { ...state.document, ...action.patch });
  if (action.type === 'delete') {
    const index = state.document.blocks.findIndex(({ blockId }) => blockId === action.blockId);
    const blocks = state.document.blocks.filter(({ blockId }) => blockId !== action.blockId);
    return withHistory(state, { ...state.document, blocks }, blocks[Math.min(index, blocks.length - 1)]?.blockId ?? null);
  }
  if (action.type === 'duplicate') {
    const index = state.document.blocks.findIndex(({ blockId }) => blockId === action.blockId);
    if (index < 0) return state;
    const copy = duplicateBlock(state.document.blocks[index]);
    const blocks = [...state.document.blocks]; blocks.splice(index + 1, 0, copy);
    return withHistory(state, { ...state.document, blocks }, copy.blockId);
  }
  if (action.type === 'move') {
    const from = state.document.blocks.findIndex(({ blockId }) => blockId === action.blockId);
    const to = Math.max(0, Math.min(state.document.blocks.length - 1, action.toIndex));
    if (from < 0 || from === to) return state;
    const blocks = [...state.document.blocks]; const [block] = blocks.splice(from, 1); blocks.splice(to, 0, block);
    return withHistory(state, { ...state.document, blocks }, action.blockId);
  }
  if (action.type === 'undo' && state.past.length) {
    const document = state.past.at(-1);
    return { ...state, document, past: state.past.slice(0, -1), future: [copyDocument(state.document), ...state.future].slice(0, EDITOR_HISTORY_LIMIT), dirty: true, saveState: 'unsaved', validation: null };
  }
  if (action.type === 'redo' && state.future.length) {
    const [document, ...future] = state.future;
    return { ...state, document, past: [...state.past, copyDocument(state.document)].slice(-EDITOR_HISTORY_LIMIT), future, dirty: true, saveState: 'unsaved', validation: null };
  }
  return state;
}
