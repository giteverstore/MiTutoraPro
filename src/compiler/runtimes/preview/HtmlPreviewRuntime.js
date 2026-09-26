import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { createHtmlPreviewDocument } from './previewDocument.js';

export class HtmlPreviewRuntime extends RuntimeAdapter {
  async execute({ source }) {
    const startedAt = performance.now();
    const channel = crypto.randomUUID?.() ?? `preview-${Date.now()}-${Math.random()}`;
    return {
      status: 'success', output: '', errors: [],
      executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
      preview: { channel, srcDoc: createHtmlPreviewDocument(source, channel) },
    };
  }
}
