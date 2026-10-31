import { Buffer } from 'node:buffer';
import { createAIProvider } from '../createAIProvider.js';
import { AIServiceError } from '../AIServiceError.js';
import { classifyAIError } from '../aiErrorTaxonomy.js';
import { tutorTelemetry } from '../tutor/tutorTelemetry.js';
import { combineProviderUsage, createTutorUsagePlan, normalizeProviderUsage, usageFitsReservation } from '../tutor/tutorUsage.js';
import { createTutorPricingConfiguration, createTutorProviderTokenConstraints } from '../tutor/tutorRuntimeConfig.js';
import { normalizeProjectMentorRequest, createProjectMentorProviderRequest } from './projectMentorRequest.js';
import { validateProjectMentorResponse } from './projectMentorSchema.js';
import { createProviderFailureLog } from '../providerTransport.js';
import { executeProviderWithTruncationRetry } from '../providerExecution.js';

const ZERO_USAGE = Object.freeze({ inputTokens: 0, outputTokens: 0, costMicros: 0 });

function safeFinishReason(value) {
  const normalized = String(value ?? 'unknown').toLowerCase();
  if (normalized === 'stop') return 'stop';
  if (normalized === 'length' || normalized === 'max_tokens') return 'length';
  if (normalized === 'content_filter' || normalized === 'safety' || normalized === 'prohibited_content') return 'content_filter';
  if (normalized === 'tool_calls') return 'tool_calls';
  return 'unknown';
}

function attachProjectResponseDiagnostic(error, result, providerRequest, reason = error?.validationReason) {
  if (!error || typeof error !== 'object') return error;
  const envelopeParsed = Boolean(result && typeof result === 'object' && !Array.isArray(result) && typeof result.text === 'string');
  const parsedJson = envelopeParsed && reason !== 'assistant-text-not-json' && reason !== 'provider-envelope-invalid' && reason !== 'suspected-truncation';
  error.providerDurationMs = Number.isFinite(result?.providerDurationMs) ? result.providerDurationMs : error.providerDurationMs;
  error.providerDiagnostic = Object.freeze({
    ...(error.providerDiagnostic ?? {}),
    ...(Number.isInteger(result?.providerStatus) ? { providerStatus: result.providerStatus } : {}),
    providerClassification: reason === 'suspected-truncation' ? 'suspected-truncation' : reason === 'assistant-text-not-json' ? 'invalid-json' : 'schema-validation-failed',
    finishReason: safeFinishReason(result?.finishReason),
    maxOutputTokens: result?.retryDiagnostic?.attemptCount === 2
      ? providerRequest?.retryMaxProviderTokens
      : providerRequest?.maxProviderTokens,
    providerEnvelopeParsed: envelopeParsed,
    assistantTextJsonParsed: parsedJson,
    jsonParseSucceeded: parsedJson,
    schemaValidationSucceeded: false,
    validationReason: reason,
    ...(error.validationDiagnostic ?? {}),
    responseCharacters: Number.isInteger(result?.responseCharacters) ? result.responseCharacters : typeof result?.text === 'string' ? result.text.length : 0,
    ...(Number.isInteger(result?.candidateCount) ? { candidateCount: result.candidateCount } : {}),
    ...(Number.isInteger(result?.outputCount) ? { outputCount: result.outputCount } : {}),
    ...(typeof result?.declaredMimeType === 'string' ? { declaredMimeType: result.declaredMimeType } : {}),
    ...(result?.retryDiagnostic ?? {}),
  });
  return error;
}

