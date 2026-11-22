function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function practiceContractFingerprints(practice) {
  const contract = {
    contentId: practice.identity.contentId,
    publicationVersion: practice.identity.publicationVersion,
    execution: practice.execution,
    languages: practice.languages,
  };
  const tests = practice.publicTests.map(({ id, comparison, arguments: args, stdin, expectedResult, expectedOutput }) => ({ id, comparison, arguments: args, stdin, expectedResult, expectedOutput }));
  return { executionContractFingerprint: await sha256(canonical(contract)), publicTestSetFingerprint: await sha256(canonical(tests)) };
}

export async function createPracticeExecutionAssertion({ practice, languageId, result, requestId = globalThis.crypto.randomUUID() }) {
  const fingerprints = await practiceContractFingerprints(practice);
  return Object.freeze({
    contentId: practice.identity.contentId,
    publicationVersion: practice.identity.publicationVersion,
    languageId,
    executionMode: practice.execution.mode,
    ...fingerprints,
    testIds: result.tests.map(({ id }) => id),
    outcome: { total: result.tests.length, passed: result.tests.filter(({ status }) => status === 'passed').length, errors: result.tests.filter(({ status }) => status === 'error').length },
    requestId,
  });
}
