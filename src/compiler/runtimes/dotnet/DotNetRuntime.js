import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { DotNetWorkerClient } from './DotNetWorkerClient.js';
import { normalizeDotNetResult } from './normalizeDotNetResult.js';

export class DotNetRuntime extends RuntimeAdapter {
  constructor({ language, client = new DotNetWorkerClient() } = {}) {
    super();
    if (!['csharp', 'visualbasic'].includes(language)) {
      throw new Error(`Unsupported .NET runtime language: ${language}`);
    }
    this.language = language;
    this.client = client;
  }

  async initialize(options) { await this.client.initialize(options); }
  async execute(request) {
    return normalizeDotNetResult(
      await this.client.execute({ ...request, language: this.language }),
      this.language,
    );
  }
  async reset() { this.client.reset(); return super.reset(); }
  async dispose() { this.client.dispose(); }
}
