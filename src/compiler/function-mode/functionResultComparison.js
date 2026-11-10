const stable = (value) => JSON.stringify(value);
const compareStable = (a, b) => stable(a).localeCompare(stable(b));
const canonicalNumberRow = (row) => Array.isArray(row) && row.every(Number.isFinite) ? [...row].sort((a, b) => a - b) : null;
const canonicalRows = (rows, normalizeRow = (row) => row) => rows.map(normalizeRow).sort(compareStable);
const equalCanonicalRows = (actual, expected, normalizeRow) => Array.isArray(actual)
  && actual.every(Array.isArray)
  && stable(canonicalRows(actual, normalizeRow)) === stable(canonicalRows(expected ?? [], normalizeRow));
const unique = (values) => new Set(values.map(stable)).size === values.length;

function compareTopK(actual, fixture) {
  const [nums, k] = fixture.arguments;
  if (!Array.isArray(actual) || actual.length !== k || !actual.every(Number.isInteger) || !unique(actual)) return false;
  const frequencies = new Map();
  for (const value of nums) frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  if (!actual.every((value) => frequencies.has(value))) return false;
  const chosen = new Set(actual);
  const lowestChosen = Math.min(...actual.map((value) => frequencies.get(value)));
  return [...frequencies].every(([value, count]) => chosen.has(value) || count <= lowestChosen);
}

function compareClosestPoints(actual, fixture) {
  const [points, k] = fixture.arguments;
  if (!Array.isArray(actual) || actual.length !== k || !actual.every((row) => Array.isArray(row) && row.length === 2 && row.every(Number.isFinite))) return false;
  const available = new Map();
  for (const point of points) available.set(stable(point), (available.get(stable(point)) ?? 0) + 1);
  for (const point of actual) {
    const key = stable(point);
    if (!available.get(key)) return false;
    available.set(key, available.get(key) - 1);
  }
  const distance = ([x, y]) => x * x + y * y;
  const cutoff = [...points].map(distance).sort((a, b) => a - b)[k - 1];
  return actual.every((point) => distance(point) <= cutoff);
}

function compareLongestPalindrome(actual, expected, fixture) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const input = fixture.arguments[0];
  return input.includes(actual) && actual === [...actual].reverse().join('') && actual.length === expected.length;
}

function compareAccounts(actual, expected) {
  const normalize = (row) => Array.isArray(row) && row.length > 0 && row.every((value) => typeof value === 'string') ? [row[0], ...row.slice(1).sort()] : null;
  return Array.isArray(actual) && actual.every((row) => normalize(row) !== null)
    && stable(canonicalRows(actual, normalize)) === stable(canonicalRows(expected ?? [], normalize));
}

function compareCourseOrder(actual, expected, fixture) {
  if (!Array.isArray(actual) || !actual.every(Number.isInteger)) return false;
  if ((expected ?? []).length === 0) return actual.length === 0;
  const [count, prerequisites] = fixture.arguments;
  if (actual.length !== count || !unique(actual) || actual.some((value) => value < 0 || value >= count)) return false;
  const position = new Map(actual.map((value, index) => [value, index]));
  return prerequisites.every(([course, prerequisite]) => position.get(prerequisite) < position.get(course));
}

function compareAlienOrder(actual, expected, fixture) {
  if (typeof actual !== 'string') return false;
  if (expected === '') return actual === '';
  const words = fixture.arguments[0];
  const characters = [...new Set(words.join(''))];
  if (actual.length !== characters.length || !unique([...actual]) || characters.some((value) => !actual.includes(value))) return false;
  const position = new Map([...actual].map((value, index) => [value, index]));
  for (let index = 1; index < words.length; index += 1) {
    const before = words[index - 1];
    const after = words[index];
    let at = 0;
    while (at < before.length && at < after.length && before[at] === after[at]) at += 1;
    if (at === after.length && before.length > after.length) return false;
    if (at < before.length && at < after.length && position.get(before[at]) >= position.get(after[at])) return false;
  }
  return true;
}

function compareBstValues(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  if (actual.length === 0) return expected.length === 0;
  if (!Number.isInteger(actual[0])) return false;
  const root = { value: actual[0], left: null, right: null };
  const queue = [root];
  let cursor = 1;
  while (queue.length && cursor < actual.length) {
    const node = queue.shift();
    for (const side of ['left', 'right']) {
      if (cursor >= actual.length) break;
      const value = actual[cursor++];
      if (value != null) {
        if (!Number.isInteger(value)) return false;
        node[side] = { value, left: null, right: null };
        queue.push(node[side]);
      }
    }
  }
  if (cursor !== actual.length) return false;
  const values = [];
  const visit = (node, lower, upper) => {
    if (!node) return true;
    if (node.value <= lower || node.value >= upper) return false;
    values.push(node.value);
    return visit(node.left, lower, node.value) && visit(node.right, node.value, upper);
  };
  if (!visit(root, -Infinity, Infinity)) return false;
  const expectedValues = expected.filter((value) => value != null).sort((a, b) => a - b);
  return stable(values.sort((a, b) => a - b)) === stable(expectedValues);
}

function compareQuadTree(actual, expected) {
  const normalize = (records) => {
    if (!Array.isArray(records)) return null;
    const result = [];
    for (const record of records) {
      if (!Array.isArray(record) || record.length !== 3) return null;
      const [path, leaf, value] = record;
      if (!Number.isInteger(path) || (leaf !== 0 && leaf !== 1) || (value !== 0 && value !== 1)) return null;
      result.push(leaf ? [path, 1, value] : [path, 0, 0]);
    }
    return result.sort((a, b) => a[0] - b[0]);
  };
  const left = normalize(actual);
  const right = normalize(expected);
  return left !== null && right !== null && stable(left) === stable(right);
}

