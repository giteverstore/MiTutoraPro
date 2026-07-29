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

function decodeString(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\(["'\\])/g, '$1');
}

function resolveValue(expression, variables) {
  const value = expression.trim();
  const stringMatch = value.match(/^f?(["'])([\s\S]*)\1$/);
  if (stringMatch) {
    const decoded = decodeString(stringMatch[2]);
    return value.startsWith('f')
      ? decoded.replace(/\{([A-Za-z_]\w*)\}/g, (_, name) => variables.get(name) ?? `{${name}}`)
      : decoded;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  if (variables.has(value)) return variables.get(value);
  const subtraction = value.match(/^([A-Za-z_]\w*|-?\d+(?:\.\d+)?)\s*-\s*([A-Za-z_]\w*|-?\d+(?:\.\d+)?)$/);
  if (subtraction) {
    const left = Number(variables.get(subtraction[1]) ?? subtraction[1]);
    const right = Number(variables.get(subtraction[2]) ?? subtraction[2]);
    return String(left - right);
  }
  return value;
}

function splitArguments(value) {
  return value.match(/(?:f?["'][^"']*["']|[^,])+/g)?.map((part) => part.trim()) ?? [];
}

function extractPrintedOutput(source) {
  const variables = new Map();
  const output = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const assignment = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (assignment) {
      variables.set(assignment[1], resolveValue(assignment[2], variables));
      continue;
    }
    const printCall = line.match(/^print\s*\(([\s\S]*)\)\s*$/);
    if (printCall) {
      output.push(splitArguments(printCall[1])
        .map((argument) => resolveValue(argument, variables))
        .join(' '));
    }
  }
  return output.join('\n');
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
