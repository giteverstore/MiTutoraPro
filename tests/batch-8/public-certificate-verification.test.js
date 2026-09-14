import { describe, expect, it } from 'vitest';
import { AttemptService } from '../../functions/src/certification/AttemptService.js';

const credentialId = 'MIT-PYTHON-0123456789ABCDEF';
const snapshot = (data) => ({ exists: Boolean(data), data: () => data });
const service = (certificate, user) => {
  const instance = Object.create(AttemptService.prototype);
  instance.db = { doc: (path) => ({ get: async () => snapshot(path.startsWith('certificates/') ? certificate : user) }) };
  return instance;
};

describe('public certificate authority', () => {
  it('returns only the bounded active certificate projection', async () => {
    const result = await service({ credentialId, ownerUid: 'private-uid', courseTitle: 'Python Foundations', issuedAt: 123, status: 'ACTIVE', examAttemptId: 'private-attempt', verificationCode: 'private-code' }, { name: 'Test Learner', email: 'private@example.test' }).verifyCertificate(credentialId);
    expect(result).toEqual({ credentialId, courseTitle: 'Python Foundations', recipientName: 'Test Learner', issuedAt: 123, status: 'VERIFIED' });
    expect(result).not.toHaveProperty('ownerUid'); expect(result).not.toHaveProperty('examAttemptId'); expect(result).not.toHaveProperty('verificationCode');
  });
  it('rejects malformed, unknown, and revoked credentials honestly', async () => {
    await expect(service(null, null).verifyCertificate('../private')).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(service(null, null).verifyCertificate(credentialId)).rejects.toMatchObject({ code: 'not-found' });
    await expect(service({ credentialId, status: 'REVOKED' }, null).verifyCertificate(credentialId)).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
