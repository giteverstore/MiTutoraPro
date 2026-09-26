import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { MySqlExecutionClient } from './MySqlExecutionClient.js';

export class MySqlRuntime extends RuntimeAdapter {
  constructor({ client = new MySqlExecutionClient() } = {}) {
    super();
    this.client = client;
  }

  async execute(request) { return this.client.execute(request); }
}
