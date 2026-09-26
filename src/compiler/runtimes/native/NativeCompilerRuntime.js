import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { NativeCompilerWorkerClient } from './NativeCompilerWorkerClient.js';

export class NativeCompilerRuntime extends RuntimeAdapter {
  constructor({ language, client = new NativeCompilerWorkerClient() } = {}) {
    super();
    if (!['c', 'cpp'].includes(language)) throw new Error(`Unsupported native runtime language: ${language}`);
    this.language = language;
    this.client = client;
  }

  async initialize(options) { await this.client.initialize(options); }
  async execute(request) { return this.client.execute({ ...request, language: this.language }); }
  async reset() { this.client.reset(); return super.reset(); }
  async dispose() { this.client.dispose(); }
}