export async function explainProjectMentor(body, { principal, signal, quotaGuard, featureGate, providerFactory = createAIProvider, telemetry = tutorTelemetry, pricing, providerTokenConstraints, providerFailureLogger = console.error, cachedResponse = null, cacheEligible = false } = {}) {
  if (!principal?.uid) throw new AIServiceError('ai/auth-required', 'Sign in to use the AI Tutor.', { status: 401 });
  const startedAt = Date.now();
  let operation;
  let reservation;
  let providerInvoked = false;
  let usage;
  let usageMaximum = ZERO_USAGE;
  let resolvedPricing;
  let providerRequest;
  let providerResult;
  let usagePlan;
  let providerAttemptCount = 0;
  let metadata = { provider: 'unknown', model: 'unknown' };
  const settleQuota = async (outcome) => {
    if (!reservation) return;
    const fallbackMaximum = usagePlan?.attemptMaximums?.[Math.max(0, providerAttemptCount - 1)] ?? usageMaximum;
    const charge = providerInvoked
      ? usage?.tokenUsageKnown === true ? usage : { ...fallbackMaximum, tokenUsageKnown: false, costKnown: resolvedPricing?.known === true }
      : { ...ZERO_USAGE, tokenUsageKnown: true, costKnown: true };
    await quotaGuard.settle(reservation, {
      inputTokens: charge.inputTokens,
      outputTokens: charge.outputTokens,
      costMicros: charge.costMicros,
      chargeEstimate: false,
      outcome,
    });
    reservation = null;
  };
  try {
    await featureGate.assertEnabled({ uid: principal.uid, activityHint: 'project', requestBody: body });
    const request = normalizeProjectMentorRequest(body);
    operation = request.operation;
    providerRequest = createProjectMentorProviderRequest(request);
    resolvedPricing = pricing ?? createTutorPricingConfiguration();
    usagePlan = createTutorUsagePlan(providerRequest, resolvedPricing, providerTokenConstraints ?? createTutorProviderTokenConstraints());
    usageMaximum = usagePlan.maximum;
    reservation = await quotaGuard.assertAllowed({ uid: principal.uid, usageEstimate: usagePlan.estimate, usageMaximum: usagePlan.maximum });
    if (cachedResponse) { await settleQuota('cache-hit'); telemetry.record({ operation, latencyMs: Date.now() - startedAt, httpStatus: 200, success: true, quotaDecision: 'allowed', cacheEligible: true, cacheHit: true, cacheType: 'exact' }); return cachedResponse; }
    const provider = providerFactory();
    metadata = provider.getMetadata?.() ?? metadata;
    providerInvoked = true;
    let execution;
    try { execution = await executeProviderWithTruncationRetry(provider, providerRequest, { signal }); }
    catch (error) {
      providerAttemptCount = error?.providerAttemptCount ?? 1;
      throw error;
    }
    providerAttemptCount = execution.attempts.length;
    providerResult = Object.freeze({ ...execution.result, retryDiagnostic: execution.diagnostic });
    usage = combineProviderUsage(execution.attempts.map((attempt, index) => normalizeProviderUsage({ inputTokens: attempt?.usage?.input_tokens ?? attempt?.usage?.prompt_tokens, outputTokens: attempt?.usage?.output_tokens ?? attempt?.usage?.completion_tokens, cachedInputTokens: attempt?.usage?.prompt_tokens_details?.cached_tokens ?? attempt?.usage?.cached_input_tokens }, usagePlan.attemptEstimates[index] ?? usagePlan.estimate, resolvedPricing)), resolvedPricing);
    if (!usageFitsReservation(usage, reservation ?? { maximum: plan.maximum })) {
      throw new AIServiceError('ai/quota-integrity', 'The AI Tutor usage report exceeded its authorized reservation.', { status: 503 });
    }
    let response;
    try {
      if (providerResult?.finishReason === 'length') {
        const truncated = new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502 });
        truncated.validationReason = 'suspected-truncation';
        throw truncated;
      }
      if (!providerResult || typeof providerResult !== 'object' || Array.isArray(providerResult) || typeof providerResult.text !== 'string') {
        const invalid = new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502 });
        invalid.validationReason = 'provider-envelope-invalid';
        invalid.validationDiagnostic = Object.freeze({ validationReason: 'provider-envelope-invalid', validationRule: 'type' });
        throw invalid;
      }
      response = validateProjectMentorResponse(providerResult.text, request.operation);
    } catch (error) {
      throw attachProjectResponseDiagnostic(error, providerResult, providerRequest);
    }
    await settleQuota('success');
    telemetry.record({ ...metadata, operation, latencyMs: Date.now() - startedAt, httpStatus: 200, success: true, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.inputTokens + usage.outputTokens, cachedInputTokens: usage.cachedInputTokens, estimatedCostMicros: usage.costMicros, costKnown: usage.costKnown, responseBytes: Buffer.byteLength(JSON.stringify(response), 'utf8'), quotaDecision: 'allowed', cacheEligible, cacheHit: false, cacheType: 'none' });
    return response;
  } catch (error) {
    let normalizedError = error?.name === 'AbortError' ? new AIServiceError('ai/cancelled', 'The explanation was cancelled.', { status: 499, cause: error }) : error;
    if (normalizedError?.code === 'ai/provider-response-invalid'
      && (!normalizedError.providerDiagnostic || normalizedError.validationReason === 'provider-payload-invalid')) {
      normalizedError.validationReason = 'provider-envelope-invalid';
      normalizedError.validationDiagnostic = Object.freeze({ validationReason: 'provider-envelope-invalid', validationRule: 'type' });
      normalizedError = attachProjectResponseDiagnostic(normalizedError, providerResult, providerRequest, 'provider-envelope-invalid');
    }
    const classification = classifyAIError(normalizedError);
    const providerFailure = createProviderFailureLog({
      ...metadata,
      diagnostic: normalizedError?.providerDiagnostic,
      durationMs: Number.isFinite(normalizedError?.providerDurationMs) ? normalizedError.providerDurationMs : Date.now() - startedAt,
    });
    if (providerFailure) {
      try { providerFailureLogger(providerFailure); }
      catch { /* Diagnostic logging must never alter the learner response. */ }
    }
    await settleQuota(classification.code);
    telemetry.record({ ...metadata, operation, latencyMs: Date.now() - startedAt, httpStatus: classification.status, retryable: classification.retryable, success: false, errorCategory: classification.code, quotaDecision: classification.code === 'ai/rate-limited' ? 'rejected' : 'allowed' });
    throw normalizedError;
  }
}
