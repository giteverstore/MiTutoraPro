import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { createPythonExecutionResult } from './outputCapture.js';
import { PythonWorkerClient } from './PythonWorkerClient.js';

export class PythonRuntime extends RuntimeAdapter {
  constructor({ client = new PythonWorkerClient() } = {}) {
    super();
    this.client = client;
  }

  async initialize({ signal } = {}) {
    await this.client.initialize(signal);
  }

  async execute({ source, stdin, filename, signal }) {
    const payload = await this.client.execute({ source, stdin, filename, signal });
    return createPythonExecutionResult(payload);
  }

  async reset() {
    return super.reset();
  }

  async dispose() {
    this.client.dispose();
  }
}
