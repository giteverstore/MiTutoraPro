import { useState } from 'react';
import { useUser } from '../../auth/UserContext';
import { ForgotPassword } from './ForgotPassword';
import { ProfileCreation } from './ProfileCreation';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

export function AuthFlow() {
  const { signIn, createProfile } = useUser();
  const [screen, setScreen] = useState('sign-in');
  const [pendingAccount, setPendingAccount] = useState(null);

  if (screen === 'sign-up') {
    return (
      <SignUp
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
    return <ProfileCreation account={pendingAccount} onComplete={createProfile} />;
  }

  return (
    <SignIn
      onSubmit={signIn}
      onSignUp={() => setScreen('sign-up')}
      onForgotPassword={() => setScreen('forgot-password')}
    />
  );
}
