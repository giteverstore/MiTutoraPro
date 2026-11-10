import { createStatefulExecutionDefinition } from './statefulExecutionContract.js';

export const FUNCTION_EXECUTION_CONTRACT_VERSION = 'practice-function-v1';

const MIN_STACK_STATEFUL = createStatefulExecutionDefinition({
  className: 'MinStack', operationArgumentIndex: 0,
  operations: {
    0: { method: 'push', argumentIndexes: [1] },
    1: { method: 'pop', argumentIndexes: [] },
    2: { method: 'top', argumentIndexes: [], collect: true },
    3: { method: 'getMin', argumentIndexes: [], collect: true },
  },
  native: { cPrefix: 'minStack', cFactory: 'minStackCreate', cDestructor: 'minStackFree' },
});

const HASH_SET_STATEFUL = createStatefulExecutionDefinition({
  className: 'MyHashSet', operationArgumentIndex: 0,
  operations: {
    0: { method: 'add', argumentIndexes: [1] },
    1: { method: 'remove', argumentIndexes: [1] },
    2: { method: 'contains', argumentIndexes: [1], collect: true, resultType: 'boolean-integer' },
  },
  native: { cPrefix: 'myHashSet', cFactory: 'myHashSetCreate' },
});

const HASH_MAP_STATEFUL = createStatefulExecutionDefinition({
  className: 'MyHashMap', operationArgumentIndex: 0,
  operations: {
    0: { method: 'put', argumentIndexes: [1, 2] },
    1: { method: 'remove', argumentIndexes: [1] },
    2: { method: 'get', argumentIndexes: [1], collect: true },
  },
  native: { cPrefix: 'myHashMap', cFactory: 'myHashMapCreate' },
});

const STACK_STATEFUL = createStatefulExecutionDefinition({
  className: 'MyStack', operationArgumentIndex: 0,
  operations: {
    0: { method: 'push', argumentIndexes: [1] },
    1: { method: 'pop', argumentIndexes: [], collect: true },
    2: { method: 'top', argumentIndexes: [], collect: true },
    3: { method: 'empty', argumentIndexes: [], collect: true, resultType: 'boolean-integer' },
  },
  native: { cPrefix: 'myStack', cFactory: 'myStackCreate' },
});

const QUEUE_STATEFUL = createStatefulExecutionDefinition({
  className: 'MyQueue', operationArgumentIndex: 0,
  operations: {
    0: { method: 'push', argumentIndexes: [1] },
    1: { method: 'pop', argumentIndexes: [], collect: true },
    2: { method: 'peek', argumentIndexes: [], collect: true },
    3: { method: 'empty', argumentIndexes: [], collect: true, resultType: 'boolean-integer' },
  },
  native: { cPrefix: 'myQueue', cFactory: 'myQueueCreate' },
});

const LRU_STATEFUL = createStatefulExecutionDefinition({
  className: 'LRUCache', constructorArgumentIndexes: [0], operationArgumentIndex: 1,
  operations: {
    0: { method: 'get', argumentIndexes: [1], collect: true },
    1: { method: 'put', argumentIndexes: [1, 2] },
  },
  native: { cPrefix: 'lruCache', cFactory: 'lruCacheCreate', cDestructor: 'lruCacheFree' },
});

const FREQUENCY_STACK_STATEFUL = createStatefulExecutionDefinition({
  className: 'FreqStack', operationArgumentIndex: 0,
  operations: {
    0: { method: 'push', argumentIndexes: [1] },
    1: { method: 'pop', argumentIndexes: [], collect: true },
  },
  native: { cPrefix: 'freqStack', cFactory: 'freqStackCreate' },
});

const STOCK_SPANNER_STATEFUL = createStatefulExecutionDefinition({
  className: 'StockSpanner', operationArgumentIndex: 0,
  scalarOperation: { method: 'next', collect: true },
  native: { cPrefix: 'stockSpanner', cFactory: 'stockSpannerCreate' },
});

const KTH_LARGEST_STATEFUL = createStatefulExecutionDefinition({
  className: 'KthLargest', constructorArgumentIndexes: [0, 1], operationArgumentIndex: 2,
  scalarOperation: { method: 'add', collect: true },
  native: { cPrefix: 'kthLargest', cFactory: 'kthLargestCreate' },
});

const MEDIAN_FINDER_STATEFUL = createStatefulExecutionDefinition({
  className: 'MedianFinder', operationArgumentIndex: 0,
  operations: {
    0: { method: 'addNum', argumentIndexes: [1] },
    1: { method: 'findMedian', argumentIndexes: [], collect: true, resultType: 'number' },
  },
  native: { cPrefix: 'medianFinder', cFactory: 'medianFinderCreate', cDestructor: 'medianFinderFree' },
});

const CIRCULAR_QUEUE_STATEFUL = createStatefulExecutionDefinition({
  className: 'MyCircularQueue', constructorArgumentIndexes: [0], operationArgumentIndex: 1,
  operations: {
    0: { method: 'enQueue', argumentIndexes: [1], collect: true, resultType: 'boolean-integer' },
    1: { method: 'deQueue', argumentIndexes: [], collect: true, resultType: 'boolean-integer' },
    2: { method: 'Front', argumentIndexes: [], collect: true },
    3: { method: 'Rear', argumentIndexes: [], collect: true },
    4: { method: 'isEmpty', argumentIndexes: [], collect: true, resultType: 'boolean-integer' },
    5: { method: 'isFull', argumentIndexes: [], collect: true, resultType: 'boolean-integer' },
  },
  native: { cPrefix: 'myCircularQueue', cFactory: 'myCircularQueueCreate' },
});

const TRIE_STATEFUL = createStatefulExecutionDefinition({
  className: 'Trie', operationArgumentIndex: 0,
  operations: {
    insert: { method: 'insert', argumentIndexes: [1], argumentTypes: ['string'] },
    search: { method: 'search', argumentIndexes: [1], argumentTypes: ['string'], collect: true, resultType: 'boolean-integer' },
    startsWith: { method: 'startsWith', argumentIndexes: [1], argumentTypes: ['string'], collect: true, resultType: 'boolean-integer' },
  }, native: { cPrefix: 'trie', cFactory: 'trieCreate' },
});

