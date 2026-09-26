import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { createRExecutionResult } from './outputCapture.js';
import { WebRClient } from './WebRClient.js';

export class RRuntime extends RuntimeAdapter {
  constructor({ client = new WebRClient() } = {}) {
    super();
    this.client = client;
  }

  async initialize(options) {
    await this.client.initialize(options);
  }

  async execute(request) {
    return createRExecutionResult(await this.client.execute(request));
  }

  async reset() {
    this.client.reset();
    return super.reset();
  }

  async dispose() {
    this.client.dispose();
  }
}
