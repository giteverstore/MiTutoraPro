import {
  R_EXECUTION_TIMEOUT_MS,
  R_INITIALIZATION_TIMEOUT_MS,
  getWebRBaseUrl,
} from './rRuntimeConfig.js';
import {
  COMPILER_EXECUTION_EVENTS,
  INTERACTIVE_STDIN_WAIT_TIMEOUT_MS,
  compilerExecutionEvent,
} from '../../core/interactiveStdinProtocol.js';

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
    this.active = null;
    this.nextExecutionId = 1;
  }

  async initialize() {}

  async execute({ source, stdin = '', signal, timeoutMs = this.timeoutMs, executionId, onExecutionEvent }) {
    if (signal?.aborted) throw abortError();
    this.reset();
    const { WebR, ChannelType } = await this.loadWebR();
    if (signal?.aborted) throw abortError();

    const interactive = typeof onExecutionEvent === 'function'
      && typeof SharedArrayBuffer === 'function'
      && globalThis.crossOriginIsolated === true;
    const webR = new WebR({
      baseUrl: this.baseUrl,
      channelType: interactive ? ChannelType.SharedArrayBuffer : ChannelType.PostMessage,
      interactive: true,
    });
    this.activeWebR = webR;
    await waitForInitialization(webR, signal, this.initializationTimeoutMs);
    if (this.activeWebR !== webR) throw abortError();

    const input = (Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''))
      .replace(/\r\n?/g, '\n');
    if (interactive) {
      return this.executeInteractive({
        webR, source, input, signal, timeoutMs,
        executionId: String(executionId ?? `r-${this.nextExecutionId++}`),
        onExecutionEvent,
      });
    }
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

  async executeInteractive({ webR, source, input, signal, timeoutMs, executionId, onExecutionEvent }) {
    const startedAt = performance.now();
    await webR.evalRVoid('rm(list = ls(envir = .GlobalEnv), envir = .GlobalEnv)');
    await webR.flush();
    const bufferedLines = input ? input.split('\n') : [];
    if (bufferedLines.at(-1) === '') bufferedLines.pop();
    const completionMarker = `__YCODERS_R_COMPLETE_${executionId.replace(/[^a-zA-Z0-9]/g, '_')}__`;
    const encodedSource = JSON.stringify(String(source ?? ''));
    const command = `{ .ycoders_result <- try(eval(parse(text = ${encodedSource}, keep.source = TRUE), envir = .GlobalEnv), silent = FALSE); cat("\\n${completionMarker}\\n") }`;

    onExecutionEvent(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.START, executionId));
    return new Promise((resolve, reject) => {
      const stdout = [];
      const stderr = [];
      const warnings = [];
      let markerSeen = false;
      let settled = false;
      const active = {
        webR, executionId, onExecutionEvent, signal, timer: null, inputTimer: null,
        waiting: false, computeTimeoutMs: timeoutMs, resolve, reject,
      };
      this.active = active;

      const clearTimers = () => {
        clearTimeout(active.timer);
        clearTimeout(active.inputTimer);
        active.timer = null;
        active.inputTimer = null;
      };
      const close = () => {
        clearTimers();
        signal?.removeEventListener('abort', abort);
        webR.close();
        if (this.active === active) this.active = null;
        if (this.activeWebR === webR) this.activeWebR = null;
        if (this.active === null || this.active === active) this.cancelActive = null;
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        close();
        callback(value);
      };
      const fail = (reason) => {
        onExecutionEvent(compilerExecutionEvent(
          reason?.name === 'AbortError' ? COMPILER_EXECUTION_EVENTS.CANCELLED : COMPILER_EXECUTION_EVENTS.ERROR,
          executionId,
        ));
        finish(reject, reason);
      };
      const startComputeTimer = () => {
        clearTimeout(active.timer);
        if (timeoutMs > 0) {
          active.timer = setTimeout(() => fail(new Error(`R execution exceeded ${timeoutMs} ms.`)), timeoutMs);
        }
      };
      const abort = () => fail(abortError());
      this.cancelActive = (reason = abortError()) => fail(reason);
      signal?.addEventListener('abort', abort, { once: true });
      startComputeTimer();

      (async () => {
        try {
          for await (const message of webR.stream()) {
            if (settled) break;
            const type = String(message?.type ?? '');
            const value = String(message?.data ?? '');
            if (type === 'stdout') {
              if (value.includes(completionMarker)) {
                const visible = value.replace(completionMarker, '').replace(/^\n|\n$/g, '');
                if (visible) {
                  stdout.push(visible);
                  onExecutionEvent(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.STDOUT, executionId, { value: visible }));
                }
                markerSeen = true;
              } else {
                stdout.push(value);
                onExecutionEvent(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.STDOUT, executionId, { value }));
              }
              continue;
            }
            if (type === 'stderr') {
              stderr.push(value);
              if (/warning/i.test(value)) warnings.push(value);
              onExecutionEvent(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.STDERR, executionId, { value }));
              continue;
            }
            if (type !== 'prompt') continue;
            if (markerSeen && value === '> ') {
              const hasError = stderr.some((entry) => /(^|\n)Error\b/i.test(entry));
              onExecutionEvent(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.COMPLETE, executionId));
              finish(resolve, {
                status: hasError ? 'error' : 'success',
                stdout: stdout.filter(Boolean).join('\n'),
                stderr: stderr.filter(Boolean).join('\n'),
                warnings,
                exitCode: null,
                executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
                r: { evaluationStatus: hasError ? 'error' : 'success', conditions: [] },
              });
              break;
            }

            onExecutionEvent(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.STDOUT, executionId, { value }));
            clearTimeout(active.timer);
            active.timer = null;
            if (bufferedLines.length) {
              webR.writeConsole(bufferedLines.shift());
              startComputeTimer();
            } else {
              active.waiting = true;
              active.inputTimer = setTimeout(
                () => fail(new Error('R input wait exceeded 90 seconds.')),
                INTERACTIVE_STDIN_WAIT_TIMEOUT_MS,
              );
              onExecutionEvent(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.STDIN_REQUEST, executionId));
            }
          }
        } catch (error) {
          if (!settled) fail(error);
        }
      })();

      webR.writeConsole(command);
    });
  }

  submitStdin({ executionId, value }) {
    const active = this.active;
    if (!active || !active.waiting || active.executionId !== String(executionId ?? '')) return false;
    active.waiting = false;
    clearTimeout(active.inputTimer);
    active.inputTimer = null;
    active.webR.writeConsole(String(value ?? '').replace(/\r?\n$/, ''));
    clearTimeout(active.timer);
    if (active.computeTimeoutMs > 0) {
      active.timer = setTimeout(
        () => this.cancelActive?.(new Error(`R execution exceeded ${active.computeTimeoutMs} ms.`)),
        active.computeTimeoutMs,
      );
    }
    return true;
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
