import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVATED_FUNCTION_QUESTION_IDS } from '../src/compiler/function-mode/functionExecutionContract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const questions = JSON.parse(await readFile(path.join(root, 'src/practice/data/q250PracticeQuestions.json'), 'utf8'));
const active = new Set(ACTIVATED_FUNCTION_QUESTION_IDS);
for (const id of ['BLIND150-008', 'BLIND150-023', 'BLIND150-068', 'BLIND150-071', 'BLIND150-073', 'BLIND150-080', 'BLIND150-081', 'BLIND150-084', 'BLIND150-090', 'BLIND150-091', 'BLIND150-092', 'BLIND150-093', 'BLIND150-095', 'BLIND150-096', 'BLIND150-098', 'BLIND150-105', 'BLIND150-108', 'BLIND150-117', 'BLIND150-127', 'BLIND150-130', 'BLIND150-132', 'BLIND150-133', 'BLIND150-134', 'BLIND150-135', 'BLIND150-137', 'BLIND150-139', 'BLIND150-142', 'BLIND150-150']) active.add(id);
for (const id of ['BLIND150-004', 'BLIND150-005', 'BLIND150-012', 'BLIND150-062', 'BLIND150-070', 'BLIND150-072', 'BLIND150-074', 'BLIND150-075', 'BLIND150-076', 'BLIND150-079', 'BLIND150-085', 'BLIND150-103', 'BLIND150-131', 'BLIND150-141']) active.add(id);
for (const id of ['BLIND150-011', 'BLIND150-015', 'BLIND150-028', 'BLIND150-031', 'BLIND150-033', 'BLIND150-063', 'BLIND150-069', 'BLIND150-083', 'BLIND150-087', 'BLIND150-088', 'BLIND150-089', 'BLIND150-094', 'BLIND150-097', 'BLIND150-125', 'BLIND150-136']) active.add(id);
const reclassifiedNewAdapter = new Set(['BLIND150-032', 'BLIND150-035', 'BLIND150-038', 'BLIND150-040', 'BLIND150-042', 'BLIND150-043', 'BLIND150-046', 'BLIND150-047', 'BLIND150-048', 'BLIND150-049', 'BLIND150-050', 'BLIND150-051', 'BLIND150-052', 'BLIND150-053', 'BLIND150-054', 'BLIND150-055', 'BLIND150-056', 'BLIND150-057', 'BLIND150-058', 'BLIND150-143']);
const reclassifiedManualReview = new Set(['NC250-161', 'NC250-207', 'NC250-208', 'NC250-212', 'NC250-219', 'NC250-221', 'NC250-223']);
const currentComparators = new Set(['exact', 'two_sum', 'bt_bag_rows', 'clone_adjacency']);
const smallComparators = new Set(['anagrams', 'top_k', 'triplets', 'numeric', 'closest_points', 'bt_ordered_int_rows', 'bt_strings', 'bt_ordered_str_rows', 'trie_words', 'ocean_set', 'longest_palindrome', 'interval_union', 'pow_close', 'unordered_unique', 'quadruplet_set', 'combination_set', 'permutation_set', 'sentence_set', 'account_set', 'finite_ratios', 'edge_groups']);
const bespokeComparators = new Set(['codec', 'median_trace', 'course_order', 'itinerary', 'alien_order', 'removed_prefix', 'bst_values', 'quad_tree', 'reorganized', 'happy', 'condition_matrix']);
const explicitStatefulIds = new Set(['BLIND150-032', 'BLIND150-042', 'BLIND150-060', 'BLIND150-065', 'BLIND150-066', 'BLIND150-077', 'BLIND150-078', 'BLIND150-143', 'NC250-155', 'NC250-156', 'NC250-176', 'NC250-177', 'NC250-179', 'NC250-182', 'NC250-191', 'NC250-192']);
const statefulFalsePositives = Object.freeze({
  'BLIND150-006': { family: 'codec-round-trip', reason: 'Encode and Decode Strings is a stateless codec round trip, not a persistent object trace.' },
  'BLIND150-041': { family: 'plain-return', reason: 'Find the Duplicate Number is a single array-to-integer function.' },
  'BLIND150-086': { family: 'matrix-mutation', reason: 'Surrounded Regions mutates one board argument and has no constructor or method sequence.' },
  'NC250-164': { family: 'array-mutation', reason: 'Reverse String is a single in-place array mutation.' },
  'NC250-167': { family: 'array-mutation', reason: 'Merge Sorted Array is a single in-place array mutation.' },
  'NC250-168': { family: 'array-mutation-prefix', reason: 'Remove Duplicates is a single mutation with a returned valid-prefix length.' },
  'NC250-169': { family: 'semantic-collection', reason: '4Sum is a stateless function returning a semantic collection.' },
  'NC250-170': { family: 'array-mutation', reason: 'Rotate Array is a single in-place mutation.' },
  'NC250-172': { family: 'plain-return', reason: 'Contains Duplicate II is a single array-and-scalar function.' },
  'NC250-173': { family: 'plain-return', reason: 'Minimum Size Subarray Sum is a single scalar-returning function.' },
  'NC250-174': { family: 'plain-return', reason: 'Find K Closest Elements is a single array-returning function.' },
  'NC250-183': { family: 'plain-return', reason: 'Search Insert Position is a single binary-search function.' },
  'NC250-187': { family: 'plain-return', reason: 'Search in Rotated Sorted Array II is a single boolean-returning function.' },
  'NC250-188': { family: 'plain-return', reason: 'Split Array Largest Sum is a single scalar-returning function.' },
  'NC250-206': { family: 'plain-return', reason: 'Subset XOR Total is a single scalar-returning function.' },
  'NC250-220': { family: 'weighted-graph', reason: 'Evaluate Division is a stateless weighted graph query function.' },
  'NC250-238': { family: 'plain-return', reason: 'Longest Turbulent Subarray is a single scalar-returning function.' },
});
const structuralFalsePositives = Object.freeze({
  'BLIND150-077': { family: 'stateful-object-design', reason: 'Implement Trie is a constructor/method-sequence object contract, not a binary-tree node contract.' },
  'NC250-221': { family: 'graph', reason: 'Minimum Height Trees operates on an undirected edge graph; tree appears only in the graph-theory problem name.' },
  'NC250-223': { family: 'graph', reason: 'Critical and Pseudo-Critical Edges is a weighted MST graph contract, not a node-tree callable.' },
  'NC250-231': { family: 'dynamic-programming-grid', reason: 'Unique Paths II consumes an obstacle matrix; tree/mutation infrastructure is not involved.' },
});

