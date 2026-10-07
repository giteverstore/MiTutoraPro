import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '../../../src/design-system/tokens.css';
import './styles.css';
import { AdminErrorBoundary } from './AdminErrorBoundary.jsx';

const root = createRoot(document.getElementById('root'));

Promise.all([
  import('./AdminApp.jsx'),
  import('./adminAuthClient.js'),
]).then(([{ AdminApplication }, { adminAuthClient }]) => {
  root.render(<StrictMode><AdminErrorBoundary><AdminApplication authClient={adminAuthClient} /></AdminErrorBoundary></StrictMode>);
}).catch((error) => {
  if (import.meta.env.DEV) console.error('[Y Coders Admin] initialization failed', error);
  root.render(<main className="admin-state-page"><section className="admin-state-card" role="alert"><span className="admin-eyebrow">Y Coders Admin</span><h1>Admin configuration is unavailable</h1><p>The application could not initialize securely. Contact an administrator.</p></section></main>);
});
