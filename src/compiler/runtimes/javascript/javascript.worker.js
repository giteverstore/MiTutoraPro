import { executeJavaScriptSource } from './javascriptExecution.js';

self.addEventListener('message', async ({ data }) => {
  if (data.type !== 'execute') return;
  const result = await executeJavaScriptSource(data);
  self.postMessage({ id: data.id, type: 'execution', ...result });
});
