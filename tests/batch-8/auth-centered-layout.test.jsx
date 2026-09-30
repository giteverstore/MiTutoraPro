import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignIn } from '../../src/components/auth/SignIn';
import { SignUp } from '../../src/components/auth/SignUp';

afterEach(cleanup);

describe('centered authentication layout', () => {
  it('renders sign in in one centered shell with every existing action and footer link', () => {
    const { container } = render(<SignIn onSubmit={vi.fn()} onGoogle={vi.fn()} onSignUp={vi.fn()} onForgotPassword={vi.fn()} />);
    expect(container.querySelectorAll('.auth-form-panel')).toHaveLength(1);
    expect(container.querySelector('.auth-page')).toHaveAttribute('data-theme', 'light');
    expect(container.querySelector('.auth-brand-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Learn by building')).not.toBeInTheDocument();
    expect(screen.queryByText('Welcome back')).not.toBeInTheDocument();
    expect(screen.queryByText('Use your email and password or continue with Google.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument();
    for (const link of ['About', 'Contact', 'Privacy', 'Terms', 'Refund Policy']) expect(screen.getByRole('link', { name: link })).toBeInTheDocument();
  });

  it('preserves every sign-up field, Google action, referral value, and switch action', () => {
    window.history.replaceState({}, '', '/signup?ref=FRIEND42');
    const { container } = render(<SignUp onContinue={vi.fn()} onGoogle={vi.fn()} onSignIn={vi.fn()} />);
    expect(container.querySelector('.auth-brand-panel')).not.toBeInTheDocument();
    expect(container.querySelector('.auth-page')).toHaveAttribute('data-theme', 'light');
    expect(screen.queryByText('Create account')).not.toBeInTheDocument();
    expect(screen.queryByText('Set up the basics, then personalize how you want to learn.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start your learning profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByLabelText('Referral code (optional)')).toHaveValue('FRIEND42');
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('keeps authentication failures in an accessible compact inline alert', async () => {
    const onGoogle = vi.fn().mockRejectedValue(new Error('Google sign-in was cancelled.'));
    render(<SignIn onSubmit={vi.fn()} onGoogle={onGoogle} onSignUp={vi.fn()} onForgotPassword={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in was cancelled.');
    await waitFor(() => expect(onGoogle).toHaveBeenCalledTimes(1));
  });

  it('uses one responsive shell tree for desktop and mobile', () => {
    const { container } = render(<SignIn onSubmit={vi.fn()} onGoogle={vi.fn()} onSignUp={vi.fn()} onForgotPassword={vi.fn()} />);
    expect(container.querySelector('.auth-page > .auth-form-panel > .auth-form-wrap')).toBeInTheDocument();
  });

  it('keeps the auth shell explicitly light inside a dark application context', () => {
    const { container } = render(<div data-theme="dark"><SignIn onSubmit={vi.fn()} onGoogle={vi.fn()} onSignUp={vi.fn()} onForgotPassword={vi.fn()} /></div>);
    expect(container.querySelector('[data-theme="dark"] .auth-page')).toHaveAttribute('data-theme', 'light');
  });
});
