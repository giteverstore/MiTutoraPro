export const PREVIEW_MESSAGE_TYPE = 'ycoders-preview';

const escapeScript = (source) => String(source ?? '').replace(/<\/script/gi, '<\\/script');

export function createPreviewHarness(channel) {
  return `<script>(() => {
    const channel = ${JSON.stringify(channel)};
    const send = (kind, payload = {}) => parent.postMessage({ type: '${PREVIEW_MESSAGE_TYPE}', channel, kind, ...payload }, '*');
    const serialize = (value) => { if (typeof value === 'string') return value; try { return JSON.stringify(value); } catch { return String(value); } };
    ['log', 'info', 'warn', 'error'].forEach((level) => {
      const original = console[level].bind(console);
      console[level] = (...values) => { send('console', { level, message: values.map(serialize).join(' ') }); original(...values); };
    });
    addEventListener('error', (event) => send('error', { message: event.error?.stack || event.message || 'Preview runtime error.' }));
    addEventListener('unhandledrejection', (event) => send('error', { message: event.reason?.stack || String(event.reason) }));
    addEventListener('DOMContentLoaded', () => send('ready'));
  })();<\/script>`;
}

export function createHtmlPreviewDocument(source, channel) {
  const harness = createPreviewHarness(channel);
  const documentSource = String(source ?? '');
  if (/<head(?:\s[^>]*)?>/i.test(documentSource)) {
    return documentSource.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${harness}`);
  }
  return `<!doctype html><html><head>${harness}</head><body>${documentSource}</body></html>`;
}

export function createReactPreviewDocument({ transformedSource, reactSource, reactDomSource, channel }) {
  const learnerScript = escapeScript(transformedSource);
  return `<!doctype html><html><head><meta charset="utf-8">${createPreviewHarness(channel)}<style>html,body,#root{min-height:100%;margin:0}body{font-family:system-ui,sans-serif;padding:1rem;box-sizing:border-box}</style></head><body><div id="root"></div><script>${escapeScript(reactSource)}<\/script><script>${escapeScript(reactDomSource)}<\/script><script>
    const render = (element) => { window.__ycodersRoot ||= ReactDOM.createRoot(document.getElementById('root')); window.__ycodersRoot.render(element); };
    try { ${learnerScript} } catch (error) { setTimeout(() => { throw error; }); }
  <\/script></body></html>`;
}
