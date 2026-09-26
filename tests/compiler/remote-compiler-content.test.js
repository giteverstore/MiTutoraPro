import { describe, expect, it } from 'vitest';
import { FirebaseRemoteCompilerContentAuthorizer } from '../../server/remote-compiler/FirebaseRemoteCompilerContentAuthorizer.js';

const snapshot = (value) => ({ exists: value !== undefined, data: () => value });
function authorizer({ documents = {}, objects = {}, uid = 'learner' } = {}) {
  return new FirebaseRemoteCompilerContentAuthorizer({
    uid,
    db: { doc: (path) => ({ get: async () => snapshot(documents[path]) }) },
    loadJson: async (path) => objects[path],
  });
}

describe('remote compiler canonical content authority', () => {
  it('authorizes published Course, Practice, and Challenge compiler fixtures', async () => {
    const documents = {
      'courses/go-course': { published: true, storagePath: 'courses/go', version: 'v1' },
      'practiceQuestions/go-p1': { published: true, storagePath: 'practice/go/p1.json', version: 'v1' },
      'dailyChallenges/2026-09-25': { published: true, practiceQuestionId: 'go-p1' },
    };
    const objects = {
      'courses/go/v1/course.json': { modules: [{ lessons: [{ id: 'lesson-1' }] }] },
      'courses/go/v1/module-1.json': { lessons: [{ id: 'lesson-1', blocks: [{ type: 'compiler', language: 'go' }] }] },
      'practice/go/v1/p1.json': { blocks: [{ type: 'compiler', language: 'go' }] },
    };
    const value = authorizer({ documents, objects });
    await expect(value.assertAllowed({ language: 'go', contentType: 'course', contentId: 'go-course:lesson-1' })).resolves.toBe(true);
    await expect(value.assertAllowed({ language: 'go', contentType: 'practice', contentId: 'go-p1' })).resolves.toBe(true);
    await expect(value.assertAllowed({ language: 'go', contentType: 'challenge', contentId: '2026-09-25' })).resolves.toBe(true);
  });

  it('rejects language mismatch and enforces premium entitlement', async () => {
    const base = {
      'practiceQuestions/rust-p1': { published: true, premium: true, storagePath: 'practice/rust/p1.json', version: 'v1' },
    };
    const objects = { 'practice/rust/v1/p1.json': { blocks: [{ type: 'compiler', language: 'rust' }] } };
    await expect(authorizer({ documents: base, objects }).assertAllowed({ language: 'go', contentType: 'practice', contentId: 'rust-p1' })).rejects.toMatchObject({ code: 'remote-compiler/content-forbidden' });
    const entitled = { ...base, 'users/learner/entitlements/premium': { active: true, tier: 'PREMIUM', expiresAt: new Date(Date.now() + 60_000) } };
    await expect(authorizer({ documents: entitled, objects }).assertAllowed({ language: 'go', contentType: 'practice', contentId: 'rust-p1' })).rejects.toMatchObject({ code: 'remote-compiler/language-not-authorized' });
    await expect(authorizer({ documents: entitled, objects }).assertAllowed({ language: 'rust', contentType: 'practice', contentId: 'rust-p1' })).resolves.toBe(true);
  });
});
