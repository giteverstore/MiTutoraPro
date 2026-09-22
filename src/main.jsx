import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './firebase/appCheck';
import App from './App';
import { GlobalErrorBoundary } from './errors/ErrorBoundary';
import './styles/theme.css';
import './design-system/tokens.css';
import './design-system/primitives.css';
import './styles/index.css';
import './design-system/coherence.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
