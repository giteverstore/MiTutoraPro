import {
  getCurrentUser,
  onAuthStateChanged,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from '../firebase/auth';
import { UserRepository } from '../repositories/firestore/UserRepository';

function providerIds(firebaseUser) {
  return firebaseUser.providerData.map(({ providerId }) => providerId);
}

export class AuthRepository {
  constructor(userRepository = new UserRepository()) {
    this.users = userRepository;
  }

  async signInWithGoogle() {
    return signInWithGoogle();
  }

  async signInWithEmail(email, password) {
    return signInWithEmail(email, password);
  }

  async signUpWithEmail(email, password) {
    return signUpWithEmail(email, password);
  }

  signOut() {
    return signOutUser();
  }

  getCurrentUser() {
    return getCurrentUser();
  }

  observeAuthState(next, error) {
    return onAuthStateChanged(next, error);
  }

  getUserDocument(uid) {
    return this.users.get(uid);
  }

  async synchronizeUserDocument(firebaseUser) {
    const timestamp = new Date().toISOString();
    const userExists = await this.users.exists(firebaseUser.uid);

    if (userExists) {
      return this.users.update(firebaseUser.uid, { lastLogin: timestamp });
    }

    return this.users.set(firebaseUser.uid, {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      name: firebaseUser.displayName ?? '',
      avatar: firebaseUser.photoURL ?? '',
      emailVerified: firebaseUser.emailVerified,
      providers: providerIds(firebaseUser),
      createdAt: timestamp,
      lastLogin: timestamp,
    });
  }
}

export const authRepository = new AuthRepository();