const WORD_DICTIONARY_STATEFUL = createStatefulExecutionDefinition({
  className: 'WordDictionary', operationArgumentIndex: 0,
  operations: {
    addWord: { method: 'addWord', argumentIndexes: [1], argumentTypes: ['string'] },
    search: { method: 'search', argumentIndexes: [1], argumentTypes: ['string'], collect: true, resultType: 'boolean-integer' },
  }, native: { cPrefix: 'wordDictionary', cFactory: 'wordDictionaryCreate' },
});

const DETECT_SQUARES_STATEFUL = createStatefulExecutionDefinition({
  className: 'DetectSquares', operationArgumentIndex: 0,
  operations: {
    0: { method: 'add', argumentIndexes: [[1, 2]], argumentTypes: ['integer-array'] },
    1: { method: 'count', argumentIndexes: [[1, 2]], argumentTypes: ['integer-array'], collect: true },
  }, native: { cPrefix: 'detectSquares', cFactory: 'detectSquaresCreate' },
});

const TIME_MAP_STATEFUL = createStatefulExecutionDefinition({
  className: 'TimeMap', operationArgumentIndex: 0,
  operations: {
    set: { method: 'set', argumentIndexes: [1, 2, 3], argumentTypes: ['string', 'string', 'integer'] },
    get: { method: 'get', argumentIndexes: [1, 2], argumentTypes: ['string', 'integer'], collect: true, resultType: 'string' },
  }, native: { cPrefix: 'timeMap', cFactory: 'timeMapCreate', cDestructor: 'timeMapFree' },
});

const TWITTER_STATEFUL = createStatefulExecutionDefinition({
  className: 'Twitter', operationArgumentIndex: 0,
  operations: {
    0: { method: 'postTweet', argumentIndexes: [1, 2] },
    1: { method: 'getNewsFeed', argumentIndexes: [1], collect: true, resultType: 'integer-array' },
    2: { method: 'follow', argumentIndexes: [1, 2] },
    3: { method: 'unfollow', argumentIndexes: [1, 2] },
  }, native: { cPrefix: 'twitter', cFactory: 'twitterCreate' },
});

const LFU_CACHE_STATEFUL = createStatefulExecutionDefinition({
  className: 'LFUCache', constructorArgumentIndexes: [0], operationArgumentIndex: 1,
  operations: {
    0: { method: 'put', argumentIndexes: [1, 2] },
    1: { method: 'get', argumentIndexes: [1], collect: true },
  }, native: { cPrefix: 'lFUCache', cFactory: 'lFUCacheCreate' },
});


