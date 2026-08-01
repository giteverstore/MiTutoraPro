import { authRepository as defaultRepository } from './AuthRepository';

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
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Allow popups to continue with Google.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/weak-password': 'Choose a stronger password with at least eight characters.',
  };
  return messages[error?.code] ?? error?.message ?? 'Authentication could not be completed.';
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
          next(null);
          return;
        }
        const document = await this.repository.synchronizeUserDocument(firebaseUser);
        next(normalizeUser(firebaseUser, document));
      } catch (authError) {
        error?.(authError);
      }
    }, error);
  }
}

export const authService = new AuthService();
