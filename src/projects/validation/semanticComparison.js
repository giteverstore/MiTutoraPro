export const DEFAULT_NUMERIC_TOLERANCE = Object.freeze({ relative: 1e-9, absolute: 1e-9 });

function numbersAreEquivalent(actual, expected, tolerance) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return Object.is(actual, expected);
  const difference = Math.abs(actual - expected);
  const relativeLimit = tolerance.relative * Math.max(Math.abs(actual), Math.abs(expected));
  return difference <= Math.max(tolerance.absolute, relativeLimit);
}

export function semanticValuesEqual(actual, expected, configuredTolerance = {}) {
  const tolerance = { ...DEFAULT_NUMERIC_TOLERANCE, ...configuredTolerance };

  if (typeof actual === 'boolean' || typeof expected === 'boolean') {
    return typeof actual === 'boolean' && typeof expected === 'boolean' && actual === expected;
  }
  if (typeof actual === 'number' || typeof expected === 'number') {
    return typeof actual === 'number' && typeof expected === 'number'
      && numbersAreEquivalent(actual, expected, tolerance);
  }
  if (actual === null || expected === null) return actual === null && expected === null;
  if (typeof actual === 'string' || typeof expected === 'string') {
    return typeof actual === 'string' && typeof expected === 'string' && actual === expected;
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected)
      && actual.length === expected.length
      && actual.every((value, index) => semanticValuesEqual(value, expected[index], tolerance));
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    return semanticValuesEqual(actualKeys, expectedKeys, tolerance)
      && actualKeys.every((key) => semanticValuesEqual(actual[key], expected[key], tolerance));
  }
  return typeof actual === typeof expected && Object.is(actual, expected);
}
