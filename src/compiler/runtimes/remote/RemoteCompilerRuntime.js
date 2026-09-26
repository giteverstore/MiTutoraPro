import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { RemoteCompilerClient } from './RemoteCompilerClient.js';

export class RemoteCompilerRuntime extends RuntimeAdapter {
  constructor({ language, client = new RemoteCompilerClient({ language }) } = {}) { super(); this.client = client; }
  async execute(request) { return this.client.execute(request); }
}
