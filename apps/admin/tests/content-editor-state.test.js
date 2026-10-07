import { describe, expect, it } from 'vitest';
import { BLOCK_DEFINITIONS, createBlock } from '../src/content-studio/blocks/blockDefinitions.js';
import { createEmptyEditorDocument } from '../src/content-studio/serialization/editorSerialization.js';
import { createEditorState, editorReducer, EDITOR_HISTORY_LIMIT } from '../src/content-studio/state/editorState.js';

const reduce = (state, action) => editorReducer(state, action);

describe('structured content editor state', () => {
  it('supports every canonical block and preserves stable identities while reordering', () => {
    let state = createEditorState(createEmptyEditorDocument());
    for (const definition of BLOCK_DEFINITIONS) state = reduce(state, { type: 'add', block: createBlock(definition.type) });
    expect(state.document.blocks.map(({ type }) => type)).toEqual(BLOCK_DEFINITIONS.map(({ type }) => type));
    const ids = state.document.blocks.map(({ blockId }) => blockId);
    state = reduce(state, { type: 'move', blockId: ids[0], toIndex: ids.length - 1 });
    expect(state.document.blocks.at(-1).blockId).toBe(ids[0]);
    expect(new Set(state.document.blocks.map(({ blockId }) => blockId)).size).toBe(ids.length);
  });

  it('adds at a drop target, edits, duplicates, deletes, and reverses changes', () => {
    const first = createBlock('heading');
    const second = createBlock('paragraph');
    let state = createEditorState({ ...createEmptyEditorDocument(), blocks: [first, second] });
    const code = createBlock('code');
    state = reduce(state, { type: 'add', block: code, afterBlockId: first.blockId });
    expect(state.document.blocks.map(({ blockId }) => blockId)).toEqual([first.blockId, code.blockId, second.blockId]);
    state = reduce(state, { type: 'update', blockId: code.blockId, patch: { code: 'print("updated")' } });
    expect(state.document.blocks[1].code).toBe('print("updated")');
    state = reduce(state, { type: 'duplicate', blockId: code.blockId });
    const duplicate = state.document.blocks[2];
    expect(duplicate.code).toBe('print("updated")');
    expect(duplicate.blockId).not.toBe(code.blockId);
    state = reduce(state, { type: 'delete', blockId: duplicate.blockId });
    state = reduce(state, { type: 'undo' });
    expect(state.document.blocks.some(({ blockId }) => blockId === duplicate.blockId)).toBe(true);
    state = reduce(state, { type: 'redo' });
    expect(state.document.blocks.some(({ blockId }) => blockId === duplicate.blockId)).toBe(false);
  });

  it('bounds history and makes reviewer state immutable', () => {
    let state = createEditorState(createEmptyEditorDocument());
    for (let index = 0; index < EDITOR_HISTORY_LIMIT + 8; index += 1) state = reduce(state, { type: 'metadata', patch: { title: `Title ${index}` } });
    expect(state.past).toHaveLength(EDITOR_HISTORY_LIMIT);
    const reviewer = createEditorState(createEmptyEditorDocument(), { readOnly: true });
    expect(reduce(reviewer, { type: 'add', block: createBlock('heading') })).toBe(reviewer);
  });

  it('does not clear a newer dirty revision when an older save completes', () => {
    let state = createEditorState(createEmptyEditorDocument());
    state = reduce(state, { type: 'metadata', patch: { title: 'First edit' } });
    const savingDocument = state.document;
    state = reduce(state, { type: 'metadata', patch: { title: 'Second edit' } });
    state = reduce(state, { type: 'saved', document: savingDocument });
    expect(state.dirty).toBe(true);
    expect(state.document.title).toBe('Second edit');
  });
});
