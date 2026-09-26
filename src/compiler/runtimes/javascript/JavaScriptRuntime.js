import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { createJavaScriptExecutionResult } from './outputCapture.js';
import { JavaScriptWorkerClient } from './JavaScriptWorkerClient.js';

export class JavaScriptRuntime extends RuntimeAdapter {
  constructor({ client = new JavaScriptWorkerClient() } = {}) {
    super();
    this.client = client;
  }

  async initialize(options) { await this.client.initialize(options); }

  async execute(request) {
    return createJavaScriptExecutionResult(await this.client.execute(request));
  }

  async reset() { this.client.reset(); return super.reset(); }
  async dispose() { this.client.dispose(); }
}
