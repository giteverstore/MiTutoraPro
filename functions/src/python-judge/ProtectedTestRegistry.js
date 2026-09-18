import { PYTHON_JUDGE_LIMITS } from './JudgePolicy.js';

const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^v[1-9][0-9]*$/;

function freezeTest(test) {
  const encoded = JSON.stringify({ arguments: test?.arguments });
  if (!Array.isArray(test?.arguments) || !Object.hasOwn(test ?? {}, 'expected')
    || Buffer.byteLength(encoded, 'utf8') > PYTHON_JUDGE_LIMITS.maxTestInputBytes) {
    throw new TypeError('Protected test is invalid or oversized.');
  }
  return Object.freeze({ arguments: structuredClone(test.arguments), expected: structuredClone(test.expected) });
}

export class ProtectedTestRegistry {
  #suites = new Map();

  register(definition) {
    if (!definition || typeof definition !== 'object' || typeof definition.suiteId !== 'string'
      || !VERSION.test(definition.suiteVersion ?? '') || !VERSION.test(definition.activityVersion ?? '')
      || !HASH.test(definition.contentHash ?? '') || definition.language !== 'python'
      || typeof definition.entryPoint !== 'string' || !Array.isArray(definition.tests) || definition.tests.length === 0) {
      throw new TypeError('Protected suite binding is invalid.');
    }
    const key = `${definition.activityId}\0${definition.activityVersion}`;
    if (this.#suites.has(key)) throw new TypeError('Protected suite binding is duplicated.');
    this.#suites.set(key, Object.freeze({
      suiteId: definition.suiteId,
      suiteVersion: definition.suiteVersion,
      activityId: definition.activityId,
      activityVersion: definition.activityVersion,
      contentHash: definition.contentHash,
      language: definition.language,
      entryPoint: definition.entryPoint,
      tests: Object.freeze(definition.tests.map(freezeTest)),
    }));
    return this;
  }

  resolve(binding) {
    const suite = this.#suites.get(`${binding.activityId}\0${binding.activityVersion}`);
    if (!suite || suite.suiteId !== binding.protectedSuiteId || suite.suiteVersion !== binding.protectedSuiteVersion
      || suite.contentHash !== binding.contentHash || suite.language !== binding.language) {
      throw Object.assign(new Error('Protected suite binding failed.'), { code: 'judge/protected-suite-mismatch' });
    }
    return suite;
  }
}
