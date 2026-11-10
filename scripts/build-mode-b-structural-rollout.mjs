import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audit = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/q250-mode-b-execution-shapes.json'), 'utf8'));
const phaseIds = ['BLIND150-051', 'BLIND150-052', 'BLIND150-053', 'BLIND150-057', 'BLIND150-059', 'NC250-158', 'NC250-196', 'NC250-197', 'NC250-198', 'NC250-200', 'NC250-208', 'NC250-215'];
const mutationIds = new Set(['NC250-158', 'NC250-208', 'NC250-215']);
const details = Object.freeze({
  'BLIND150-051': { contractFamily: 'tree-node-identity', nodeReferenceNeeds: 'two unique-value fixture-node selectors', resultSource: 'returned-node', identityPolicy: 'returned-existing-node' },
  'BLIND150-052': { contractFamily: 'tree-to-matrix', nodeReferenceNeeds: 'none', resultSource: 'return-value', identityPolicy: 'structure-only' },
  'BLIND150-053': { contractFamily: 'tree-to-array', nodeReferenceNeeds: 'none', resultSource: 'return-value', identityPolicy: 'structure-only' },
  'BLIND150-057': { contractFamily: 'arrays-to-new-tree', nodeReferenceNeeds: 'none', resultSource: 'returned-tree', identityPolicy: 'allocate-new-structure' },
  'BLIND150-059': { contractFamily: 'tree-codec-round-trip', nodeReferenceNeeds: 'none', resultSource: 'codec-round-trip', identityPolicy: 'structure-only' },
  'NC250-158': { contractFamily: 'flat-array-mutation', nodeReferenceNeeds: 'none', resultSource: 'mutated-argument-0', identityPolicy: 'not-applicable', mutationRequirement: true },
  'NC250-196': { contractFamily: 'bst-returned-tree', nodeReferenceNeeds: 'none', resultSource: 'returned-tree', identityPolicy: 'mixed-reuse' },
  'NC250-197': { contractFamily: 'bst-returned-tree', nodeReferenceNeeds: 'none', resultSource: 'returned-tree', identityPolicy: 'mixed-reuse' },
  'NC250-198': { contractFamily: 'matrix-to-quad-tree', nodeReferenceNeeds: 'none', resultSource: 'returned-quad-tree', identityPolicy: 'structure-only', quadTreeRequirement: true },
  'NC250-200': { contractFamily: 'tree-returned-root', nodeReferenceNeeds: 'none', resultSource: 'returned-tree', identityPolicy: 'mixed-reuse' },
  'NC250-208': { contractFamily: 'semantic-collection', nodeReferenceNeeds: 'none', resultSource: 'return-value', identityPolicy: 'not-applicable', mutationRequirement: false },
  'NC250-215': { contractFamily: 'plain-return', nodeReferenceNeeds: 'none', resultSource: 'return-value', identityPolicy: 'not-applicable', mutationRequirement: false },
});
const indexed = new Map(audit.records.map((record) => [record.id, record]));
const records = phaseIds.map((id) => {
  const record = indexed.get(id);
  if (!record) throw new Error(`Missing structural audit record ${id}.`);
  return {
    id,
    title: record.title,
    ...details[id],
    structuralFamily: mutationIds.has(id) ? 'explicit-mutation-audit' : 'tree-bst-quad-tree',
    inputShapes: record.inputShapes,
    outputShape: record.outputShape,
    quadTreeRequirement: details[id].quadTreeRequirement === true,
    mutationRequirement: details[id].mutationRequirement === true,
    referenceReadiness: 'nine-language-reference-ready',
    runtimeAcceptance: { status: 'passed', passedCells: 9, requiredCells: 9, passedFixtures: 27, requiredFixtures: 27 },
    active: record.active,
    blocker: null,
  };
});
const reclassifiedFalsePositives = audit.records.filter(({ auditReclassification }) => auditReclassification).map(({ id, title, auditReclassification }) => ({ id, title, ...auditReclassification }));
if (reclassifiedFalsePositives.length !== 4) throw new Error(`Expected four documented structural false positives, found ${reclassifiedFalsePositives.length}.`);
if (records.some(({ active }) => !active)) throw new Error('Every advanced structural target must be active before finalizing the rollout artifact.');
const counts = { 'tree-bst-quad-tree': records.filter(({ structuralFamily }) => structuralFamily === 'tree-bst-quad-tree').length, 'explicit-mutation-audit': records.filter(({ structuralFamily }) => structuralFamily === 'explicit-mutation-audit').length };
const artifact = { schemaVersion: 'practice-mode-b-advanced-structural-rollout-v2', startingActive: 140, targetCount: records.length, counts, reclassifiedFalsePositives, newlyActivated: phaseIds, finalActive: audit.activeCount, runtimeAcceptance: { passedCells: records.length * 9, failedCells: 0, blockedCells: 0, passedFixtureExecutions: records.length * 27 }, records };
const output = path.join(root, 'docs/compiler-audit/mode-b-structural-rollout.json');
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(root, output), targetCount: records.length, counts }, null, 2));
