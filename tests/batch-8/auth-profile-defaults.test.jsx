import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserProvider, useUser } from '../../src/auth/UserContext';

afterEach(cleanup);

function ProfileProbe({ profile }) {
  const { createProfile, user } = useUser();
  return (
    <>
      <button type="button" onClick={() => createProfile(profile)}>Initialize profile</button>
      <output>{user ? JSON.stringify(user) : 'none'}</output>
    </>
  );
}

describe('new profile defaults', () => {
  it('initializes the canonical learning defaults used by first-time auth users', async () => {
    const repository = {
      loadCurrentUser: vi.fn().mockResolvedValue(null),
      saveCurrentUser: vi.fn().mockResolvedValue(undefined),
    };
    render(
      <UserProvider repository={repository}>
        <ProfileProbe profile={{ id: 'firebase-user', name: 'Grace', email: 'grace@example.com', avatar: '' }} />
      </UserProvider>,
    );
    await waitFor(() => expect(screen.getByText('none')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Initialize profile' }));
    await waitFor(() => expect(repository.saveCurrentUser).toHaveBeenCalledWith(expect.objectContaining({
      avatar: '',
      learningPreferences: {
        experienceLevel: 'beginner',
        preferredLanguage: 'English',
        dailyGoalMinutes: 20,
      },
    })));
  });

  it('does not overwrite preferences while loading an existing user', async () => {
    const existingUser = {
      id: 'returning-user',
      name: 'Returning Learner',
      email: 'returning@example.com',
      avatar: '🧑‍💻',
      learningPreferences: {
        experienceLevel: 'advanced',
        preferredLanguage: 'Hindi',
        dailyGoalMinutes: 45,
      },
    };
    const repository = {
      loadCurrentUser: vi.fn().mockResolvedValue(existingUser),
      saveCurrentUser: vi.fn(),
    };
    render(
      <UserProvider repository={repository}>
        <ProfileProbe profile={{}} />
      </UserProvider>,
    );
    await waitFor(() => expect(screen.getByText(JSON.stringify(existingUser))).toBeInTheDocument());
    expect(repository.saveCurrentUser).not.toHaveBeenCalled();
  });
});
