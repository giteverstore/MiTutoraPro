import { onIdTokenChanged } from 'firebase/auth';
import {
  auth,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
} from '../../../src/firebase/auth.js';
import { adminRoleFromClaims } from '../../../shared/admin/adminAuthorization.js';

function sessionFrom(user, tokenResult) {
  if (!user) return null;
  return Object.freeze({
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
    role: adminRoleFromClaims(tokenResult?.claims),
  });
}

async function resolveSession(user, forceRefresh = false) {
  if (!user) return null;
  const tokenResult = await user.getIdTokenResult(forceRefresh);
  return sessionFrom(user, tokenResult);
}

export const adminAuthClient = Object.freeze({
  subscribe(next, error) {
    return onIdTokenChanged(auth, async (user) => {
      try { next(await resolveSession(user)); }
      catch (claimError) { error(claimError); }
    }, error);
  },
  async signInWithGoogle() {
    const result = await signInWithGoogle();
    return resolveSession(result.user);
  },
  async signInWithEmail(email, password) {
    const result = await signInWithEmail(email, password);
    return resolveSession(result.user);
  },
  signOut: signOutUser,
  refreshClaims() { return resolveSession(auth.currentUser, true); },
});
