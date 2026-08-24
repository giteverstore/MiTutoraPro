import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { useAuth } from '../auth/AuthContext';
import { AppSidebar } from './AppSidebar';
import { AppTopNavigation } from './AppTopNavigation';
import { APP_NAVIGATION } from './navigation';
import { useApplicationTheme } from '../theme/useApplicationTheme';

export function AppShell({ activePage, onNavigate, children }) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { theme, reducedMotion, toggleTheme } = useApplicationTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem('mi-tutora:app-sidebar-collapsed') === 'true',
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pageLabel = useMemo(
    () => APP_NAVIGATION.find((item) => item.id === activePage)?.label ?? 'Home',
    [activePage],
  );
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileDrawerOpen(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const navigate = (page) => {
    setMobileDrawerOpen(false);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
    onNavigate(page);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('mi-tutora:app-sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <div
      className={`application-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}
      data-theme={theme}
      data-reduced-motion={reducedMotion}
    >
      <AppSidebar
        activePage={activePage}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileDrawerOpen}
        onNavigate={navigate}
        onToggleCollapsed={toggleSidebar}
        onCloseMobile={() => setMobileDrawerOpen(false)}
      />
      <AppTopNavigation
        pageLabel={pageLabel}
        user={user}
        theme={theme}
        notificationsOpen={notificationsOpen}
        userMenuOpen={userMenuOpen}
        onMenuOpen={() => setMobileDrawerOpen(true)}
        onThemeToggle={() => { void toggleTheme().catch(() => undefined); }}
        onNotificationsToggle={() => {
          setUserMenuOpen(false);
          setNotificationsOpen((current) => !current);
        }}
        onUserMenuToggle={() => {
          setNotificationsOpen(false);
          setUserMenuOpen((current) => !current);
        }}
        onSignOut={signOut}
      />
      <main className="application-page" id="application-page" tabIndex="-1">
        {children}
      </main>
    </div>
  );
}
