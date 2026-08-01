import { useState } from 'react';
import { useUser } from '../../auth/UserContext';
import { useAuth } from '../../auth/AuthContext';
import { ForgotPassword } from './ForgotPassword';
import { ProfileCreation } from './ProfileCreation';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

export function AuthFlow() {
  const { createProfile } = useUser();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [screen, setScreen] = useState('sign-in');
  const [pendingAccount, setPendingAccount] = useState(null);

  if (screen === 'sign-up') {
    return (
      <SignUp
        onGoogle={signInWithGoogle}
        onContinue={(account) => {
          setPendingAccount(account);
          setScreen('profile');
        }}
        onSignIn={() => setScreen('sign-in')}
      />
    );
  }

  if (screen === 'forgot-password') {
    return <ForgotPassword onBack={() => setScreen('sign-in')} />;
  }

  if (screen === 'profile' && pendingAccount) {
    return (
      <ProfileCreation
        account={pendingAccount}
        onComplete={async (profile) => {
          await createProfile(profile);
          await signUpWithEmail(profile.email, pendingAccount.password);
        }}
      />
    );
  }

  return (
    <SignIn
      onSubmit={({ email, password }) => signInWithEmail(email, password)}
      onGoogle={signInWithGoogle}
      onSignUp={() => setScreen('sign-up')}
      onForgotPassword={() => setScreen('forgot-password')}
    />
  );
}
