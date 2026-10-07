import { useEffect, useState } from 'react';

// Course and Practice retain their existing block schemas. Only their authoring
// controls use the shared palette/canvas drag and keyboard action protocol.
export function useLegacyBlockWorkspace({ scopeId, blocks, setBlocks, makeId }) {
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  useEffect(() => setSelectedBlockId(null), [scopeId]);
  const dispatch = (action) => {
    if (action.type === 'select') { setSelectedBlockId(action.blockId); return; }
    const current = [...blocks];
    if (action.type === 'add') {
      const after = current.findIndex(({ id }) => id === action.afterBlockId);
      const index = action.afterBlockId && after >= 0 ? after + 1 : current.length;
      current.splice(index, 0, action.block);
      setSelectedBlockId(action.block.id);
    } else if (action.type === 'move') {
      const from = current.findIndex(({ id }) => id === action.blockId);
      if (from < 0) return;
      const [block] = current.splice(from, 1);
      current.splice(Math.max(0, Math.min(action.toIndex, current.length)), 0, block);
      setSelectedBlockId(block.id);
    } else if (action.type === 'duplicate') {
      const from = current.findIndex(({ id }) => id === action.blockId);
      if (from < 0) return;
      const copy = { ...structuredClone(current[from]), id: makeId(current[from].type) };
      current.splice(from + 1, 0, copy);
      setSelectedBlockId(copy.id);
    } else if (action.type === 'delete') {
      const from = current.findIndex(({ id }) => id === action.blockId);
      if (from < 0) return;
      current.splice(from, 1);
      setSelectedBlockId(current[Math.min(from, current.length - 1)]?.id ?? null);
    } else return;
    setBlocks(current);
  };
  return { selectedBlockId, setSelectedBlockId, selectedBlock: blocks.find(({ id }) => id === selectedBlockId) ?? null, dispatch, canvasBlocks: blocks.map((block) => ({ ...block, blockId: block.id })) };
}
