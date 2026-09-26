import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { SqlWorkerClient } from './SqlWorkerClient.js';

export class SqlRuntime extends RuntimeAdapter {
  constructor({ client = new SqlWorkerClient() } = {}) {
    super();
    this.client = client;
  }

  async initialize(options) { await this.client.initialize(options); }
  async execute(request) { return this.client.execute(request); }
  async reset() { this.client.reset(); return super.reset(); }
  async dispose() { this.client.dispose(); }
}
