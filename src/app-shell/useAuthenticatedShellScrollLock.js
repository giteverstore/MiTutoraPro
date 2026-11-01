import { useEffect } from 'react';

export const AUTHENTICATED_SHELL_BODY_CLASS = 'has-application-shell';

export function useAuthenticatedShellScrollLock() {
  useEffect(() => {
    document.body.classList.add(AUTHENTICATED_SHELL_BODY_CLASS);
    return () => document.body.classList.remove(AUTHENTICATED_SHELL_BODY_CLASS);
  }, []);
}
