import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';

export function UserDataLifecycle() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    const userId = user?.id ?? null;

    Promise.all([
      import('./UserDataService'),
      import('../settings/SettingsService'),
    ])
      .then(([{ userDataService }, { settingsService }]) => (
        userDataService.setAuthenticatedUser(userId)
          .then(() => active ? settingsService.setUser(userId) : undefined)
      ))
      .catch((error) => {
        if (active) console.error('[UserData] Unable to initialize user data.', error);
      });

    return () => { active = false; };
  }, [loading, user?.id]);

  return null;
}
