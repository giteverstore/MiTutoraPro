import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { createPhpExecutionResult } from './outputCapture.js';
import { PhpWorkerClient } from './PhpWorkerClient.js';

export class PhpRuntime extends RuntimeAdapter {
  constructor({ client = new PhpWorkerClient() } = {}) {
    super();
    this.client = client;
  }

  async initialize(options) {
    await this.client.initialize(options);
  }

  async execute(request) {
    return createPhpExecutionResult(await this.client.execute(request));
  }

  async reset() {
    this.client.reset();
    return super.reset();
  }

  async dispose() {
    this.client.dispose();
  }
}
