const pageNumberFor = (block, projectId) => {
  const prefix = `${projectId}-p`;
  if (!block?.blockId?.startsWith(prefix)) return null;
  const match = block.blockId.slice(prefix.length).match(/^(\d+)-/);
  return match ? Number(match[1]) : null;
};

// The published source-page heading IDs are stable content IDs. This is a
// presentation index only; checkpoint and task progress remain the saved model.
export function buildProjectSourcePages(project) {
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
