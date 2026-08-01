import { authRepository as defaultRepository } from './AuthRepository';
import { logAuthenticationError, logAuthenticationEvent } from './authDiagnostics';

function normalizeUser(firebaseUser, document = null) {
  if (!firebaseUser) return null;
  const email = document?.email || firebaseUser.email || '';
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email,
    name: document?.name || firebaseUser.displayName || email.split('@')[0] || 'Learner',
    avatar: document?.avatar || firebaseUser.photoURL || '',
    emailVerified: firebaseUser.emailVerified,
    providers: document?.providers ?? firebaseUser.providerData.map(({ providerId }) => providerId),
    createdAt: document?.createdAt ?? null,
    lastLogin: document?.lastLogin ?? null,
  };
}

export function getAuthenticationErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
    'auth/credential-already-in-use': 'This sign-in method is already connected to another account.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-login-credentials': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/missing-password': 'Password is required.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/user-disabled': 'This account has been disabled. Contact support for help.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Allow popups to continue with Google.',
    'auth/cancelled-popup-request': 'A sign-in request is already in progress.',
    'auth/unauthorized-domain': 'Google sign-in is not available from this domain.',
    'auth/operation-not-allowed': 'This sign-in method is not currently available.',
    'auth/network-request-failed': 'Check your internet connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/weak-password': 'Password must be at least 6 characters.',
  };
  return messages[error?.code] ?? 'Authentication could not be completed. Please try again.';
}

function authenticationError(error) {
  const normalized = new Error(getAuthenticationErrorMessage(error));
  normalized.code = error?.code ?? 'auth/unknown';
  normalized.cause = error;
  return normalized;
}

export class AuthService {
  constructor(repository = defaultRepository) {
    this.repository = repository;
  }

  async signInWithGoogle() {
    try {
      await this.repository.signInWithGoogle();
    } catch (error) {
      throw authenticationError(error);
    }
  }

  async signInWithEmail(email, password) {
    try {
      await this.repository.signInWithEmail(email, password);
    } catch (error) {
      throw authenticationError(error);
    }
  }

  async signUpWithEmail(email, password) {
    try {
      await this.repository.signUpWithEmail(email, password);
    } catch (error) {
      throw authenticationError(error);
    }
  }

  async signOut() {
    try {
      await this.repository.signOut();
    } catch (error) {
      throw authenticationError(error);
    }
  }

  async refreshUser() {
    const firebaseUser = this.repository.getCurrentUser();
    if (!firebaseUser) return null;
    const document = await this.repository.getUserDocument(firebaseUser.uid);
    return normalizeUser(firebaseUser, document);
  }

  onAuthStateChanged(next, error) {
    return this.repository.observeAuthState(async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          logAuthenticationEvent('Auth state resolved without an authenticated user.');
          next(null);
          return;
        }
        logAuthenticationEvent('Authenticated Firebase user received by AuthService.', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
        });
        const document = await this.repository.synchronizeUserDocument(firebaseUser);
        logAuthenticationEvent('Firestore synchronization awaited successfully.', {
          uid: firebaseUser.uid,
        });
        const user = normalizeUser(firebaseUser, document);
        logAuthenticationEvent('Publishing authenticated user to AuthContext.', {
          uid: user.uid,
        });
        next(user);
      } catch (authError) {
        logAuthenticationError('Auth-state user synchronization failed.', authError);
        error?.(authError);
      }
    }, error);
  }
}

export const authService = new AuthService();
