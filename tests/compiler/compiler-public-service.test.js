import { describe, expect, it, vi } from 'vitest';
import { CompilerPublicError, createCompilerPublicDependencies, validateFeedbackPayload, validateSharePayload } from '../../server/compiler-public/compilerPublicService.js';

vi.mock('../../server/firebaseAdminApp.js', () => ({ getServerFirebaseApp: vi.fn(async () => ({ name: 'mock-app' })) }));
vi.mock('firebase-admin/firestore', async (importOriginal) => ({ ...(await importOriginal()), getFirestore: vi.fn(() => ({ kind: 'db' })) }));
vi.mock('firebase-admin/auth', async (importOriginal) => ({ ...(await importOriginal()), getAuth: vi.fn(() => ({ kind: 'auth' })) }));

it('materializes request time as epoch milliseconds for HTTP handlers', async () => {
  const before = Date.now();
  const dependencies = await createCompilerPublicDependencies({});
  expect(dependencies.now).toBeTypeOf('number');
  expect(dependencies.now).toBeGreaterThanOrEqual(before);
  expect(dependencies.now).toBeLessThanOrEqual(Date.now());
});

describe('compiler public share validation', () => {
  it('accepts canonical snapshots and excludes stdin unless explicitly selected', () => {
    expect(validateSharePayload({ languageId: 'python', source: 'print(1)', stdin: 'secret' })).toEqual({ languageId: 'python', source: 'print(1)', stdinIncluded: false, stdin: null });
    expect(validateSharePayload({ languageId: 'rust', source: 'fn main() {}', stdinIncluded: true, stdin: '5' }).stdin).toBe('5');
  });
  it('rejects invalid languages and oversized UTF-8 fields', () => {
    expect(() => validateSharePayload({ languageId: 'ruby', source: '' })).toThrow(CompilerPublicError);
    expect(() => validateSharePayload({ languageId: 'Python', source: '' })).toThrow(/supported compiler language/);
    expect(() => validateSharePayload({ languageId: ' python ', source: '' })).toThrow(/supported compiler language/);
    expect(() => validateSharePayload({ languageId: 'python', source: '€'.repeat(22000) })).toThrow(/64 KiB/);
    expect(() => validateSharePayload({ languageId: 'python', source: '', stdinIncluded: true, stdin: 'x'.repeat(65537) })).toThrow(/64 KiB/);
  });
});

describe('compiler feedback validation and privacy', () => {
  it.each(['bug', 'improvement', 'general'])('accepts %s and stores only allowlisted context', (type) => {
    const result = validateFeedbackPayload({ type, description: ' Useful feedback ', languageId: 'python', route: '/python', source: 'private', stdin: 'private', email: 'private', context: { theme: 'dark', viewportWidth: 1200, source: 'private', authToken: 'private' } });
    expect(result.description).toBe('Useful feedback');
    expect(result.context).toEqual(expect.objectContaining({ theme: 'dark', viewportWidth: 1200 }));
    expect(JSON.stringify(result)).not.toMatch(/private|source|stdin|authToken|email/);
  });
  it('rejects invalid types and description bounds', () => {
    expect(() => validateFeedbackPayload({ type: 'other', description: 'valid text' })).toThrow(/valid feedback type/);
    expect(() => validateFeedbackPayload({ type: 'bug', description: 'no' })).toThrow(/between 5 and 5000/);
    expect(() => validateFeedbackPayload({ type: 'bug', description: 'x'.repeat(5001) })).toThrow(/between 5 and 5000/);
    expect(() => validateFeedbackPayload({ type: 'bug', description: 'valid text', languageId: 'Python' })).toThrow(/Invalid compiler language/);
  });
});
