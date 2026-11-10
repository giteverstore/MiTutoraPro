import { describe, expect, it } from 'vitest';
import { enforceLinkedListIdentity, inspectLinkedList, linkedListTraversalLimit } from '../../src/compiler/function-mode/linkedListContract';

describe('generic linked-list contract safety', () => {
  it('serializes finite lists and bounds traversal', () => {
    const b = { val: 2, next: null }; const a = { val: 1, next: b };
    expect(inspectLinkedList(a, { limit: 2 }).values).toEqual([1, 2]);
    expect(linkedListTraversalLimit({ arguments: [[1, 2]] })).toBeGreaterThanOrEqual(32);
    b.next = a;
    expect(() => inspectLinkedList(a)).toThrow(/cycle/);
  });

  it('enforces reuse and fresh-allocation policies by identity', () => {
    const original = { val: 1, next: null }; const originals = new Set([original]);
    expect(() => enforceLinkedListIdentity('allocate-new-list', inspectLinkedList(original), originals)).toThrow(/reused/);
    expect(() => enforceLinkedListIdentity('reuse-input-nodes', inspectLinkedList({ val: 1, next: null }), originals)).toThrow(/new node/);
  });

  it('normalizes random pointers and rejects unreachable targets', () => {
    const a = { val: 1, next: null, random: null }; a.random = a;
    expect(inspectLinkedList(a, { includeRandom: true }).random).toEqual([0]);
    a.random = { val: 1, next: null };
    expect(() => inspectLinkedList(a, { includeRandom: true })).toThrow(/unreachable/);
  });
});
