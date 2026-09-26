import {
  R_EXECUTION_TIMEOUT_MS,
  R_INITIALIZATION_TIMEOUT_MS,
  getWebRBaseUrl,
} from './rRuntimeConfig.js';

function abortError(message = 'R execution cancelled.') {
  return new DOMException(message, 'AbortError');
}

async function conditionText(condition) {
  if (typeof condition === 'string') return condition;
  if (!condition || typeof condition !== 'object') return String(condition ?? '');
  try {
    if (typeof condition.get === 'function') {
      const message = await condition.get('message');
      const value = typeof message?.toJs === 'function' ? await message.toJs() : message;
      if (typeof value === 'string') return value;
      if (value?.message) return String(value.message);
      if (Array.isArray(value?.values) && value.values.length) return String(value.values[0]);
    }
    const value = typeof condition.toJs === 'function' ? await condition.toJs() : condition;
    if (typeof value === 'string') return value;
    if (value?.message) return String(value.message);
    if (Array.isArray(value?.values) && value.values.length) return String(value.values[0]);
    return String(value ?? '');
  } catch {
    return condition?.message ? String(condition.message) : 'R condition';
  }
}

function withTerminalInput(source) {
  return `
.ycoders_stdin_connection <- file("/tmp/ycoders-stdin", open = "r")
.ycoders_base_readLines <- base::readLines
readLines <- function(con = stdin(), n = -1L, ok = TRUE, warn = TRUE, encoding = "unknown", skipNul = FALSE) {
  if (is.character(con) && length(con) == 1L && identical(con, "stdin")) {
    .ycoders_base_readLines(.ycoders_stdin_connection, n = n, ok = ok, warn = warn, encoding = encoding, skipNul = skipNul)
  } else {
    .ycoders_base_readLines(con, n = n, ok = ok, warn = warn, encoding = encoding, skipNul = skipNul)
  }
}
readline <- function(prompt = "") {
  value <- .ycoders_base_readLines(.ycoders_stdin_connection, n = 1L, warn = FALSE)
  if (length(value)) value[[1L]] else ""
}
${String(source ?? '')}
`;
}

async function normalizeCapturedOutput(output = []) {
  const stdout = [];
  const stderr = [];
  const warnings = [];
  const conditions = [];
  let hasError = false;

  for (const item of output) {
    const type = String(item?.type ?? '');
    const text = await conditionText(item?.data);
    if (!text) continue;
    if (type === 'stdout') stdout.push(text);
    else if (type === 'warning') {
      warnings.push(text);
      conditions.push({ type, message: text });
    } else if (type === 'message') {
      stderr.push(text);
      conditions.push({ type, message: text });
    }
    else if (type === 'stderr') stderr.push(text);
    else if (type === 'error') {
      hasError = true;
      stderr.push(text);
      conditions.push({ type, message: text });
    }
    else conditions.push({ type, message: text });
  }

  return { stdout, stderr, warnings, conditions, hasError };
}

function waitForInitialization(webR, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => {
      webR.close();
      finish(reject, abortError());
    };
    const timer = timeoutMs > 0
      ? setTimeout(() => {
        webR.close();
        finish(reject, new Error(`R initialization exceeded ${timeoutMs} ms.`));
      }, timeoutMs)
      : null;
    signal?.addEventListener('abort', abort, { once: true });
    webR.init().then(
      () => finish(resolve),
      (error) => finish(reject, error),
    );
  });
}

export class WebRClient {
  constructor({
    timeoutMs = R_EXECUTION_TIMEOUT_MS,
    initializationTimeoutMs = R_INITIALIZATION_TIMEOUT_MS,
    baseUrl = getWebRBaseUrl(),
    loadWebR = () => import('webr'),
  } = {}) {
    this.timeoutMs = timeoutMs;
    this.initializationTimeoutMs = initializationTimeoutMs;
    this.baseUrl = baseUrl;
    this.loadWebR = loadWebR;
    this.activeWebR = null;
    this.cancelActive = null;
  }

  async initialize() {}

  async execute({ source, stdin = '', signal, timeoutMs = this.timeoutMs }) {
    if (signal?.aborted) throw abortError();
    this.reset();
    const { WebR, ChannelType } = await this.loadWebR();
    if (signal?.aborted) throw abortError();

    const webR = new WebR({
      baseUrl: this.baseUrl,
      channelType: ChannelType.PostMessage,
      interactive: true,
    });
    this.activeWebR = webR;
    await waitForInitialization(webR, signal, this.initializationTimeoutMs);
    if (this.activeWebR !== webR) throw abortError();

    const input = (Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''))
      .replace(/\r\n?/g, '\n');
    const inputFile = input && !input.endsWith('\n') ? `${input}\n` : input;
    await webR.FS.writeFile('/tmp/ycoders-stdin', new TextEncoder().encode(inputFile));

    const startedAt = performance.now();
    try {
      const captured = await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          if (this.cancelActive === abort) this.cancelActive = null;
          callback(value);
        };
        const abort = () => {
          webR.close();
          finish(reject, abortError());
        };
        const timer = timeoutMs > 0
          ? setTimeout(() => {
            webR.close();
            finish(reject, new Error(`R execution exceeded ${timeoutMs} ms.`));
          }, timeoutMs)
          : null;
        signal?.addEventListener('abort', abort, { once: true });
        this.cancelActive = abort;
        webR.evalRVoid('rm(list = ls(envir = .GlobalEnv), envir = .GlobalEnv)')
          .then(() => webR.globalShelter.captureR(withTerminalInput(source), {
            withAutoprint: true,
            captureStreams: true,
            captureConditions: true,
            captureGraphics: false,
            throwJsException: false,
          }))
          .then((value) => finish(resolve, value), (error) => finish(reject, error));
      });
      const streams = await normalizeCapturedOutput(captured.output);
      return {
        status: streams.hasError ? 'error' : 'success',
        stdout: streams.stdout.join('\n'),
        stderr: streams.stderr.join('\n'),
        warnings: streams.warnings,
        exitCode: null,
        executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
        r: {
          evaluationStatus: streams.hasError ? 'error' : 'success',
          conditions: streams.conditions,
        },
      };
    } catch (error) {
      if (error?.name === 'AbortError' || /exceeded \d+ ms/.test(error?.message ?? '')) throw error;
      return {
        status: 'error',
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        warnings: [],
        exitCode: null,
        executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
      };
    } finally {
      webR.close();
      if (this.activeWebR === webR) this.activeWebR = null;
      this.cancelActive = null;
    }
  }

  reset() {
    if (this.cancelActive) {
      this.cancelActive();
      return;
    }
    this.activeWebR?.close();
    this.activeWebR = null;
  }

  dispose() {
    this.reset();
  }
}
