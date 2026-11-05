export function validateProjectGuideFidelity(project, contract) {
  const errors = [];
  const pages = project?.guidePages ?? [];
  const expectedCount = contract?.physicalPageCount ?? 0;
  const covered = [];
  const ids = new Set();
  for (const page of pages) {
    if (!page.id || ids.has(page.id)) errors.push(`Duplicate or missing Guide page ID: ${page.id ?? '(missing)'}`);
    ids.add(page.id);
    if (!Number.isInteger(page.sourcePageStart) || !Number.isInteger(page.sourcePageEnd) || page.sourcePageStart > page.sourcePageEnd) errors.push(`Invalid source range for ${page.id}`);
    if (page.sourcePageEnd > page.sourcePageStart && !page.mergeReason) errors.push(`Merged page ${page.id} requires a mergeReason`);
    for (let number = page.sourcePageStart; number <= page.sourcePageEnd; number += 1) covered.push(number);
  }
  const expected = Array.from({ length: expectedCount }, (_, index) => index + 1);
  if (covered.join(',') !== expected.join(',')) errors.push(`Physical source-page coverage must be exactly 1-${expectedCount}; received ${covered.join(',')}`);
  if (contract?.mergePolicy === 'one-physical-page-per-guide-page' && pages.length !== expectedCount) errors.push(`Expected ${expectedCount} Guide pages; received ${pages.length}`);
  const taskPages = pages.filter(({ kind }) => kind === 'task').map(({ sourcePageStart }) => sourcePageStart);
  if (taskPages.join(',') !== (contract?.taskPages ?? []).join(',')) errors.push(`Task/source-page mapping mismatch: ${taskPages.join(',')}`);
  if (pages.filter(({ kind }) => kind === 'task').length !== project.checkpoints.length) errors.push(`Task page count must equal checkpoint count (${project.checkpoints.length})`);
  return errors;
}
