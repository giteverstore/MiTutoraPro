import React from 'react';
import { createRoot } from 'react-dom/client';
import { AITutorPanel } from '../../src/ai/AITutorPanel.jsx';
import { AITutorClient } from '../../src/ai/AITutorClient.js';
import '../../src/styles/theme.css';
import '../../src/design-system/tokens.css';
import '../../src/design-system/primitives.css';
import '../../src/styles/index.css';
import '../../src/design-system/coherence.css';
import '../../src/styles/pages/learning-engine.css';

const client = new AITutorClient({ tokenProvider: async () => 'local-ai-smoke-token' });

createRoot(document.getElementById('root')).render(<AITutorPanel
  language="python"
  code={'numbers = [1, 2, 3]\nprint(numbers)'}
  selectedCode=""
  compilerStatus="success"
  lessonContext="Python lists"
  accessTier="PREMIUM"
  client={client}
/>);
