import { foundationProjects } from '../src/projects/catalog/foundationProjects.js';
import { PROJECT_GUIDE_SOURCE_CONTRACTS } from '../src/projects/catalog/projectGuideSourcePages.js';
import { validateProjectGuideFidelity } from '../src/projects/guide/projectGuideFidelity.js';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

let failed = false;
for (const project of foundationProjects.filter(({ id }) => PROJECT_GUIDE_SOURCE_CONTRACTS[id])) {
  const errors = validateProjectGuideFidelity(project, PROJECT_GUIDE_SOURCE_CONTRACTS[project.id]);
  const contract = PROJECT_GUIDE_SOURCE_CONTRACTS[project.id];
  if (existsSync(contract.sourceDocument)) {
    const hash = createHash('sha256').update(readFileSync(contract.sourceDocument)).digest('hex').toUpperCase();
    if (hash !== contract.sourceSha256) errors.push(`Authoritative DOCX hash changed: ${hash}`);
  }
  if (errors.length) {
    failed = true;
    console.error(`${project.id}:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  } else {
    console.log(`${project.id}: ${project.guidePages.length} physical pages, ${project.checkpoints.length} task pages, no gaps or merges`);
  }
}
if (failed) process.exitCode = 1;