const BASE_DEFINITIONS = Object.freeze({
  'NC250-151': { adapter: 'plain-return', callable: 'getConcatenation', returnType: 'integer-array', argumentTypes: ['integer-array'], comparison: 'exact' },
  'NC250-152': { adapter: 'plain-return', callable: 'longestCommonPrefix', returnType: 'string', argumentTypes: ['string-array'], comparison: 'exact' },
  'NC250-154': { adapter: 'plain-return', callable: 'majorityElement', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'NC250-157': { adapter: 'plain-return', callable: 'sortArray', returnType: 'integer-array', argumentTypes: ['integer-array'], comparison: 'exact' },
  'NC250-160': { adapter: 'plain-return', callable: 'maxProfitUnlimited', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'NC250-165': { adapter: 'plain-return', callable: 'validPalindromeII', returnType: 'boolean', argumentTypes: ['string'], comparison: 'exact' },
  'NC250-166': { adapter: 'plain-return', callable: 'mergeAlternately', returnType: 'string', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'NC250-172': { adapter: 'plain-return', callable: 'containsNearbyDuplicate', returnType: 'boolean', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'NC250-183': { adapter: 'plain-return', callable: 'searchInsert', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'NC250-185': { adapter: 'plain-return', callable: 'mySqrt', returnType: 'integer', argumentTypes: ['integer'], comparison: 'exact' },
  'NC250-243': { adapter: 'plain-return', callable: 'convertToTitle', returnType: 'string', argumentTypes: ['integer'], comparison: 'exact' },
  'NC250-244': { adapter: 'plain-return', callable: 'gcdOfStrings', returnType: 'string', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'NC250-246': { adapter: 'plain-return', callable: 'transpose', returnType: 'integer-matrix', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'NC250-247': { adapter: 'plain-return', callable: 'romanToInt', returnType: 'integer', argumentTypes: ['string'], comparison: 'exact' },
  'NC250-248': { adapter: 'plain-return', callable: 'addBinary', returnType: 'string', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'NC250-249': { adapter: 'plain-return', callable: 'rangeBitwiseAnd', returnType: 'integer', argumentTypes: ['integer', 'integer'], comparison: 'exact' },
  'NC250-175': { adapter: 'plain-return', callable: 'calPoints', returnType: 'string', argumentTypes: ['string-array'], comparison: 'exact' },
  'NC250-178': { adapter: 'plain-return', callable: 'asteroidCollision', returnType: 'integer-array', argumentTypes: ['integer-array'], comparison: 'exact' },
  'NC250-180': { adapter: 'plain-return', callable: 'simplifyPath', returnType: 'string', argumentTypes: ['string'], comparison: 'exact' },
  'NC250-181': { adapter: 'plain-return', callable: 'decodeString', returnType: 'string', argumentTypes: ['string'], comparison: 'exact' },
  'NC250-186': { adapter: 'plain-return', callable: 'shipWithinDays', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'NC250-187': { adapter: 'plain-return', callable: 'searchRotatedII', returnType: 'boolean', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'NC250-188': { adapter: 'plain-return', callable: 'splitArray', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-006': { adapter: 'plain-return', callable: 'encode', returnType: 'string-array', argumentTypes: ['string-array'], comparison: 'exact', resultSource: { kind: 'codec-round-trip', encode: 'encode', decode: 'decode' } },
  'NC250-164': { adapter: 'mutation', callable: 'reverseString', returnType: 'string-array', argumentTypes: ['string-array'], mutationTarget: 0, comparison: 'exact' },
  'NC250-167': { adapter: 'mutation', callable: 'merge', returnType: 'integer-array', argumentTypes: ['integer-array', 'integer', 'integer-array', 'integer'], mutationTarget: 0, comparison: 'exact' },
  'NC250-170': { adapter: 'mutation', callable: 'rotateArray', returnType: 'integer-array', argumentTypes: ['integer-array', 'integer'], mutationTarget: 0, comparison: 'exact' },
  'NC250-153': { adapter: 'valid-prefix-mutation', callable: 'removeElement', returnType: 'integer-array', argumentTypes: ['integer-array', 'integer'], mutationTarget: 0, comparison: 'exact' },
  'NC250-168': { adapter: 'valid-prefix-mutation', callable: 'removeDuplicates', returnType: 'integer-array', argumentTypes: ['integer-array'], mutationTarget: 0, comparison: 'exact' },
  'NC250-202': { adapter: 'plain-return', callable: 'reorganizeString', returnType: 'string', argumentTypes: ['string'], comparison: 'reorganized' },
  'NC250-203': { adapter: 'plain-return', callable: 'longestDiverseString', returnType: 'string', argumentTypes: ['integer', 'integer', 'integer'], comparison: 'happy' },
  'NC250-223': { adapter: 'plain-return', callable: 'findCriticalAndPseudoCriticalEdges', returnType: 'integer-matrix', argumentTypes: ['integer', 'integer-matrix'], comparison: 'edge-groups', graph: { representation: 'weighted-edge-list', directed: false, weighted: true } },
  'NC250-224': { adapter: 'plain-return', callable: 'buildMatrix', returnType: 'integer-matrix', argumentTypes: ['integer', 'integer-matrix', 'integer-matrix'], comparison: 'condition-matrix', graph: { representation: 'precedence-edges', directed: true, weighted: false } },
  'BLIND150-001': { adapter: 'plain-return', callable: 'containsDuplicate', returnType: 'boolean', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-003': { adapter: 'plain-return', callable: 'twoSum', returnType: 'integer-array', argumentTypes: ['integer-array', 'integer'], comparison: 'two-sum' },
  'BLIND150-138': { adapter: 'mutation', callable: 'setZeroes', returnType: 'integer-matrix', argumentTypes: ['integer-matrix'], mutationTarget: 0, comparison: 'exact' },
  'BLIND150-034': { adapter: 'linked-list', callable: 'reverseList', returnType: 'integer-array', argumentTypes: ['linked-list'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'allow-mixed-reuse' },
  'BLIND150-045': { adapter: 'tree', callable: 'invertTree', returnType: 'level-order-tree', argumentTypes: ['level-order-tree'], comparison: 'exact' },
  'BLIND150-082': { adapter: 'graph', callable: 'cloneGraph', returnType: 'adjacency-list', argumentTypes: ['adjacency-list'], comparison: 'graph-adjacency', requireDistinctRoot: true },
  'BLIND150-022': { adapter: 'stateful', callable: 'MinStack', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: MIN_STACK_STATEFUL },
  'NC250-155': { adapter: 'stateful', callable: 'MyHashSet', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: HASH_SET_STATEFUL },
  'NC250-156': { adapter: 'stateful', callable: 'MyHashMap', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: HASH_MAP_STATEFUL },
  'NC250-176': { adapter: 'stateful', callable: 'MyStack', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: STACK_STATEFUL },
  'NC250-177': { adapter: 'stateful', callable: 'MyQueue', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: QUEUE_STATEFUL },
  'BLIND150-042': { adapter: 'stateful', callable: 'LRUCache', returnType: 'integer-array', argumentTypes: ['integer', 'operation-rows'], comparison: 'exact', stateful: LRU_STATEFUL },
  'NC250-182': { adapter: 'stateful', callable: 'FreqStack', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: FREQUENCY_STACK_STATEFUL },
  'NC250-179': { adapter: 'stateful', callable: 'StockSpanner', returnType: 'integer-array', argumentTypes: ['integer-array'], comparison: 'exact', stateful: STOCK_SPANNER_STATEFUL },
  'BLIND150-060': { adapter: 'stateful', callable: 'KthLargest', returnType: 'integer-array', argumentTypes: ['integer', 'integer-array', 'integer-array'], comparison: 'exact', stateful: KTH_LARGEST_STATEFUL },
  'BLIND150-066': { adapter: 'stateful', callable: 'MedianFinder', returnType: 'number-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: MEDIAN_FINDER_STATEFUL },
  'NC250-191': { adapter: 'stateful', callable: 'MyCircularQueue', returnType: 'integer-array', argumentTypes: ['integer', 'operation-rows'], comparison: 'exact', stateful: CIRCULAR_QUEUE_STATEFUL },
  'BLIND150-077': { adapter: 'stateful', callable: 'Trie', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: TRIE_STATEFUL },
  'BLIND150-078': { adapter: 'stateful', callable: 'WordDictionary', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: WORD_DICTIONARY_STATEFUL },
  'BLIND150-143': { adapter: 'stateful', callable: 'DetectSquares', returnType: 'integer-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: DETECT_SQUARES_STATEFUL },
  'BLIND150-032': { adapter: 'stateful', callable: 'TimeMap', returnType: 'string-array', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: TIME_MAP_STATEFUL },
  'BLIND150-065': { adapter: 'stateful', callable: 'Twitter', returnType: 'integer-matrix', argumentTypes: ['operation-rows'], comparison: 'exact', stateful: TWITTER_STATEFUL },
  'NC250-192': { adapter: 'stateful', callable: 'LFUCache', returnType: 'integer-array', argumentTypes: ['integer', 'operation-rows'], comparison: 'exact', stateful: LFU_CACHE_STATEFUL },
  'NC250-214': { adapter: 'plain-return', callable: 'islandPerimeter', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact', graph: { representation: 'grid', directed: false, weighted: false } },
  'NC250-216': { adapter: 'plain-return', callable: 'findJudge', returnType: 'integer', argumentTypes: ['integer', 'integer-matrix'], comparison: 'exact', graph: { representation: 'edge-list', directed: true, weighted: false } },
  'NC250-225': { adapter: 'plain-return', callable: 'canTraverseAllPairs', returnType: 'boolean', argumentTypes: ['integer-array'], comparison: 'exact', graph: { representation: 'implicit-factor-graph', directed: false, weighted: false } },
  'NC250-217': { adapter: 'plain-return', callable: 'openLock', returnType: 'integer', argumentTypes: ['string-array', 'string'], comparison: 'exact', graph: { representation: 'implicit-state-graph', directed: false, weighted: false } },
  'NC250-218': { adapter: 'plain-return', callable: 'checkIfPrerequisite', returnType: 'integer-array', argumentTypes: ['integer', 'integer-matrix', 'integer-matrix'], comparison: 'exact', graph: { representation: 'edge-list', directed: true, weighted: false } },
  'BLIND150-041': { adapter: 'plain-return', callable: 'findDuplicate', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'NC250-169': { adapter: 'semantic-collection', callable: 'fourSum', returnType: 'integer-matrix', argumentTypes: ['integer-array', 'integer'], comparison: 'quadruplet-set' },
  'NC250-221': { adapter: 'plain-return', callable: 'findMinHeightTrees', returnType: 'integer-array', argumentTypes: ['integer', 'integer-matrix'], comparison: 'unordered-unique', graph: { representation: 'edge-list', directed: false, weighted: false } },
  'NC250-222': { adapter: 'plain-return', callable: 'minimumEffortPath', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact', graph: { representation: 'grid', directed: false, weighted: true } },
  'BLIND150-086': { adapter: 'mutation', callable: 'solve', returnType: 'string-matrix', argumentTypes: ['string-matrix'], mutationTarget: 0, comparison: 'exact', graph: { representation: 'grid', directed: false, weighted: false } },
  'NC250-206': { adapter: 'plain-return', callable: 'subsetXORSum', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'NC250-219': { adapter: 'semantic-collection', callable: 'accountsMerge', returnType: 'string-matrix', argumentTypes: ['string-matrix'], comparison: 'account-set' },
  'NC250-220': { adapter: 'plain-return', callable: 'calcEquation', returnType: 'number-array', argumentTypes: ['string-matrix', 'number-array', 'string-matrix'], comparison: 'finite-ratios', graph: { representation: 'weighted-edge-list', directed: true, weighted: true } },
  'BLIND150-067': { adapter: 'semantic-collection', callable: 'subsets', returnType: 'integer-matrix', argumentTypes: ['integer-array'], comparison: 'unordered-nested' },
  'BLIND150-009': { adapter: 'plain-return', callable: 'longestConsecutive', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-027': { adapter: 'plain-return', callable: 'binarySearch', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-099': { adapter: 'plain-return', callable: 'climbStairs', returnType: 'integer', argumentTypes: ['integer'], comparison: 'exact' },
  'BLIND150-111': { adapter: 'plain-return', callable: 'uniquePaths', returnType: 'integer', argumentTypes: ['integer', 'integer'], comparison: 'exact' },
  'BLIND150-123': { adapter: 'plain-return', callable: 'canJump', returnType: 'boolean', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-007': { adapter: 'plain-return', callable: 'productExceptSelf', returnType: 'integer-array', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-013': { adapter: 'plain-return', callable: 'maxArea', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-014': { adapter: 'plain-return', callable: 'trap', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-020': { adapter: 'plain-return', callable: 'maxSlidingWindow', returnType: 'integer-array', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-024': { adapter: 'plain-return', callable: 'dailyTemperatures', returnType: 'integer-array', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-025': { adapter: 'plain-return', callable: 'carFleet', returnType: 'integer', argumentTypes: ['integer', 'integer-array', 'integer-array'], comparison: 'exact' },
  'BLIND150-026': { adapter: 'plain-return', callable: 'largestRectangleArea', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-029': { adapter: 'plain-return', callable: 'minEatingSpeed', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-030': { adapter: 'plain-return', callable: 'findMin', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-061': { adapter: 'plain-return', callable: 'lastStoneWeight', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-100': { adapter: 'plain-return', callable: 'minCostClimbingStairs', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-101': { adapter: 'plain-return', callable: 'rob', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-102': { adapter: 'plain-return', callable: 'robCircular', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-106': { adapter: 'plain-return', callable: 'coinChange', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-107': { adapter: 'plain-return', callable: 'maxProduct', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-109': { adapter: 'plain-return', callable: 'lengthOfLIS', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-110': { adapter: 'plain-return', callable: 'canPartition', returnType: 'boolean', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-122': { adapter: 'plain-return', callable: 'maxSubArray', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-124': { adapter: 'plain-return', callable: 'jump', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-140': { adapter: 'plain-return', callable: 'plusOne', returnType: 'integer-array', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-002': { adapter: 'plain-return', callable: 'isAnagram', returnType: 'boolean', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-010': { adapter: 'plain-return', callable: 'isPalindrome', returnType: 'boolean', argumentTypes: ['string'], comparison: 'exact' },
  'BLIND150-016': { adapter: 'plain-return', callable: 'lengthOfLongestSubstring', returnType: 'integer', argumentTypes: ['string'], comparison: 'exact' },
  'BLIND150-017': { adapter: 'plain-return', callable: 'characterReplacement', returnType: 'integer', argumentTypes: ['string', 'integer'], comparison: 'exact' },
  'BLIND150-018': { adapter: 'plain-return', callable: 'checkInclusion', returnType: 'boolean', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-019': { adapter: 'plain-return', callable: 'minWindow', returnType: 'string', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-021': { adapter: 'plain-return', callable: 'isValid', returnType: 'boolean', argumentTypes: ['string'], comparison: 'exact' },
  'BLIND150-064': { adapter: 'plain-return', callable: 'leastInterval', returnType: 'integer', argumentTypes: ['string', 'integer'], comparison: 'exact' },
  'BLIND150-104': { adapter: 'plain-return', callable: 'countSubstrings', returnType: 'integer', argumentTypes: ['string'], comparison: 'exact' },
  'BLIND150-112': { adapter: 'plain-return', callable: 'longestCommonSubsequence', returnType: 'integer', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-113': { adapter: 'plain-return', callable: 'maxProfitCooldown', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-114': { adapter: 'plain-return', callable: 'change', returnType: 'integer', argumentTypes: ['integer', 'integer-array'], comparison: 'exact' },
  'BLIND150-115': { adapter: 'plain-return', callable: 'findTargetSumWays', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-116': { adapter: 'plain-return', callable: 'isInterleave', returnType: 'boolean', argumentTypes: ['string', 'string', 'string'], comparison: 'exact' },
  'BLIND150-118': { adapter: 'plain-return', callable: 'numDistinct', returnType: 'integer', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-119': { adapter: 'plain-return', callable: 'minDistance', returnType: 'integer', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-120': { adapter: 'plain-return', callable: 'maxCoins', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-121': { adapter: 'plain-return', callable: 'isMatch', returnType: 'boolean', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-126': { adapter: 'plain-return', callable: 'isNStraightHand', returnType: 'boolean', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-128': { adapter: 'plain-return', callable: 'partitionLabels', returnType: 'integer-array', argumentTypes: ['string'], comparison: 'exact' },
  'BLIND150-129': { adapter: 'plain-return', callable: 'checkValidString', returnType: 'boolean', argumentTypes: ['string'], comparison: 'exact' },
  'BLIND150-144': { adapter: 'plain-return', callable: 'singleNumber', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-145': { adapter: 'plain-return', callable: 'hammingWeight', returnType: 'integer', argumentTypes: ['integer'], comparison: 'exact' },
  'BLIND150-146': { adapter: 'plain-return', callable: 'countBits', returnType: 'integer-array', argumentTypes: ['integer'], comparison: 'exact' },
  'BLIND150-147': { adapter: 'plain-return', callable: 'reverseBits', returnType: 'integer', argumentTypes: ['integer'], comparison: 'exact' },
  'BLIND150-148': { adapter: 'plain-return', callable: 'missingNumber', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-149': { adapter: 'plain-return', callable: 'getSum', returnType: 'integer', argumentTypes: ['integer', 'integer'], comparison: 'exact' },
  'BLIND150-008': { adapter: 'plain-return', callable: 'isValidSudoku', returnType: 'boolean', argumentTypes: ['string-matrix'], comparison: 'exact' },
  'BLIND150-023': { adapter: 'plain-return', callable: 'evalRPN', returnType: 'integer', argumentTypes: ['string-array'], comparison: 'exact' },
  'BLIND150-068': { adapter: 'plain-return', callable: 'combinationSum', returnType: 'integer-matrix', argumentTypes: ['integer-array', 'integer'], comparison: 'unordered-nested' },
  'BLIND150-071': { adapter: 'plain-return', callable: 'subsetsWithDup', returnType: 'integer-matrix', argumentTypes: ['integer-array'], comparison: 'unordered-nested' },
  'BLIND150-073': { adapter: 'plain-return', callable: 'exist', returnType: 'boolean', argumentTypes: ['string-matrix', 'string'], comparison: 'exact' },
  'BLIND150-080': { adapter: 'plain-return', callable: 'numIslands', returnType: 'integer', argumentTypes: ['string-matrix'], comparison: 'exact' },
  'BLIND150-081': { adapter: 'plain-return', callable: 'maxAreaOfIsland', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-084': { adapter: 'plain-return', callable: 'orangesRotting', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-090': { adapter: 'plain-return', callable: 'countComponents', returnType: 'integer', argumentTypes: ['integer', 'integer-matrix'], comparison: 'exact' },
  'BLIND150-091': { adapter: 'plain-return', callable: 'findRedundantConnection', returnType: 'integer-array', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-092': { adapter: 'plain-return', callable: 'ladderLength', returnType: 'integer', argumentTypes: ['string', 'string', 'string-array'], comparison: 'exact' },
  'BLIND150-093': { adapter: 'plain-return', callable: 'networkDelayTime', returnType: 'integer', argumentTypes: ['integer-matrix', 'integer', 'integer'], comparison: 'exact' },
  'BLIND150-095': { adapter: 'plain-return', callable: 'minCostConnectPoints', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-096': { adapter: 'plain-return', callable: 'swimInWater', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-098': { adapter: 'plain-return', callable: 'findCheapestPrice', returnType: 'integer', argumentTypes: ['integer', 'integer-matrix', 'integer', 'integer', 'integer'], comparison: 'exact' },
  'BLIND150-105': { adapter: 'plain-return', callable: 'numDecodings', returnType: 'integer', argumentTypes: ['string'], comparison: 'exact' },
  'BLIND150-108': { adapter: 'plain-return', callable: 'wordBreak', returnType: 'boolean', argumentTypes: ['string', 'string-array'], comparison: 'exact' },
  'BLIND150-117': { adapter: 'plain-return', callable: 'longestIncreasingPath', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-127': { adapter: 'plain-return', callable: 'mergeTriplets', returnType: 'boolean', argumentTypes: ['integer-matrix', 'integer-array'], comparison: 'exact' },
  'BLIND150-130': { adapter: 'plain-return', callable: 'insertInterval', returnType: 'integer-matrix', argumentTypes: ['integer-matrix', 'integer-array'], comparison: 'exact' },
  'BLIND150-132': { adapter: 'plain-return', callable: 'eraseOverlapIntervals', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-133': { adapter: 'plain-return', callable: 'canAttendMeetings', returnType: 'boolean', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-134': { adapter: 'plain-return', callable: 'minMeetingRooms', returnType: 'integer', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-135': { adapter: 'plain-return', callable: 'minInterval', returnType: 'integer-array', argumentTypes: ['integer-matrix', 'integer-array'], comparison: 'exact' },
  'BLIND150-137': { adapter: 'plain-return', callable: 'spiralOrder', returnType: 'integer-array', argumentTypes: ['integer-matrix'], comparison: 'exact' },
  'BLIND150-139': { adapter: 'plain-return', callable: 'isHappy', returnType: 'boolean', argumentTypes: ['integer'], comparison: 'exact' },
  'BLIND150-142': { adapter: 'plain-return', callable: 'multiplyStrings', returnType: 'string', argumentTypes: ['string', 'string'], comparison: 'exact' },
  'BLIND150-150': { adapter: 'plain-return', callable: 'reverseInteger', returnType: 'integer', argumentTypes: ['integer'], comparison: 'exact' },
  'BLIND150-004': { adapter: 'plain-return', callable: 'groupAnagrams', returnType: 'string-matrix', argumentTypes: ['string-array'], comparison: 'anagrams' },
  'BLIND150-005': { adapter: 'plain-return', callable: 'topKFrequent', returnType: 'integer-array', argumentTypes: ['integer-array', 'integer'], comparison: 'top-k' },
  'BLIND150-012': { adapter: 'plain-return', callable: 'threeSum', returnType: 'integer-matrix', argumentTypes: ['integer-array'], comparison: 'triplets' },
  'BLIND150-062': { adapter: 'plain-return', callable: 'kClosest', returnType: 'integer-matrix', argumentTypes: ['integer-matrix', 'integer'], comparison: 'closest-points' },
  'BLIND150-070': { adapter: 'plain-return', callable: 'permute', returnType: 'integer-matrix', argumentTypes: ['integer-array'], comparison: 'ordered-int-rows' },
  'BLIND150-072': { adapter: 'plain-return', callable: 'generateParenthesis', returnType: 'string-array', argumentTypes: ['integer'], comparison: 'unordered-strings' },
  'BLIND150-074': { adapter: 'plain-return', callable: 'partition', returnType: 'string-matrix', argumentTypes: ['string'], comparison: 'ordered-string-rows' },
  'BLIND150-075': { adapter: 'plain-return', callable: 'letterCombinations', returnType: 'string-array', argumentTypes: ['string'], comparison: 'unordered-strings' },
  'BLIND150-076': { adapter: 'plain-return', callable: 'solveNQueens', returnType: 'string-matrix', argumentTypes: ['integer'], comparison: 'ordered-string-rows' },
  'BLIND150-079': { adapter: 'plain-return', callable: 'findWords', returnType: 'string-array', argumentTypes: ['string-matrix', 'string-array'], comparison: 'unordered-strings' },
  'BLIND150-085': { adapter: 'plain-return', callable: 'pacificAtlantic', returnType: 'integer-matrix', argumentTypes: ['integer-matrix'], comparison: 'coordinate-set' },
  'BLIND150-103': { adapter: 'plain-return', callable: 'longestPalindrome', returnType: 'string', argumentTypes: ['string'], comparison: 'longest-palindrome' },
  'BLIND150-131': { adapter: 'plain-return', callable: 'mergeIntervals', returnType: 'integer-matrix', argumentTypes: ['integer-matrix'], comparison: 'interval-set' },
  'BLIND150-141': { adapter: 'plain-return', callable: 'myPow', returnType: 'number', argumentTypes: ['number', 'integer'], comparison: 'float-close' },
  'BLIND150-011': { adapter: 'plain-return', callable: 'twoSumSorted', returnType: 'integer-array', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-015': { adapter: 'plain-return', callable: 'maxProfit', returnType: 'integer', argumentTypes: ['integer-array'], comparison: 'exact' },
  'BLIND150-028': { adapter: 'plain-return', callable: 'searchMatrix', returnType: 'boolean', argumentTypes: ['integer-matrix', 'integer'], comparison: 'exact' },
  'BLIND150-031': { adapter: 'plain-return', callable: 'searchRotated', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-033': { adapter: 'plain-return', callable: 'findMedianSortedArrays', returnType: 'number', argumentTypes: ['integer-array', 'integer-array'], comparison: 'float-close' },
  'BLIND150-063': { adapter: 'plain-return', callable: 'findKthLargest', returnType: 'integer', argumentTypes: ['integer-array', 'integer'], comparison: 'exact' },
  'BLIND150-069': { adapter: 'plain-return', callable: 'combinationSum2', returnType: 'integer-matrix', argumentTypes: ['integer-array', 'integer'], comparison: 'combination-set' },
  'BLIND150-083': { adapter: 'mutation', callable: 'wallsAndGates', returnType: 'integer-matrix', argumentTypes: ['integer-matrix'], mutationTarget: 0, comparison: 'exact' },
  'BLIND150-087': { adapter: 'plain-return', callable: 'canFinish', returnType: 'boolean', argumentTypes: ['integer', 'integer-matrix'], comparison: 'exact' },
  'BLIND150-088': { adapter: 'plain-return', callable: 'findOrder', returnType: 'integer-array', argumentTypes: ['integer', 'integer-matrix'], comparison: 'course-order' },
  'BLIND150-089': { adapter: 'plain-return', callable: 'validTree', returnType: 'boolean', argumentTypes: ['integer', 'integer-matrix'], comparison: 'exact' },
  'BLIND150-094': { adapter: 'plain-return', callable: 'findItinerary', returnType: 'string-array', argumentTypes: ['string-matrix'], comparison: 'exact' },
  'BLIND150-097': { adapter: 'plain-return', callable: 'foreignDictionary', returnType: 'string', argumentTypes: ['string-array'], comparison: 'alien-order' },
  'BLIND150-125': { adapter: 'plain-return', callable: 'canCompleteCircuit', returnType: 'integer', argumentTypes: ['integer-array', 'integer-array'], comparison: 'exact' },
  'BLIND150-136': { adapter: 'mutation', callable: 'rotate', returnType: 'integer-matrix', argumentTypes: ['integer-matrix'], mutationTarget: 0, comparison: 'exact' },
});

// Linked-list contracts passed the complete 10 x 9 x 3 browser matrix before
// being merged into the centralized activation registry below.
const LINKED_LIST_CANDIDATE_DEFINITIONS = Object.freeze({
  'BLIND150-035': { adapter: 'linked-list', callable: 'mergeTwoLists', returnType: 'integer-array', argumentTypes: ['linked-list', 'linked-list'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'reuse-input-nodes' },
  'BLIND150-036': { adapter: 'linked-list', callable: 'hasCycle', returnType: 'boolean', argumentTypes: ['cyclic-linked-list', 'cycle-position'], callableArgumentIndexes: [0], comparison: 'exact', resultSource: { kind: 'return-value' }, identityPolicy: 'structure-only' },
  'BLIND150-037': { adapter: 'linked-list', callable: 'reorderList', returnType: 'integer-array', argumentTypes: ['linked-list'], comparison: 'exact', resultSource: { kind: 'mutated-argument', argumentIndex: 0 }, identityPolicy: 'reuse-input-nodes' },
  'BLIND150-038': { adapter: 'linked-list', callable: 'removeNthFromEnd', returnType: 'integer-array', argumentTypes: ['linked-list', 'integer'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'reuse-input-nodes' },
  'BLIND150-039': { adapter: 'linked-list', callable: 'copyRandomList', returnType: 'random-linked-list', argumentTypes: ['random-linked-list'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'no-original-node-reuse', includeRandom: true },
  'BLIND150-040': { adapter: 'linked-list', callable: 'addTwoNumbers', returnType: 'integer-array', argumentTypes: ['linked-list', 'linked-list'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'allocate-new-list' },
  'BLIND150-043': { adapter: 'linked-list', callable: 'mergeKLists', returnType: 'integer-array', argumentTypes: ['linked-list-array'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'reuse-input-nodes' },
  'BLIND150-044': { adapter: 'linked-list', callable: 'reverseKGroup', returnType: 'integer-array', argumentTypes: ['linked-list', 'integer'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'reuse-input-nodes' },
  'NC250-190': { adapter: 'linked-list', callable: 'reverseBetween', returnType: 'integer-array', argumentTypes: ['linked-list', 'integer', 'integer'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'reuse-input-nodes' },
  'NC250-245': { adapter: 'linked-list', callable: 'insertGreatestCommonDivisors', returnType: 'integer-array', argumentTypes: ['linked-list'], comparison: 'exact', resultSource: { kind: 'returned-list' }, identityPolicy: 'allow-mixed-reuse' },
});

const STATEFUL_CANDIDATE_DEFINITIONS = Object.freeze({});

// Structural contracts deliberately remain separate from the activated registry
// until each target has passed its complete nine-runtime browser matrix.  The
// adapter describes fixture-to-node conversion only; it never embeds a
// question-specific serializer or implementation branch.
const TREE_CANDIDATE_DEFINITIONS = Object.freeze({
  'BLIND150-046': { adapter: 'tree', callable: 'maxDepth', returnType: 'integer', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'BLIND150-047': { adapter: 'tree', callable: 'diameterOfBinaryTree', returnType: 'integer', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'BLIND150-048': { adapter: 'tree', callable: 'isBalanced', returnType: 'boolean', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'BLIND150-049': { adapter: 'tree', callable: 'isSameTree', returnType: 'boolean', argumentTypes: ['binary-tree', 'binary-tree'], comparison: 'exact' },
  'BLIND150-050': { adapter: 'tree', callable: 'isSubtree', returnType: 'boolean', argumentTypes: ['binary-tree', 'binary-tree'], comparison: 'exact' },
  // The harness verifies that the returned node is one of the original fixture
  // nodes, then serializes its value.  The normal exact comparator can therefore
  // compare the portable scalar representation without weakening identity checks.
  'BLIND150-051': { adapter: 'tree', callable: 'lowestCommonAncestor', returnType: 'returned-node', argumentTypes: ['bst', 'tree-node-reference', 'tree-node-reference'], callableArgumentIndexes: [0, 1, 2], nodeReferenceArguments: { 1: { rootArgumentIndex: 0, selector: 'value', requireUnique: true }, 2: { rootArgumentIndex: 0, selector: 'value', requireUnique: true } }, comparison: 'exact', identityPolicy: 'returned-existing-node' },
  'BLIND150-052': { adapter: 'tree', callable: 'levelOrder', returnType: 'integer-matrix', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'BLIND150-053': { adapter: 'tree', callable: 'rightSideView', returnType: 'integer-array', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'BLIND150-054': { adapter: 'tree', callable: 'goodNodes', returnType: 'integer', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'BLIND150-055': { adapter: 'tree', callable: 'isValidBST', returnType: 'boolean', argumentTypes: ['bst'], comparison: 'exact' },
  'BLIND150-056': { adapter: 'tree', callable: 'kthSmallest', returnType: 'integer', argumentTypes: ['bst', 'integer'], comparison: 'exact' },
  'BLIND150-057': { adapter: 'tree', callable: 'buildTreeFromTraversals', returnType: 'level-order-tree', argumentTypes: ['integer-array', 'integer-array'], comparison: 'exact', identityPolicy: 'allocate-new-structure' },
  'BLIND150-058': { adapter: 'tree', callable: 'maxPathSum', returnType: 'integer', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'BLIND150-059': { adapter: 'tree', callable: 'serializeTree', returnType: 'level-order-tree', argumentTypes: ['binary-tree'], comparison: 'exact', resultSource: { kind: 'codec-round-trip', encode: 'serializeTree', decode: 'deserializeTree' }, identityPolicy: 'structure-only' },
  'NC250-193': { adapter: 'tree', callable: 'inorderTraversal', returnType: 'integer-array', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'NC250-194': { adapter: 'tree', callable: 'preorderTraversal', returnType: 'integer-array', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'NC250-195': { adapter: 'tree', callable: 'postorderTraversal', returnType: 'integer-array', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'NC250-196': { adapter: 'tree', callable: 'insertIntoBST', returnType: 'level-order-tree', argumentTypes: ['bst', 'integer'], comparison: 'bst-values', resultSource: { kind: 'returned-tree' }, identityPolicy: 'mixed-reuse' },
  'NC250-197': { adapter: 'tree', callable: 'deleteNode', returnType: 'level-order-tree', argumentTypes: ['bst', 'integer'], comparison: 'bst-values', resultSource: { kind: 'returned-tree' }, identityPolicy: 'mixed-reuse' },
  'NC250-199': { adapter: 'tree', callable: 'robTree', returnType: 'integer', argumentTypes: ['binary-tree'], comparison: 'exact' },
  'NC250-200': { adapter: 'tree', callable: 'removeLeafNodes', returnType: 'level-order-tree', argumentTypes: ['binary-tree', 'integer'], comparison: 'exact', resultSource: { kind: 'returned-tree' }, identityPolicy: 'mixed-reuse' },
  'NC250-198': { adapter: 'quad-tree', callable: 'construct', returnType: 'quad-tree', argumentTypes: ['integer-matrix'], comparison: 'quad-tree', identityPolicy: 'structure-only' },
});

const MUTATION_CANDIDATE_DEFINITIONS = Object.freeze({
  'NC250-158': { adapter: 'mutation', callable: 'sortColors', returnType: 'integer-array', argumentTypes: ['integer-array'], mutationTarget: 0, comparison: 'exact' },
  // These two audit records were grouped with mutation targets by their broad
  // execution shape, but their imported contracts are ordinary returned-value
  // functions. Keep that distinction explicit rather than inventing mutation
  // evidence that the questions do not require.
  'NC250-208': { adapter: 'semantic-collection', callable: 'permuteUnique', returnType: 'integer-matrix', argumentTypes: ['integer-array'], comparison: 'permutation-set', resultSource: { kind: 'return-value' } },
  'NC250-215': { adapter: 'plain-return', callable: 'isAlienSorted', returnType: 'boolean', argumentTypes: ['string-array', 'string'], comparison: 'exact', resultSource: { kind: 'return-value' } },
});

// BLIND150-046 completed the real 9 x 3 browser matrix.  Keep each later
// structural promotion equally explicit so the active registry is auditable.
const ACTIVATED_STRUCTURAL_DEFINITIONS = Object.freeze({
  'BLIND150-046': TREE_CANDIDATE_DEFINITIONS['BLIND150-046'],
  'BLIND150-047': TREE_CANDIDATE_DEFINITIONS['BLIND150-047'],
  'BLIND150-048': TREE_CANDIDATE_DEFINITIONS['BLIND150-048'],
  'BLIND150-049': TREE_CANDIDATE_DEFINITIONS['BLIND150-049'],
  'BLIND150-050': TREE_CANDIDATE_DEFINITIONS['BLIND150-050'],
  'BLIND150-051': TREE_CANDIDATE_DEFINITIONS['BLIND150-051'],
  'BLIND150-052': TREE_CANDIDATE_DEFINITIONS['BLIND150-052'],
  'BLIND150-053': TREE_CANDIDATE_DEFINITIONS['BLIND150-053'],
  'BLIND150-054': TREE_CANDIDATE_DEFINITIONS['BLIND150-054'],
  'BLIND150-055': TREE_CANDIDATE_DEFINITIONS['BLIND150-055'],
  'BLIND150-056': TREE_CANDIDATE_DEFINITIONS['BLIND150-056'],
  'BLIND150-058': TREE_CANDIDATE_DEFINITIONS['BLIND150-058'],
  'BLIND150-057': TREE_CANDIDATE_DEFINITIONS['BLIND150-057'],
  'BLIND150-059': TREE_CANDIDATE_DEFINITIONS['BLIND150-059'],
  'NC250-193': TREE_CANDIDATE_DEFINITIONS['NC250-193'],
  'NC250-194': TREE_CANDIDATE_DEFINITIONS['NC250-194'],
  'NC250-195': TREE_CANDIDATE_DEFINITIONS['NC250-195'],
  'NC250-199': TREE_CANDIDATE_DEFINITIONS['NC250-199'],
  'NC250-200': TREE_CANDIDATE_DEFINITIONS['NC250-200'],
  'NC250-198': TREE_CANDIDATE_DEFINITIONS['NC250-198'],
  'NC250-196': TREE_CANDIDATE_DEFINITIONS['NC250-196'],
  'NC250-197': TREE_CANDIDATE_DEFINITIONS['NC250-197'],
  'NC250-158': MUTATION_CANDIDATE_DEFINITIONS['NC250-158'],
  'NC250-208': MUTATION_CANDIDATE_DEFINITIONS['NC250-208'],
  'NC250-215': MUTATION_CANDIDATE_DEFINITIONS['NC250-215'],
});

const DEFINITIONS = Object.freeze({ ...BASE_DEFINITIONS, ...LINKED_LIST_CANDIDATE_DEFINITIONS, ...ACTIVATED_STRUCTURAL_DEFINITIONS });

export const ACTIVATED_FUNCTION_QUESTION_IDS = Object.freeze(Object.keys(DEFINITIONS));

function resolveContract(question, includeCandidates) {
  const definition = DEFINITIONS[question?.id] ?? (includeCandidates ? (STATEFUL_CANDIDATE_DEFINITIONS[question?.id] ?? LINKED_LIST_CANDIDATE_DEFINITIONS[question?.id] ?? TREE_CANDIDATE_DEFINITIONS[question?.id] ?? MUTATION_CANDIDATE_DEFINITIONS[question?.id]) : null);
  if (!definition) return null;
  return Object.freeze({
    version: FUNCTION_EXECUTION_CONTRACT_VERSION,
    questionId: question.id,
    executionMode: 'function',
    adapter: definition.adapter,
    callable: Object.freeze({ name: definition.callable, className: definition.stateful?.className ?? 'Solution' }),
    arguments: Object.freeze(definition.argumentTypes.map((type, index) => Object.freeze({ index, type }))),
    callableArgumentIndexes: Object.freeze(definition.callableArgumentIndexes ?? definition.argumentTypes.map((_, index) => index)),
    nodeReferenceArguments: Object.freeze(definition.nodeReferenceArguments ?? {}),
    returns: Object.freeze({ type: definition.returnType }),
    mutation: Object.freeze({ target: definition.mutationTarget ?? null }),
    resultSource: Object.freeze(definition.resultSource ?? { kind: definition.mutationTarget == null ? 'return-value' : 'mutated-argument', argumentIndex: definition.mutationTarget }),
    identityPolicy: definition.identityPolicy ?? 'structure-only',
    includeRandom: definition.includeRandom === true,
    stateful: definition.stateful ?? null,
    serialization: Object.freeze({ format: 'json', bounded: ['linked-list', 'tree', 'graph'].includes(definition.adapter) }),
    validation: Object.freeze({ type: definition.comparison, requireDistinctRoot: definition.requireDistinctRoot === true }),
    fixtures: Object.freeze(question.publicTests ?? []),
  });
}

export function resolvePracticeExecutionContract(question) {
  return resolveContract(question, false);
}

export function resolveLinkedListCandidateExecutionContract(question) {
  return resolveContract(question, true);
}

// Kept as a named compatibility boundary while linked-list rollout scripts
// continue importing their original resolver.  Structural candidates use the
// same declarative contract shape and are intentionally not yet activated.
export function resolveStructuralCandidateExecutionContract(question) {
  return resolveContract(question, true);
}

export function assertFunctionExecutionContract(contract) {
  if (contract?.version !== FUNCTION_EXECUTION_CONTRACT_VERSION || contract.executionMode !== 'function') throw new Error('Unsupported Practice function execution contract.');
  if (!contract.callable?.name || !Array.isArray(contract.fixtures) || !contract.adapter) throw new Error('Invalid Practice function execution contract.');
  return contract;
}

export const CONTAINS_DUPLICATE_CONTRACT = Object.freeze({
  version: FUNCTION_EXECUTION_CONTRACT_VERSION, questionId: 'BLIND150-001', executionMode: 'function', adapter: 'plain-return',
  callable: Object.freeze({ name: 'containsDuplicate', className: 'Solution' }), arguments: Object.freeze([{ index: 0, type: 'integer-array' }]),
  returns: Object.freeze({ type: 'boolean' }), mutation: Object.freeze({ target: null }), serialization: Object.freeze({ format: 'json', bounded: false }), validation: Object.freeze({ type: 'exact', requireDistinctRoot: false }),
});