function compareReorganized(actual, expected, fixture) {
  if (typeof actual !== 'string') return false;
  if (expected === '') return actual === '';
  const input = fixture.arguments[0];
  return actual.length === input.length
    && [...actual].every((value, index) => index === 0 || value !== actual[index - 1])
    && stable([...actual].sort()) === stable([...input].sort());
}

function compareHappy(actual, expected, fixture) {
  if (typeof actual !== 'string' || actual.length !== expected.length || /aaa|bbb|ccc/.test(actual)) return false;
  const limits = { a: fixture.arguments[0], b: fixture.arguments[1], c: fixture.arguments[2] };
  const used = { a: 0, b: 0, c: 0 };
  for (const value of actual) {
    if (!(value in used) || ++used[value] > limits[value]) return false;
  }
  return true;
}

function compareConditionMatrix(actual, expected, fixture) {
  if ((expected ?? []).length === 0) return Array.isArray(actual) && actual.length === 0;
  const [k, rowConditions, columnConditions] = fixture.arguments;
  if (!Array.isArray(actual) || actual.length !== k || !actual.every((row) => Array.isArray(row) && row.length === k && row.every(Number.isInteger))) return false;
  const positions = new Map();
  for (let row = 0; row < k; row += 1) for (let column = 0; column < k; column += 1) {
    const value = actual[row][column];
    if (value === 0) continue;
    if (value < 1 || value > k || positions.has(value)) return false;
    positions.set(value, [row, column]);
  }
  if (positions.size !== k) return false;
  return rowConditions.every(([before, after]) => positions.get(before)[0] < positions.get(after)[0])
    && columnConditions.every(([before, after]) => positions.get(before)[1] < positions.get(after)[1]);
}

export function compareFunctionResult({ policy, actual, expected, fixture }) {
  if (policy === 'two-sum') {
    if (!Array.isArray(actual) || actual.length !== 2 || !actual.every(Number.isInteger) || actual[0] === actual[1]) return false;
    const nums = fixture.arguments[0];
    return actual.every((index) => index >= 0 && index < nums.length) && nums[actual[0]] + nums[actual[1]] === fixture.arguments[1];
  }
  if (policy === 'unordered-nested' || policy === 'triplets' || policy === 'combination-set') return equalCanonicalRows(actual, expected, canonicalNumberRow);
  if (policy === 'quadruplet-set') return Array.isArray(actual)
    && actual.every((row) => Array.isArray(row) && row.length === 4 && row.every(Number.isInteger))
    && unique(actual.map(canonicalNumberRow))
    && equalCanonicalRows(actual, expected, canonicalNumberRow);
  if (policy === 'ordered-int-rows' || policy === 'coordinate-set' || policy === 'interval-set') return equalCanonicalRows(actual, expected, (row) => row);
  if (policy === 'permutation-set') return Array.isArray(actual) && unique(actual) && equalCanonicalRows(actual, expected, (row) => row);
  if (policy === 'ordered-string-rows') return equalCanonicalRows(actual, expected, (row) => row);
  if (policy === 'anagrams') return equalCanonicalRows(actual, expected, (row) => Array.isArray(row) && row.every((value) => typeof value === 'string') ? [...row].sort() : null);
  if (policy === 'unordered-strings') return Array.isArray(actual) && actual.every((value) => typeof value === 'string') && stable([...actual].sort()) === stable([...(expected ?? [])].sort());
  if (policy === 'unordered-unique') return Array.isArray(actual) && actual.every(Number.isInteger) && unique(actual) && stable([...actual].sort((a, b) => a - b)) === stable([...(expected ?? [])].sort((a, b) => a - b));
  if (policy === 'top-k') return compareTopK(actual, fixture);
  if (policy === 'closest-points') return compareClosestPoints(actual, fixture);
  if (policy === 'longest-palindrome') return compareLongestPalindrome(actual, expected, fixture);
  if (policy === 'float-close') {
    if (typeof actual !== 'number' || typeof expected !== 'number' || !Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    return Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected));
  }
  if (policy === 'finite-ratios') {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return false;
    return actual.every((value, index) => Number.isFinite(value)
      && Number.isFinite(expected[index])
      && Math.abs(value - expected[index]) <= Math.max(1e-9, 1e-7 * Math.abs(expected[index])));
  }
  if (policy === 'account-set') return compareAccounts(actual, expected);
  if (policy === 'course-order') return compareCourseOrder(actual, expected, fixture);
  if (policy === 'alien-order') return compareAlienOrder(actual, expected, fixture);
  if (policy === 'edge-groups') return Array.isArray(actual) && actual.length === 2 && actual.every((row) => Array.isArray(row) && row.every(Number.isInteger) && unique(row))
    && stable(actual.map((row) => [...row].sort((a, b) => a - b))) === stable((expected ?? []).map((row) => [...row].sort((a, b) => a - b)));
  if (policy === 'graph-adjacency') {
    const normalize = (graph) => graph.map((neighbors) => [...neighbors].sort((a, b) => a - b));
    return Array.isArray(actual) && actual.every(Array.isArray) && stable(normalize(actual)) === stable(normalize(expected));
  }
  if (policy === 'bst-values') return compareBstValues(actual, expected);
  if (policy === 'quad-tree') return compareQuadTree(actual, expected);
  if (policy === 'reorganized') return compareReorganized(actual, expected, fixture);
  if (policy === 'happy') return compareHappy(actual, expected, fixture);
  if (policy === 'condition-matrix') return compareConditionMatrix(actual, expected, fixture);
  return stable(actual) === stable(expected);
}
