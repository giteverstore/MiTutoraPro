import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { AssemblyWorkerClient } from './AssemblyWorkerClient.js';
import { normalizeAssemblyResult } from './normalizeAssemblyResult.js';

export class AssemblyRuntime extends RuntimeAdapter {
  constructor({ client = new AssemblyWorkerClient() } = {}) {
    super();
    this.client = client;
  }

  async initialize(options) { await this.client.initialize(options); }
  async execute(request) { return normalizeAssemblyResult(await this.client.execute(request)); }
  async reset() { this.client.reset(); return super.reset(); }
  async dispose() { this.client.dispose(); }
}
