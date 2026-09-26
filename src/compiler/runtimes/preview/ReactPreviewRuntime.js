import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { createReactPreviewDocument } from './previewDocument.js';

function rewriteReactImports(source) {
  const unsupported = [...source.matchAll(/(?:^|\n)\s*import\s+[^;]+?\s+from\s+['"]([^'"]+)['"]\s*;?/g)]
    .map((match) => match[1]).filter((specifier) => !['react', 'react-dom', 'react-dom/client'].includes(specifier));
  if (unsupported.length) throw new Error(`Unsupported preview import: ${unsupported[0]}. Only React and ReactDOM are provided.`);
  const toDestructure = (names) => names.replace(/\s+as\s+/g, ': ');
  return source
    .replace(/(?:^|\n)\s*import\s+React\s*,\s*\{([^}]+)\}\s+from\s+['"]react['"]\s*;?/g, (_match, names) => `\nconst { ${toDestructure(names)} } = React;`)
    .replace(/(?:^|\n)\s*import\s+React\s+from\s+['"]react['"]\s*;?/g, '\n')
    .replace(/(?:^|\n)\s*import\s+\{([^}]+)\}\s+from\s+['"]react['"]\s*;?/g, (_match, names) => `\nconst { ${toDestructure(names)} } = React;`)
    .replace(/(?:^|\n)\s*import\s+ReactDOM(?:Client)?\s+from\s+['"]react-dom(?:\/client)?['"]\s*;?/g, '\n')
    .replace(/(?:^|\n)\s*import\s+\{([^}]+)\}\s+from\s+['"]react-dom(?:\/client)?['"]\s*;?/g, (_match, names) => `\nconst { ${toDestructure(names)} } = ReactDOM;`);
}

export class ReactPreviewRuntime extends RuntimeAdapter {
  async execute({ source, filename = 'App.jsx' }) {
    const startedAt = performance.now();
    try {
      const [babelModule, { reactSource, reactDomSource }] = await Promise.all([
        import('@babel/standalone'),
        import('./reactPreviewAssets.js'),
      ]);
      const babel = babelModule.default ?? babelModule;
      let prepared = rewriteReactImports(String(source ?? ''));
      const hasExplicitRender = /(?:\brender\s*\(|\.render\s*\(|createRoot\s*\()/m.test(prepared);
      if (!hasExplicitRender && /(?:function|class)\s+App\b|\bconst\s+App\s*=/m.test(prepared)) prepared += '\nrender(<App />);';
      const transformedSource = babel.transform(prepared, {
        filename,
        presets: [['react', { runtime: 'classic' }]],
        sourceType: 'script',
      }).code;
      const channel = crypto.randomUUID?.() ?? `preview-${Date.now()}-${Math.random()}`;
      return {
        status: 'success', output: '', errors: [],
        executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
        preview: { channel, srcDoc: createReactPreviewDocument({ transformedSource, reactSource, reactDomSource, channel }) },
      };
    } catch (error) {
      return { status: 'error', output: '', errors: [error.message || String(error)], executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)) };
    }
  }
}
