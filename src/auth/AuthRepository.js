import {
  getCurrentUser,
  onAuthStateChanged,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from '../firebase/auth';

function providerIds(firebaseUser) {
  return firebaseUser.providerData.map(({ providerId }) => providerId);
}

export class AuthRepository {
  constructor(userRepository = null) {
    this.users = userRepository;
    this.usersPromise = null;
  }

  async getUsers() {
    if (this.users) return this.users;
    if (!this.usersPromise) {
      this.usersPromise = import('../repositories/firestore/UserRepository')
        .then(({ UserRepository }) => new UserRepository());
    }
    this.users = await this.usersPromise;
    return this.users;
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

  async getUserDocument(uid) {
    return (await this.getUsers()).get(uid);
  }

  async synchronizeUserDocument(firebaseUser) {
    const users = await this.getUsers();
    const timestamp = new Date().toISOString();
    const userExists = await users.exists(firebaseUser.uid);

    if (userExists) {
      return users.update(firebaseUser.uid, { lastLogin: timestamp });
    }

    return users.set(firebaseUser.uid, {
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
