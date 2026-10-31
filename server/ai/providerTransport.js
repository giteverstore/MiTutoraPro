import { AIServiceError } from './AIServiceError.js';

export const DEFAULT_PROVIDER_TIMEOUT_MS = 45_000;
export const MAX_PROVIDER_ERROR_BYTES = 4_096;
const PROVIDER_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const PROVIDER_CODE_ALLOWLIST = new Map([
  ['content_filter', Object.freeze({
    providerCode: 'provider-content-policy',
    providerClassification: 'safety-rejected',
  })],
]);
const SANITIZED_PROVIDER_CODE_ALLOWLIST = new Map(
  [...PROVIDER_CODE_ALLOWLIST.values()].map((entry) => [entry.providerCode, entry]),
);
const PROVIDER_CLASSIFICATION_ALLOWLIST = new Set([
  'authentication-failed', 'model-unavailable', 'timeout', 'rate-limited',
  'transient-provider-error', 'request-rejected', 'safety-rejected', 'invalid-json',
  'schema-validation-failed', 'release-policy-failed', 'suspected-truncation', 'unknown',
]);
const PROVIDER_FINISH_REASON_ALLOWLIST = new Set(['stop', 'length', 'content_filter', 'tool_calls', 'unknown']);
const VALIDATION_RULE_ALLOWLIST = new Set(['required', 'type', 'enum', 'minLength', 'maxLength', 'maxItems', 'controlCharacters']);
const PROJECT_VALIDATION_REASON_ALLOWLIST = new Set([
  'provider-envelope-invalid', 'assistant-text-not-json', 'operation-mismatch',
  'answer-missing', 'answer-empty', 'answer-too-long', 'followups-missing',
  'followups-not-array', 'followups-too-many', 'followup-invalid',
  'duplicate-followup-id', 'questions-missing', 'questions-not-array',
  'questions-too-few', 'questions-too-many', 'question-invalid', 'duplicate-question-id',
  'suspected-truncation',
]);
const VALIDATION_TYPE_ALLOWLIST = new Set(['array', 'object', 'string', 'number', 'boolean', 'null', 'undefined']);
const SAFE_SCHEMA_PATHS = Object.freeze([
  /^(?:schemaVersion|policyVersion|operation|summary|evidence|sections|codeReferences|concepts|issues|nextStep)$/u,
  /^(?:answer|followUps|questions)$/u,
  /^(?:followUps|questions)\.\d+\.(?:id|label|intent)$/u,
  /^evidence\.(?:basis|note)$/u,
  /^sections\.\d+\.(?:title|body)$/u,
  /^codeReferences\.\d+\.(?:startLine|endLine|explanation)$/u,
  /^concepts\.\d+\.(?:name|explanation)$/u,
  /^issues\.\d+\.(?:title|explanation|hintLevel|codeReference)$/u,
  /^issues\.\d+\.codeReference\.(?:startLine|endLine)$/u,
  /^nextStep\.(?:kind|text)$/u,
]);
const SAFE_SCHEMA_FIELDS = new Set([
  'schemaVersion', 'policyVersion', 'operation', 'evidence', 'basis', 'note', 'summary',
  'sections', 'title', 'body', 'codeReferences', 'startLine', 'endLine', 'explanation',
  'concepts', 'name', 'issues', 'hintLevel', 'codeReference', 'nextStep', 'kind', 'text',
  'answer', 'followUps', 'questions', 'id', 'label', 'intent',
]);
const DECLARED_MIME_TYPE_ALLOWLIST = new Set(['application/json']);
const STRUCTURED_OUTPUT_MODE_ALLOWLIST = new Set(['json-object', 'json-schema', 'tool', 'unknown']);

