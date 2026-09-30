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

  async execute({ source, stdin, filename, signal, timeoutMs, executionId, onExecutionEvent }) {
    const payload = await this.client.execute({ source, stdin, filename, signal, timeoutMs, executionId, onExecutionEvent });
    return createPythonExecutionResult(payload);
  }

  submitStdin(submission) {
    return this.client.submitStdin(submission);
  }

  async reset() {
    this.client.reset();
    return super.reset();
  }

  async dispose() {
    this.client.dispose();
  }
}
