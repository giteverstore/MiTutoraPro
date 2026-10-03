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

  async execute({ source, stdin, filename, signal, timeoutMs, executionId, onExecutionEvent, projectFiles, entrypoint }) {
    // Successful runs dispose their worker, so every execution gets a fresh
    // Pyodide VM while initialization retains its separate bounded timeout.
    await this.client.initialize(signal);
    const payload = await this.client.execute({ source, stdin, filename, signal, timeoutMs, executionId, onExecutionEvent, projectFiles, entrypoint });
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
