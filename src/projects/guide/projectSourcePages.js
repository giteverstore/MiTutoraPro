const pageNumberFor = (block, projectId) => {
  const prefix = `${projectId}-p`;
  if (!block?.blockId?.startsWith(prefix)) return null;
  const match = block.blockId.slice(prefix.length).match(/^(\d+)-/);
  return match ? Number(match[1]) : null;
};

// The published source-page heading IDs are stable content IDs. This is a
// presentation index only; checkpoint and task progress remain the saved model.
export function buildProjectSourcePages(project) {
  if (Array.isArray(project?.guidePages) && project.guidePages.length) {
    const pages = project.guidePages.map((page, index) => ({ ...page, number: index + 1 }));
    const checkpointFirstPageIndices = project.checkpoints.map((checkpoint, checkpointIndex) => pages.findIndex((page) => page.kind === 'task' && (page.checkpointId === checkpoint.id || page.checkpointIndex === checkpointIndex)));
    return checkpointFirstPageIndices.includes(-1) ? null : { pages, checkpointFirstPageIndices };
  }
  if (!project?.projectId || !Array.isArray(project.checkpoints)) return null;
  const pages = [];
  let valid = true;
  const collect = (blocks, checkpointIndex, ownerTaskId = null) => {
    let current = null;
    for (const block of blocks ?? []) {
      const number = pageNumberFor(block, project.projectId);
      // Task-specific supporting blocks may have task IDs rather than page IDs.
      // They belong to the preceding task source page in the same block group.
      if (number === null && current) { current.blocks.push(block); continue; }
      if (!Number.isSafeInteger(number) || number < 1) { valid = false; return; }
      if (number !== current?.number) {
        if (block.blockId !== `${project.projectId}-p${number}-title` || block.type !== 'heading') { valid = false; return; }
        current = {
          id: block.blockId, number, title: block.text, checkpointIndex,
          taskId: ownerTaskId && /^Page\s+\d+\s*[—–-]\s*Task\s+\d+\b/i.test(block.text) ? ownerTaskId : null,
          blocks: [],
        };
        pages.push(current);
      }
      current.blocks.push(block);
    }
  };
  project.checkpoints.forEach((checkpoint, checkpointIndex) => {
    collect(checkpoint.blocks, checkpointIndex);
    checkpoint.tasks?.forEach((task) => collect(task.blocks, checkpointIndex, task.taskId));
    collect(checkpoint.completionBlocks, checkpointIndex);
  });
  collect(project.completionBlocks, project.checkpoints.length - 1);
  if (!valid || pages.length < 2 || pages.some((page, index) => page.number !== index + 1)) return null;
  const checkpointFirstPageIndices = project.checkpoints.map((_, index) => pages.findIndex((page) => page.checkpointIndex === index));
  return checkpointFirstPageIndices.includes(-1) ? null : { pages, checkpointFirstPageIndices };
}

export function resolveSavedGuidePageIndex(sourceGuide, savedProgress = {}, initialCheckpointIndex = null) {
  if (!sourceGuide?.pages?.length) return 0;
  const physicalSourceGuide = sourceGuide.pages.every(({ sourcePageStart, sourcePageEnd }) => Number.isInteger(sourcePageStart) && Number.isInteger(sourcePageEnd));
  if (initialCheckpointIndex !== null && initialCheckpointIndex !== undefined) {
    return Math.max(0, sourceGuide.checkpointFirstPageIndices[Math.max(0, Math.min(sourceGuide.checkpointFirstPageIndices.length - 1, initialCheckpointIndex))] ?? 0);
  }
  if (typeof savedProgress.guidePageId === 'string') {
    const exact = sourceGuide.pages.findIndex(({ id }) => id === savedProgress.guidePageId);
    if (exact >= 0) return exact;
  }
  if (Number.isSafeInteger(savedProgress.guideSourcePage)) {
    const source = savedProgress.guideSourcePage;
    const exact = sourceGuide.pages.findIndex(({ sourcePageStart, sourcePageEnd }) => source >= sourcePageStart && source <= sourcePageEnd);
    if (exact >= 0) return exact;
    return sourceGuide.pages.reduce((best, page, index) => Math.abs(page.sourcePageStart - source) < best.distance ? { index, distance: Math.abs(page.sourcePageStart - source) } : best, { index: 0, distance: Infinity }).index;
  }
  // Legacy progress stored only a condensed-page index. It cannot safely map to
  // physical source pages, so resume at the learner's associated checkpoint.
  if (Number.isSafeInteger(savedProgress.guidePageIndex)) {
    if (!physicalSourceGuide) return Math.max(0, Math.min(sourceGuide.pages.length - 1, savedProgress.guidePageIndex));
    const checkpoint = Math.max(0, Math.min(sourceGuide.checkpointFirstPageIndices.length - 1, savedProgress.currentCheckpoint ?? 0));
    return sourceGuide.checkpointFirstPageIndices[checkpoint] ?? 0;
  }
  if (!physicalSourceGuide && Number.isSafeInteger(savedProgress.currentCheckpoint)) {
    const checkpoint = Math.max(0, Math.min(sourceGuide.checkpointFirstPageIndices.length - 1, savedProgress.currentCheckpoint));
    return sourceGuide.checkpointFirstPageIndices[checkpoint] ?? 0;
  }
  return 0;
}