function safeProviderStatus(status) {
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function statusClassification(status) {
  if (status === 401 || status === 403) return 'authentication-failed';
  if (status === 404) return 'model-unavailable';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate-limited';
  if (status >= 500 && status <= 599) return 'transient-provider-error';
  if (status >= 400 && status <= 499) return 'request-rejected';
  return 'unknown';
}

function sanitizeProviderCode(value) {
  if (typeof value !== 'string') return null;
  return PROVIDER_CODE_ALLOWLIST.get(value) ?? null;
}

function extractAllowlistedCode(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const error = payload.error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
  return sanitizeProviderCode(error.code) ?? sanitizeProviderCode(error.type);
}

function readProviderRequestId(response) {
  try {
    const value = response?.headers?.get?.('x-request-id');
    return typeof value === 'string' && PROVIDER_REQUEST_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

async function readBoundedProviderError(response, maximumBytes) {
  const reader = response?.body?.getReader?.();
  if (!reader) return null;
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      if (!ArrayBuffer.isView(part.value) || typeof part.value.byteLength !== 'number') return null;
      const chunk = new Uint8Array(part.value.buffer, part.value.byteOffset, part.value.byteLength);
      byteLength += chunk.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock?.();
  }
}

export function createProviderDiagnostic(status, allowlistedCode = null, providerRequestId = null) {
  const providerStatus = safeProviderStatus(status);
  const code = typeof allowlistedCode === 'string'
    ? PROVIDER_CODE_ALLOWLIST.get(allowlistedCode) ?? SANITIZED_PROVIDER_CODE_ALLOWLIST.get(allowlistedCode) ?? null
    : SANITIZED_PROVIDER_CODE_ALLOWLIST.get(allowlistedCode?.providerCode) ?? null;
  const statusBasedClassification = statusClassification(providerStatus);
  return Object.freeze({
    providerStatus,
    providerCode: code?.providerCode ?? 'unknown',
    providerClassification: statusBasedClassification === 'request-rejected' && code
      ? code.providerClassification
      : statusBasedClassification,
    ...(typeof providerRequestId === 'string' && PROVIDER_REQUEST_ID_PATTERN.test(providerRequestId)
      ? { providerRequestId }
      : {}),
  });
}

export async function inspectProviderRejection(response, { maximumBytes = MAX_PROVIDER_ERROR_BYTES } = {}) {
  const payload = Number.isInteger(maximumBytes) && maximumBytes > 0
    ? await readBoundedProviderError(response, maximumBytes)
    : null;
  return createProviderDiagnostic(response?.status, extractAllowlistedCode(payload), readProviderRequestId(response));
}

export function createProviderSignal(signal, timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const relayAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) relayAbort();
  else signal?.addEventListener('abort', relayAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException('The AI Tutor provider request timed out.', 'TimeoutError'));
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', relayAbort);
    },
  };
}

export function providerTransportError(error, request, callerSignal) {
  if (callerSignal?.aborted && !request.didTimeOut()) return error;
  if (request.didTimeOut()) {
    return new AIServiceError('ai/provider-timeout', 'The AI Tutor took too long to respond. Please try again.', { status: 504, cause: error });
  }
  return new AIServiceError('ai/provider-unavailable', 'The AI Tutor could not be reached. Please try again.', { status: 502, cause: error });
}

export function providerHttpError(status, providerDiagnostic = createProviderDiagnostic(status)) {
  let error;
  if (status === 401 || status === 403) {
    error = new AIServiceError('ai/provider-auth', 'The AI Tutor is not configured yet.', { status: 503 });
  }
  else if (status === 404) {
    error = new AIServiceError('ai/model-unavailable', 'The AI Tutor is not configured yet.', { status: 503 });
  }
  else if (status === 429) {
    error = new AIServiceError('ai/provider-rate-limited', 'The AI Tutor is busy right now. Try again shortly.', { status: 429 });
  }
  else if (status === 408) {
    error = new AIServiceError('ai/provider-timeout', 'The AI Tutor took too long to respond. Please try again.', { status: 504 });
  }
  else if (status >= 500) {
    error = new AIServiceError('ai/provider-unavailable', 'The AI Tutor could not be reached. Please try again.', { status: 502 });
  }
  else if (Number.isInteger(status) && status >= 400 && status < 500) {
    error = new AIServiceError('ai/provider-rejected', 'The AI Tutor provider rejected this explanation request.', { status: 502 });
  }
  else {
    error = new AIServiceError('ai/provider-failed', 'The AI Tutor could not complete this explanation. Please try again.', { status: 502 });
  }
  error.providerDiagnostic = createProviderDiagnostic(status, providerDiagnostic, providerDiagnostic?.providerRequestId);
  return error;
}

