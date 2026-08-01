import {
  getCurrentUser,
  onAuthStateChanged,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from '../firebase/auth';
import { UserRepository } from '../repositories/firestore/UserRepository';
import { logAuthenticationError, logAuthenticationEvent } from './authDiagnostics';

function providerIds(firebaseUser) {
  return firebaseUser.providerData.map(({ providerId }) => providerId);
}

export class AuthRepository {
  constructor(userRepository = new UserRepository()) {
    this.users = userRepository;
  }

  async signInWithGoogle() {
    try {
      const credential = await signInWithGoogle();
      logAuthenticationEvent('Google UserCredential received.', {
        uid: credential.user.uid,
        email: credential.user.email,
        providerId: credential.providerId,
      });
      return credential;
    } catch (error) {
      logAuthenticationError('Google sign-in failed before UserCredential.', error);
      throw error;
    }
  }

  async signInWithEmail(email, password) {
    try {
      const credential = await signInWithEmail(email, password);
      logAuthenticationEvent('Email sign-in UserCredential received.', {
        uid: credential.user.uid,
        email: credential.user.email,
        providerId: credential.providerId,
      });
      return credential;
    } catch (error) {
      logAuthenticationError('Email sign-in failed before UserCredential.', error);
      throw error;
    }
  }

  async signUpWithEmail(email, password) {
    try {
      const credential = await signUpWithEmail(email, password);
      logAuthenticationEvent('Email registration UserCredential received.', {
        uid: credential.user.uid,
        email: credential.user.email,
        providerId: credential.providerId,
      });
      return credential;
    } catch (error) {
      logAuthenticationError('Email registration failed before UserCredential.', error);
      throw error;
    }
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
    let operation = 'checking whether the Firestore user document exists';
    logAuthenticationEvent('Firestore user synchronization started.', {
      uid: firebaseUser.uid,
      path: `users/${firebaseUser.uid}`,
    });

    try {
      const userExists = await this.users.exists(firebaseUser.uid);
      logAuthenticationEvent('Firestore user existence check completed.', {
        uid: firebaseUser.uid,
        exists: userExists,
      });

      if (userExists) {
        operation = 'updating lastLogin on the Firestore user document';
        logAuthenticationEvent('Awaiting Firestore user update.', {
          uid: firebaseUser.uid,
          fields: ['lastLogin'],
        });
        const updatedUser = await this.users.update(firebaseUser.uid, { lastLogin: timestamp });
        logAuthenticationEvent('Firestore user update completed.', { uid: firebaseUser.uid });
        return updatedUser;
      }

      operation = 'creating the Firestore user document';
      logAuthenticationEvent('Awaiting Firestore user creation.', { uid: firebaseUser.uid });
      const createdUser = await this.users.set(firebaseUser.uid, {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        name: firebaseUser.displayName ?? '',
        avatar: firebaseUser.photoURL ?? '',
        emailVerified: firebaseUser.emailVerified,
        providers: providerIds(firebaseUser),
        createdAt: timestamp,
        lastLogin: timestamp,
      });
      logAuthenticationEvent('Firestore user creation completed.', { uid: firebaseUser.uid });
      return createdUser;
    } catch (error) {
      logAuthenticationError(`Firestore failure while ${operation}.`, error);
      throw error;
    }
  }
}

export const authRepository = new AuthRepository();
