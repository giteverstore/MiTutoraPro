const POLICIES = new Set(['structure-only', 'allow-mixed-reuse', 'reuse-input-nodes', 'return-existing-node', 'allocate-new-list', 'no-original-node-reuse']);
const RESULT_KINDS = new Set(['returned-list', 'returned-node', 'return-value', 'mutated-argument']);

export function assertLinkedListContract(contract) {
  if (contract?.adapter !== 'linked-list') throw new Error('Expected a linked-list execution contract.');
  if (!POLICIES.has(contract.identityPolicy)) throw new Error(`Unsupported linked-list identity policy: ${contract.identityPolicy}`);
  if (!RESULT_KINDS.has(contract.resultSource?.kind)) throw new Error(`Unsupported linked-list result source: ${contract.resultSource?.kind}`);
  if (contract.resultSource.kind === 'mutated-argument' && !Number.isSafeInteger(contract.resultSource.argumentIndex)) throw new Error('A mutated linked-list result requires an argument index.');
  return contract;
}

export function linkedListTraversalLimit(fixture) {
  const size = JSON.stringify(fixture?.arguments ?? []).length;
  return Math.max(32, Math.min(100_000, size * 4 + 8));
}

export function inspectLinkedList(head, { originals = new Set(), limit = 10_000, includeRandom = false } = {}) {
  const nodes = [];
  const index = new Map();
  let node = head;
  while (node != null) {
    if ((typeof node !== 'object' && typeof node !== 'function') || !('val' in node)) throw new Error('Malformed linked-list node.');
    if (index.has(node)) throw new Error('Unexpected linked-list cycle.');
    if (nodes.length >= limit) throw new Error('Linked-list output exceeded traversal limit.');
    index.set(node, nodes.length);
    nodes.push(node);
    node = node.next ?? null;
  }
  const values = nodes.map(({ val }) => val);
  const random = includeRandom ? nodes.map((item) => item.random == null ? null : index.get(item.random) ?? (() => { throw new Error('Random pointer targets an unreachable node.'); })()) : null;
  return { nodes, values, random, reused: nodes.filter((item) => originals.has(item)).length };
}

export function enforceLinkedListIdentity(policy, inspection, originals) {
  if (policy === 'reuse-input-nodes' && inspection.nodes.some((node) => !originals.has(node))) throw new Error('Linked-list output introduced a new node.');
  if ((policy === 'allocate-new-list' || policy === 'no-original-node-reuse') && inspection.nodes.some((node) => originals.has(node))) throw new Error('Linked-list output illegally reused an input node.');
  if (policy === 'return-existing-node' && inspection.nodes[0] != null && !originals.has(inspection.nodes[0])) throw new Error('Returned node is not an input node.');
  return inspection;
}