export function createProviderFailureLog({ provider, model, diagnostic, durationMs } = {}) {
  if (!diagnostic || typeof diagnostic !== 'object') return null;
  const event = { operation: 'ai-tutor-provider-request' };
  if (typeof provider === 'string' && provider) event.provider = provider.slice(0, 80);
  if (typeof model === 'string' && model) event.model = model.slice(0, 160);
  if (Number.isInteger(diagnostic.providerStatus) && diagnostic.providerStatus >= 100 && diagnostic.providerStatus <= 599) {
    event.providerStatus = diagnostic.providerStatus;
  }
  if (SANITIZED_PROVIDER_CODE_ALLOWLIST.has(diagnostic.providerCode) || diagnostic.providerCode === 'unknown') {
    event.providerCode = diagnostic.providerCode;
  }
  if (PROVIDER_CLASSIFICATION_ALLOWLIST.has(diagnostic.providerClassification)) {
    event.providerClassification = diagnostic.providerClassification;
  }
  if (typeof diagnostic.providerRequestId === 'string' && PROVIDER_REQUEST_ID_PATTERN.test(diagnostic.providerRequestId)) {
    event.providerRequestId = diagnostic.providerRequestId;
  }
  if (typeof diagnostic.fetchAborted === 'boolean') event.fetchAborted = diagnostic.fetchAborted;
  if (PROVIDER_FINISH_REASON_ALLOWLIST.has(diagnostic.finishReason)) event.finishReason = diagnostic.finishReason;
  if (Number.isInteger(diagnostic.outputTokens) && diagnostic.outputTokens >= 0) event.outputTokens = diagnostic.outputTokens;
  if (Number.isInteger(diagnostic.maxOutputTokens) && diagnostic.maxOutputTokens > 0) event.maxOutputTokens = diagnostic.maxOutputTokens;
  if (typeof diagnostic.jsonParseSucceeded === 'boolean') event.jsonParseSucceeded = diagnostic.jsonParseSucceeded;
  if (typeof diagnostic.providerEnvelopeParsed === 'boolean') event.providerEnvelopeParsed = diagnostic.providerEnvelopeParsed;
  if (typeof diagnostic.assistantTextJsonParsed === 'boolean') event.assistantTextJsonParsed = diagnostic.assistantTextJsonParsed;
  if (typeof diagnostic.schemaValidationSucceeded === 'boolean') event.schemaValidationSucceeded = diagnostic.schemaValidationSucceeded;
  if (PROJECT_VALIDATION_REASON_ALLOWLIST.has(diagnostic.validationReason)) event.validationReason = diagnostic.validationReason;
  if (typeof diagnostic.releasePolicyClassification === 'string' && /^[a-z0-9-]{1,80}$/u.test(diagnostic.releasePolicyClassification)) event.releasePolicyClassification = diagnostic.releasePolicyClassification;
  if (typeof diagnostic.validationPath === 'string' && diagnostic.validationPath.length <= 120 && SAFE_SCHEMA_PATHS.some((pattern) => pattern.test(diagnostic.validationPath))) event.validationPath = diagnostic.validationPath;
  if (VALIDATION_RULE_ALLOWLIST.has(diagnostic.validationRule)) event.validationRule = diagnostic.validationRule;
  if (VALIDATION_TYPE_ALLOWLIST.has(diagnostic.expectedType)) event.expectedType = diagnostic.expectedType;
  if (VALIDATION_TYPE_ALLOWLIST.has(diagnostic.actualType)) event.actualType = diagnostic.actualType;
  if (SAFE_SCHEMA_FIELDS.has(diagnostic.missingField)) event.missingField = diagnostic.missingField;
  if (SAFE_SCHEMA_FIELDS.has(diagnostic.topLevelField)) event.topLevelField = diagnostic.topLevelField;
  if (Number.isInteger(diagnostic.candidateCount) && diagnostic.candidateCount >= 0 && diagnostic.candidateCount <= 100) event.candidateCount = diagnostic.candidateCount;
  if (Number.isInteger(diagnostic.outputCount) && diagnostic.outputCount >= 0 && diagnostic.outputCount <= 100) event.outputCount = diagnostic.outputCount;
  if (DECLARED_MIME_TYPE_ALLOWLIST.has(diagnostic.declaredMimeType)) event.declaredMimeType = diagnostic.declaredMimeType;
  if (Number.isInteger(diagnostic.responseCharacters) && diagnostic.responseCharacters >= 0) event.responseCharacters = diagnostic.responseCharacters;
  if (Number.isInteger(diagnostic.attemptCount) && diagnostic.attemptCount >= 1 && diagnostic.attemptCount <= 2) event.attemptCount = diagnostic.attemptCount;
  if (diagnostic.retryReason === 'truncation') event.retryReason = diagnostic.retryReason;
  if (PROVIDER_FINISH_REASON_ALLOWLIST.has(diagnostic.firstFinishReason)) event.firstFinishReason = diagnostic.firstFinishReason;
  if (PROVIDER_FINISH_REASON_ALLOWLIST.has(diagnostic.finalFinishReason)) event.finalFinishReason = diagnostic.finalFinishReason;
  if (Number.isInteger(diagnostic.firstOutputTokens) && diagnostic.firstOutputTokens >= 0) event.firstOutputTokens = diagnostic.firstOutputTokens;
  if (Number.isInteger(diagnostic.finalOutputTokens) && diagnostic.finalOutputTokens >= 0) event.finalOutputTokens = diagnostic.finalOutputTokens;
  if (STRUCTURED_OUTPUT_MODE_ALLOWLIST.has(diagnostic.structuredOutputMode)) event.structuredOutputMode = diagnostic.structuredOutputMode;
  if (Number.isFinite(durationMs) && durationMs >= 0) event.durationMs = Math.round(durationMs);
  return Object.freeze(event);
}