function outputShape(value) {
  if (Array.isArray(value)) return Array.isArray(value[0]) ? 'nested-array' : 'array';
  if (value === null) return 'null';
  return typeof value;
}

function classify(question) {
  const text = [question.title, question.contract?.input, question.contract?.output, question.statement, ...Object.values(question.contractDetails ?? {})].join(' ').toLowerCase();
  const validators = [...new Set(question.publicTests.map(({ validator }) => validator ?? 'exact'))];
  const expectedShapes = [...new Set(question.publicTests.map(({ expected }) => outputShape(expected)))];
  const features = [];
  const add = (condition, feature) => { if (condition) features.push(feature); };
  add(/linked.?list|listnode|random pointer/.test(text), 'linked-list');
  add(/tree|bst|treenode|quad tree/.test(text), 'tree');
  add(/graph|adjacency|course schedule|network|edges/.test(text), 'graph');
  add(explicitStatefulIds.has(question.id) || /stack|queue|trie|stream|design |codec|serialize/.test(text), 'stateful-or-operation-sequence');
  add(/in.place|mutat|modify .*input|void\.|updated/.test(text), 'mutation');
  add(validators.some((v) => v !== 'exact'), 'semantic-comparison');
  add(validators.some((v) => /numeric|pow_close|finite_ratios/.test(v)) || /float|double|decimal/.test(text), 'floating-point');
  add(/unicode|non-latin|string/.test(text), 'string-or-unicode');
  add(/random pointer|cycle|identity|clone/.test(text), 'identity-sensitive');
  add(/topological|course_order|alien_order/.test(validators.join(' ')) || /topological/.test(text), 'topological-order');
  const auditReclassification = statefulFalsePositives[question.id] ?? structuralFalsePositives[question.id] ?? null;
  if (auditReclassification) {
    const treeAt = features.indexOf('tree');
    if (treeAt >= 0) features.splice(treeAt, 1);
    if (auditReclassification.family === 'graph' && !features.includes('graph')) features.push('graph');
    if (auditReclassification.family === 'stateful-object-design' && !features.includes('stateful-or-operation-sequence')) features.push('stateful-or-operation-sequence');
    if (statefulFalsePositives[question.id]) {
      const statefulAt = features.indexOf('stateful-or-operation-sequence');
      if (statefulAt >= 0) features.splice(statefulAt, 1);
    }
  }

  let coverage = 'metadata-only-mapping';
  let requiresNewAdapter = false;
  let notes = 'Existing scalar/array invocation and exact comparison are sufficient.';
  if (active.has(question.id)) {
    coverage = 'fully-supported-now';
    notes = 'Activated representative with browser harness coverage.';
  } else if (reclassifiedNewAdapter.has(question.id)) {
    coverage = 'new-adapter-required'; requiresNewAdapter = true;
    notes = 'Reclassified from metadata-only: imported contract requires a distinct linked-list, tree, graph, or stateful-object protocol beyond this primitive rollout.';
  } else if (reclassifiedManualReview.has(question.id)) {
    coverage = 'manual-review';
    notes = 'Generic comparator support is implemented, but this imported NC250 record has no independent accepted nine-language reference bundle; it remains inactive rather than weakening the browser acceptance gate.';
  } else if (/random pointer|serialize|deserialize|quad tree/.test(text) || features.includes('identity-sensitive')) {
    coverage = 'new-adapter-required'; requiresNewAdapter = true;
    notes = 'Requires identity-aware or specialized structural construction/serialization.';
  } else if (features.includes('stateful-or-operation-sequence')) {
    coverage = 'new-adapter-required'; requiresNewAdapter = true;
    notes = 'Requires operation protocol mapping beyond the current Min Stack contract.';
  } else if (validators.some((v) => bespokeComparators.has(v))) {
    coverage = 'new-adapter-required'; requiresNewAdapter = true;
    notes = `Requires bespoke semantic handling for ${validators.join(', ')}.`;
  } else if (validators.some((v) => smallComparators.has(v))) {
    coverage = 'comparator-serializer-extension';
    notes = `Requires a bounded comparator/normalizer extension for ${validators.join(', ')}.`;
  } else if (features.some((v) => ['linked-list', 'tree', 'graph', 'mutation'].includes(v))) {
    coverage = 'metadata-only-mapping';
    notes = 'Existing structural family is applicable, but callable and representation mapping must be reviewed.';
  } else if (validators.some((v) => !currentComparators.has(v))) {
    coverage = 'manual-review';
    notes = `Validator semantics are not mapped: ${validators.join(', ')}.`;
  }
  if (/structured result; see public examples/.test((question.contract?.output ?? '').toLowerCase()) && coverage === 'metadata-only-mapping') {
    coverage = 'manual-review';
    notes = 'Learner-safe contract uses a generic structured-result description; verify representation before activation.';
  }

  if (!active.has(question.id)) {
    const input = (question.publicTests[0]?.arguments ?? []).map(outputShape).join(' + ') || 'no arguments';
    const output = expectedShapes.join(' | ') || 'unspecified output';
    const acceptance = 'No complete 9-runtime x 3-fixture browser matrix exists for this contract, so activation remains disabled.';
    if (features.includes('linked-list')) notes = `${question.title} requires a bounded linked-list constructor/serializer for ${input} -> ${output}, including its imported mutation or node-identity semantics. ${acceptance}`;
    else if (features.includes('tree')) notes = `${question.title} requires a bounded tree/BST/quad-tree adapter for ${input} -> ${output}, including subtree, mutation, or node-identity semantics declared by the imported fixtures. ${acceptance}`;
    else if (features.includes('stateful-or-operation-sequence')) notes = `${question.title} requires a generic constructor/method-sequence adapter for ${input} -> ${output}; the current MinStack protocol cannot safely infer this object's constructor, void outputs, and per-operation result trace. ${acceptance}`;
    else if (features.includes('mutation')) notes = `${question.title} requires an explicit mutation-target contract for ${input} -> ${output}; the imported fixture does not yet have a fully accepted cross-runtime post-mutation serializer. ${acceptance}`;
    else if (features.includes('graph')) notes = `${question.title} requires a graph variant beyond clone adjacency for ${input} -> ${output}, with its directed, weighted, path, or identity semantics represented explicitly. ${acceptance}`;
    else if (validators.some((value) => value !== 'exact')) notes = `${question.title} uses validator ${validators.join(', ')} for ${input} -> ${output}; a test-only independent correct reference is not accepted in all nine runtimes for this imported record. ${acceptance}`;
    else notes = `${question.title} has an unaccepted callable/return mapping for ${input} -> ${output}; accepted nine-language reference coverage is missing even though its value shape appears primitive. ${acceptance}`;

    // The final audit taxonomy is evidence-only. All reusable execution and
    // comparator families are now represented; inactive records remain gated
    // solely because their nine-language reference/runtime evidence has not
    // been accepted. Keep the shape notes above for diagnostic context, but do
    // not retain historical adapter/manual-review rollout labels.
    coverage = 'reference-coverage-evidence';
    requiresNewAdapter = false;
  }

  return {
    id: question.id,
    title: question.title,
    category: question.category,
    topic: question.topic,
    active: active.has(question.id),
    executionFamily: features.length ? features : ['plain-return'],
    inputShapes: question.publicTests[0]?.arguments?.map(outputShape) ?? [],
    outputShape: expectedShapes.length === 1 ? expectedShapes[0] : expectedShapes,
    mutation: features.includes('mutation'),
    stateful: features.includes('stateful-or-operation-sequence'),
    semanticComparator: validators,
    specialSerialization: features.filter((v) => ['linked-list', 'tree', 'graph', 'identity-sensitive', 'string-or-unicode'].includes(v)),
    coverage,
    supportedByCurrentModeB: ['fully-supported-now', 'metadata-only-mapping'].includes(coverage),
    requiresNewAdapter,
    notes,
    auditReclassification,
  };
}

const records = questions.map(classify);
const coverageCounts = Object.fromEntries([...new Set(records.map(({ coverage }) => coverage))].sort().map((key) => [key, records.filter(({ coverage }) => coverage === key).length]));
const rolloutGroups = Object.fromEntries(Object.keys(coverageCounts).map((coverage) => [coverage, records.filter((record) => record.coverage === coverage).map(({ id }) => id)]));
const artifact = {
  schemaVersion: 'q250-mode-b-audit-v1',
  generatedFrom: 'src/practice/data/q250PracticeQuestions.json',
  questionCount: records.length,
  activeCount: records.filter(({ active }) => active).length,
  inactiveCount: records.filter(({ active }) => !active).length,
  coverageCounts,
  rolloutGroups,
  records,
};
const output = path.join(root, 'docs/compiler-audit/q250-mode-b-execution-shapes.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(root, output), questionCount: records.length, coverageCounts }, null, 2));
