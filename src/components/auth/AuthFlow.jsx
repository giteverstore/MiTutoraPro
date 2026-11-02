import { useState } from 'react';
import '../../styles/pages/dashboard.css';
import '../../styles/public-pages.css';
import { useUser } from '../../auth/UserContext';
import { useAuth } from '../../auth/AuthContext';
import { ForgotPassword } from './ForgotPassword';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

export function AuthFlow({ initialScreen = 'sign-in' }) {
  const { createProfile } = useUser();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [screen, setScreen] = useState(initialScreen);

  if (screen === 'sign-up') {
    return (
      <SignUp
        onGoogle={signInWithGoogle}
        onContinue={async ({ password, referralCode, ...profile }) => {
          await createProfile(profile);
          await signUpWithEmail(profile.email, password, referralCode);
        }}
        onSignIn={() => setScreen('sign-in')}
      />
    );
  }

  if (screen === 'forgot-password') {
    return <ForgotPassword onBack={() => setScreen('sign-in')} />;
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
