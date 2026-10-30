import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../src/auth/AuthService.js';

const firebaseUser = {
  uid: 'learner-1',
  email: 'learner@example.test',
  displayName: 'Learner',
  photoURL: null,
  emailVerified: true,
  providerData: [{ providerId: 'password' }],
};

describe('AuthService SDK upgrade regressions', () => {
  it('hydrates an existing Firebase user through the auth observer', async () => {
    const repository = {
      observeAuthState: vi.fn((next) => {
        void next(firebaseUser);
        return vi.fn();
      }),
      synchronizeUserDocument: vi.fn(async () => ({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      })),
    };
    const next = vi.fn();

    new AuthService(repository).onAuthStateChanged(next, vi.fn());
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(expect.objectContaining({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
    })));
  });

  it('delegates token acquisition without changing refresh behavior', async () => {
    const repository = { getIdToken: vi.fn(async () => 'id-token') };

    await expect(new AuthService(repository).getIdToken(true)).resolves.toBe('id-token');
    expect(repository.getIdToken).toHaveBeenCalledWith(true);
  });

  it('preserves sign-in and sign-out transitions', async () => {
    const repository = {
      signInWithGoogle: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
    };
    const service = new AuthService(repository);

    await service.signInWithGoogle();
    await service.signOut();

    expect(repository.signInWithGoogle).toHaveBeenCalledOnce();
    expect(repository.signOut).toHaveBeenCalledOnce();
  });
});
