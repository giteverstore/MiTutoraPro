import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { JavaWorkerClient } from './JavaWorkerClient.js';
import { createJavaExecutionResult } from './outputCapture.js';

export class JavaRuntime extends RuntimeAdapter {
  constructor({ client = new JavaWorkerClient() } = {}) {
    super();
    this.client = client;
  }

  async initialize({ signal } = {}) { await this.client.initialize(signal); }

  async execute(request) {
    const payload = await this.client.execute(request);
    return createJavaExecutionResult(payload);
  }

  async reset() {
    await this.client.reset();
    return super.reset();
  }

  async dispose() { this.client.dispose(); }
}
