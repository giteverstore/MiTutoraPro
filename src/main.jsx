import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './design-system/tokens.css';
import './design-system/primitives.css';
import './styles.css';
import './design-system/coherence.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
