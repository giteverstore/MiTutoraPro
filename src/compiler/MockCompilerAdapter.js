import { CompilerAdapter } from './CompilerAdapter.js';

const DEFAULT_DELAY_MS = 650;

function wait(duration, signal) {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, duration);

    signal?.addEventListener('abort', () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('Execution cancelled.', 'AbortError'));
    }, { once: true });
  });
}

function extractPrintedOutput(source) {
  return [...source.matchAll(/print\s*\(\s*["'](.*?)["']\s*\)/g)]
    .map((match) => match[1])
    .join('\n');
}

function detectMockError(source) {
  const executableSource = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .trim();

  if (!executableSource) {
    return 'Add some code before running the local preview.';
  }

  if (/\b(?:raise|throw)\b/.test(source) || source.includes('syntax_error')) {
    return 'Mock execution error: the source contains an intentional error marker.';
  }

  return '';
}

export class MockCompilerAdapter extends CompilerAdapter {
  constructor({ delayMs = DEFAULT_DELAY_MS } = {}) {
    super();
    this.delayMs = delayMs;
  }

  async execute({ source, signal }) {
    const startedAt = performance.now();
    await wait(this.delayMs, signal);

    const error = detectMockError(source);
    const executionTimeMs = Math.max(1, Math.round(performance.now() - startedAt));

    if (error) {
      return {
        status: 'error',
        output: '',
        errors: [error],
        executionTimeMs,
      };
    }

    return {
      status: 'success',
      output: extractPrintedOutput(source) || 'Program finished successfully.',
      errors: [],
      executionTimeMs,
    };
  }

  async reset() {
    return {
      status: 'idle',
      output: '',
      errors: [],
      executionTimeMs: null,
    };
  }
}
