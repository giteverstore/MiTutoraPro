import { describe, expect, it } from 'vitest';
import { compareFunctionResult } from '../../src/compiler/function-mode/functionResultComparison';

const compare = (policy, actual, expected, args = []) => compareFunctionResult({ policy, actual, expected, fixture: { arguments: args } });

describe('generic Practice semantic comparators', () => {
  it('normalizes nested collection families without weakening row semantics', () => {
    expect(compare('anagrams', [['tea', 'eat'], ['bat']], [['bat'], ['eat', 'tea']])).toBe(true);
    expect(compare('anagrams', [['tea'], ['bat']], [['bat'], ['eat', 'tea']])).toBe(false);
    expect(compare('triplets', [[-1, 1, 0]], [[-1, 0, 1]])).toBe(true);
    expect(compare('ordered-int-rows', [[2, 1]], [[1, 2]])).toBe(false);
    expect(compare('combination-set', [[2, 1], [3]], [[3], [1, 2]])).toBe(true);
    expect(compare('permutation-set', [[1, 2], [2, 1]], [[2, 1], [1, 2]])).toBe(true);
    expect(compare('permutation-set', [[1, 2], [1, 2]], [[2, 1], [1, 2]])).toBe(false);
  });

  it('validates unordered strings and unique flat results', () => {
    expect(compare('unordered-strings', ['dog', 'cat'], ['cat', 'dog'])).toBe(true);
    expect(compare('unordered-strings', ['dog'], ['cat', 'dog'])).toBe(false);
    expect(compare('unordered-unique', [2, 1], [1, 2])).toBe(true);
    expect(compare('unordered-unique', [1, 1], [1])).toBe(false);
  });

  it('accepts valid top-k ties but rejects under-frequency and malformed answers', () => {
    const args = [[1, 1, 2, 2, 3], 2];
    expect(compare('top-k', [1, 2], [1, 2], args)).toBe(true);
    expect(compare('top-k', [2, 1], [1, 2], args)).toBe(true);
    expect(compare('top-k', [1, 3], [1, 2], args)).toBe(false);
    expect(compare('top-k', [1, 1], [1, 2], args)).toBe(false);
  });

  it('accepts closest-point ties while enforcing membership, count and cutoff', () => {
    const args = [[[1, 0], [0, 1], [4, 4]], 1];
    expect(compare('closest-points', [[0, 1]], [[1, 0]], args)).toBe(true);
    expect(compare('closest-points', [[4, 4]], [[1, 0]], args)).toBe(false);
    expect(compare('closest-points', [[9, 9]], [[1, 0]], args)).toBe(false);
  });

  it('validates equivalent longest palindromes and bounded floating tolerance', () => {
    expect(compare('longest-palindrome', 'aba', 'bab', ['babad'])).toBe(true);
    expect(compare('longest-palindrome', 'bad', 'bab', ['babad'])).toBe(false);
    expect(compare('float-close', 0.3000000001, 0.3)).toBe(true);
    expect(compare('float-close', 0.3001, 0.3)).toBe(false);
    expect(compare('float-close', Number.NaN, 0.3)).toBe(false);
    expect(compare('float-close', Number.POSITIVE_INFINITY, 0.3)).toBe(false);
    expect(compare('finite-ratios', [6.00000001, 1 / 6, -1], [6, 1 / 6, -1])).toBe(true);
    expect(compare('finite-ratios', [6.01], [6])).toBe(false);
    expect(compare('finite-ratios', [Number.NaN], [1])).toBe(false);
    expect(compare('finite-ratios', [Number.POSITIVE_INFINITY], [1])).toBe(false);
    expect(compare('finite-ratios', [Number.NEGATIVE_INFINITY], [1])).toBe(false);
  });

  it('normalizes accounts and edge groups while rejecting missing or duplicate values', () => {
    const accounts = [['John', 'b@mail', 'a@mail'], ['Mary', 'm@mail']];
    expect(compare('account-set', accounts, [['Mary', 'm@mail'], ['John', 'a@mail', 'b@mail']])).toBe(true);
    expect(compare('account-set', [['John', 'a@mail']], accounts)).toBe(false);
    expect(compare('edge-groups', [[2, 0], [3, 1]], [[0, 2], [1, 3]])).toBe(true);
    expect(compare('edge-groups', [[0, 0], [1]], [[0], [1]])).toBe(false);
    expect(compare('quadruplet-set', [[4, 0, -3, -1]], [[-3, -1, 0, 4]])).toBe(true);
    expect(compare('quadruplet-set', [[-3, -1, 0, 4], [4, 0, -1, -3]], [[-3, -1, 0, 4]])).toBe(false);
    expect(compare('quadruplet-set', [[-3, -1, 4]], [[-3, -1, 0, 4]])).toBe(false);
  });

  it('validates topological course and alien-alphabet alternatives semantically', () => {
    expect(compare('course-order', [0, 2, 1, 3], [0, 1, 2, 3], [4, [[1, 0], [2, 0], [3, 1], [3, 2]]])).toBe(true);
    expect(compare('course-order', [1, 0, 2, 3], [0, 1, 2, 3], [4, [[1, 0], [2, 0], [3, 1], [3, 2]]])).toBe(false);
    expect(compare('alien-order', 'aelprb', 'aelprb', [['app', 'apple', 'bear']])).toBe(true);
    expect(compare('alien-order', 'baelpr', 'aelprb', [['app', 'apple', 'bear']])).toBe(false);
  });

  it('validates BST value semantics without requiring one insertion shape', () => {
    expect(compare('bst-values', [5, 3, 6, 2, 4, null, 7, 1], [4, 2, 6, 1, 3, 5, 7])).toBe(true);
    expect(compare('bst-values', [5, 6, 2], [4, 2, 6])).toBe(false);
    expect(compare('bst-values', [5, 2, 6], [4, 2, 6])).toBe(false);
  });

  it('normalizes quad-tree records while ignoring only internal-node values', () => {
    const expected = [[1, 0, 0], [4, 1, 1], [5, 1, 1], [6, 1, 0], [7, 1, 0]];
    expect(compare('quad-tree', [[7, 1, 0], [1, 0, 1], [4, 1, 1], [6, 1, 0], [5, 1, 1]], expected)).toBe(true);
    expect(compare('quad-tree', [[1, 0, 1], [4, 1, 0], [5, 1, 1], [6, 1, 0], [7, 1, 0]], expected)).toBe(false);
  });

  it('validates reorganized and longest-happy strings semantically', () => {
    expect(compare('reorganized', 'abcbd', 'babcd', ['bbacd'])).toBe(true);
    expect(compare('reorganized', 'bbacd', 'babcd', ['bbacd'])).toBe(false);
    expect(compare('happy', 'aaba', 'aaba', [3, 1, 0])).toBe(true);
    expect(compare('happy', 'aaab', 'aaba', [3, 1, 0])).toBe(false);
  });

  it('accepts alternate valid condition matrices and rejects malformed precedence results', () => {
    const args = [3, [[1, 2]], [[2, 3]]];
    const expected = [[1, 0, 0], [0, 2, 0], [0, 0, 3]];
    expect(compare('condition-matrix', expected, expected, args)).toBe(true);
    expect(compare('condition-matrix', [[0, 0, 1], [2, 0, 0], [0, 3, 0]], expected, args)).toBe(true);
    expect(compare('condition-matrix', [[1, 0, 0], [0, 1, 0], [0, 0, 3]], expected, args)).toBe(false);
    expect(compare('condition-matrix', [[0, 2, 0], [1, 0, 0], [0, 0, 3]], expected, args)).toBe(false);
    expect(compare('condition-matrix', [[0, 0, 1], [0, 2, 0], [3, 0, 0]], expected, args)).toBe(false);
    expect(compare('condition-matrix', [[1, 0, 0], [0, 2, 0], [0, 0, 4]], expected, args)).toBe(false);
    expect(compare('condition-matrix', [[1, 0, 0], [0, 2], [0, 0, 3]], expected, args)).toBe(false);
    expect(compare('condition-matrix', [[1, 0], [0, 2]], expected, args)).toBe(false);
    expect(compare('condition-matrix', [], [], [2, [[1, 2], [2, 1]], [[1, 2]]])).toBe(true);
    expect(compare('condition-matrix', [[1, 0], [0, 2]], [], [2, [[1, 2], [2, 1]], [[1, 2]]])).toBe(false);
  });
});
