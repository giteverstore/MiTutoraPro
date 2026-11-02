import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  createProfile: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUpWithEmail: vi.fn(),
}));

vi.mock('../../src/auth/UserContext', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    useUser: () => ({ createProfile: authMocks.createProfile }),
  };
});
vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({
    signInWithEmail: authMocks.signInWithEmail,
    signInWithGoogle: authMocks.signInWithGoogle,
    signUpWithEmail: authMocks.signUpWithEmail,
  }),
}));

import { AuthFlow } from '../../src/components/auth/AuthFlow';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('simplified authentication onboarding', () => {
  it('creates the profile and Firebase account directly without a personalization screen', async () => {
    window.history.replaceState({}, '', '/signup?ref=FRIEND42');
    render(<AuthFlow initialScreen="sign-up" />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada Learner' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secure-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secure-password' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => expect(authMocks.signUpWithEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'secure-password',
      'FRIEND42',
    ));
    expect(authMocks.createProfile).toHaveBeenCalledWith({
      name: 'Ada Learner',
      email: 'ada@example.com',
    });
    expect(authMocks.createProfile.mock.invocationCallOrder[0]).toBeLessThan(
      authMocks.signUpWithEmail.mock.invocationCallOrder[0],
    );
    expect(screen.queryByText(/personalize learning/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start learning/i })).not.toBeInTheDocument();
  });

  it('keeps Google signup on the direct authentication path without personalization', async () => {
    render(<AuthFlow initialScreen="sign-up" />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => expect(authMocks.signInWithGoogle).toHaveBeenCalledOnce());
    expect(screen.queryByText(/personalize learning/i)).not.toBeInTheDocument();
  });
});
