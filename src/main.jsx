import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './firebase/appCheck';
import App from './App';
import { GlobalErrorBoundary } from './errors/ErrorBoundary';
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
