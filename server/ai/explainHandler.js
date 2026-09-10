import { Buffer } from 'node:buffer';
import { AIServiceError } from './AIServiceError.js';
import { createAIProvider } from './createAIProvider.js';
import { createTutorProviderRequest } from './tutor/tutorPrompt.js';
import { normalizeTutorRequest } from './tutor/tutorRequest.js';
import { validateTutorResponse } from './tutor/tutorResponseSchema.js';
import { tutorRequestCoordinator } from './tutor/tutorRequestCoordinator.js';
import { tutorTelemetry } from './tutor/tutorTelemetry.js';
import { activityHintFromRequest, trustedActivityPolicyResolver } from './tutor/tutorActivityPolicy.js';
import { createTutorIdentityKey } from './tutor/tutorRateLimiter.js';
import { tutorQuotaGuard } from './tutor/tutorQuota.js';
import { tutorResponseReleasePolicy } from './tutor/tutorResponsePolicy.js';
import { tutorSensitiveContentInspector } from './tutor/tutorSensitiveContent.js';
import { classifyAIError } from './aiErrorTaxonomy.js';
import { tutorFeatureGate } from './tutor/tutorFeatureGate.js';
import { createTutorPricingConfiguration, createTutorProviderTokenConstraints } from './tutor/tutorRuntimeConfig.js';
import { createTutorUsagePlan, normalizeProviderUsage, usageFitsReservation } from './tutor/tutorUsage.js';

const ZERO_USAGE = Object.freeze({ inputTokens: 0, outputTokens: 0, costMicros: 0 });

export function normalizeExplainRequest(body, options) {
  return normalizeTutorRequest(body, options);
}

export async function explainCode(body, {
  providerFactory = createAIProvider,
  signal,
  principal,
  trustedNetworkKey = '',
  quotaGuard = tutorQuotaGuard,
  rateLimiter,
  activityPolicyResolver = trustedActivityPolicyResolver,
  requestCoordinator = tutorRequestCoordinator,
  telemetry = tutorTelemetry,
  releasePolicy = tutorResponseReleasePolicy,
  sensitiveContentInspector = tutorSensitiveContentInspector,
  featureGate = tutorFeatureGate,
  pricing,
  providerTokenConstraints,
} = {}) {
  if (!principal?.uid) throw new AIServiceError('ai/auth-required', 'Sign in to use the AI Tutor.', { status: 401 });
  const startedAt = Date.now();
  const activityHint = activityHintFromRequest(body);
  let featureDecision = { state: 'unknown', bucket: null, version: 'unknown' };
  let quotaDecision = 'not-evaluated';
  let reservation = null;
  let context = null;
  let metadata = { provider: 'unknown', model: 'unknown' };
  let providerInvoked = false;
  let usage = null;
  let usageEstimate = ZERO_USAGE;
  let usageMaximum = ZERO_USAGE;
  let usageExceededReservation = false;

  const settleQuota = async (outcome) => {
    if (!reservation || rateLimiter) return;
    const normalized = usage ?? Object.freeze({
      ...usageMaximum,
      tokenUsageKnown: false,
      costKnown: pricing?.known === true,
    });
    const charge = providerInvoked ? normalized : Object.freeze({
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      tokenUsageKnown: true,
      costKnown: true,
    });
    const settled = await quotaGuard.settle(reservation, {
      inputTokens: charge.inputTokens,
      outputTokens: charge.outputTokens,
      costMicros: charge.costMicros,
      chargeEstimate: providerInvoked && (charge.tokenUsageKnown !== true || usageExceededReservation),
      outcome,
    });
    if (settled === false) quotaDecision = 'settlement-failed';
  };

  try {
    featureDecision = await featureGate.assertEnabled({ uid: principal.uid, activityHint, requestBody: body });
    const resolvedPricing = pricing ?? createTutorPricingConfiguration();
    const resolvedConstraints = providerTokenConstraints ?? createTutorProviderTokenConstraints();
    const activityPolicy = await activityPolicyResolver.resolve({ principal, activityHint });
    let providerRequest;
    try {
      context = sensitiveContentInspector.inspect(normalizeExplainRequest(body, { activityPolicy }));
      providerRequest = createTutorProviderRequest(context);
      const usagePlan = createTutorUsagePlan(providerRequest, resolvedPricing, resolvedConstraints);
      usageEstimate = usagePlan.estimate;
      usageMaximum = usagePlan.maximum;
    } catch (preProviderError) {
      if (rateLimiter) rateLimiter.assertAllowed(createTutorIdentityKey(principal.uid, trustedNetworkKey));
      else reservation = await quotaGuard.assertAllowed({ uid: principal.uid, usageEstimate: ZERO_USAGE, usageMaximum: ZERO_USAGE });
      quotaDecision = 'allowed';
      throw preProviderError;
    }
    if (rateLimiter) rateLimiter.assertAllowed(createTutorIdentityKey(principal.uid, trustedNetworkKey));
    else reservation = await quotaGuard.assertAllowed({ uid: principal.uid, usageEstimate, usageMaximum });
    quotaDecision = 'allowed';
    const provider = providerFactory();
    metadata = provider.getMetadata?.() ?? metadata;
    const requestKey = createTutorIdentityKey(principal.uid, trustedNetworkKey);
    const response = await requestCoordinator.run(context, requestKey, async () => {
      providerInvoked = true;
      const result = await provider.explain(providerRequest, { signal });
      usage = normalizeProviderUsage({
        inputTokens: result?.usage?.input_tokens ?? result?.usage?.prompt_tokens,
        outputTokens: result?.usage?.output_tokens ?? result?.usage?.completion_tokens,
      }, usageEstimate, resolvedPricing);
      if (!usageFitsReservation(usage, reservation ?? { maximum: usageMaximum })) {
        usageExceededReservation = true;
        throw new AIServiceError('ai/quota-integrity', 'The AI Tutor usage report exceeded its authorized reservation.', { status: 503 });
      }
      const structured = validateTutorResponse(result?.text, context);
      return releasePolicy.assertReleasable(structured, context);
    });
    await settleQuota('success');
    telemetry.record({
      ...metadata,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage ? usage.inputTokens + usage.outputTokens : undefined,
      estimatedCostMicros: usage?.costMicros,
      costKnown: usage?.costKnown,
      operation: context.operation,
      latencyMs: Date.now() - startedAt,
      httpStatus: 200,
      success: true,
      quotaDecision,
      featureFlagState: featureDecision.state,
      rolloutBucket: featureDecision.bucket ?? undefined,
      rolloutVersion: featureDecision.version,
      responseBytes: Buffer.byteLength(JSON.stringify(response), 'utf8'),
    });
    return response;
  } catch (error) {
    const normalizedError = error?.name === 'AbortError'
      ? new AIServiceError('ai/cancelled', 'The explanation was cancelled.', { status: 499, cause: error })
      : error;
    const classification = classifyAIError(normalizedError);
    if (classification.code === 'ai/rate-limited') quotaDecision = 'rejected';
    else if (classification.code === 'ai/quota-unavailable') quotaDecision = 'unavailable';
    await settleQuota(classification.code);
    telemetry.record({
      ...metadata,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage ? usage.inputTokens + usage.outputTokens : undefined,
      estimatedCostMicros: usage?.costMicros,
      costKnown: usage?.costKnown,
      operation: context?.operation,
      latencyMs: Date.now() - startedAt,
      httpStatus: classification.status,
      retryable: classification.retryable,
      success: false,
      errorCategory: classification.code,
      quotaDecision,
      featureFlagState: normalizedError?.featureDecision?.state ?? featureDecision.state,
      rolloutBucket: normalizedError?.featureDecision?.bucket ?? featureDecision.bucket ?? undefined,
      rolloutVersion: normalizedError?.featureDecision?.version ?? featureDecision.version,
    });
    throw normalizedError;
  }
}

export function publicAIError(error, { includeDiagnostics = false } = {}) {
  if (error instanceof AIServiceError) {
    const classification = classifyAIError(error);
    const diagnostic = includeDiagnostics && typeof error.validationReason === 'string'
      ? { diagnostic: error.validationReason }
      : {};
    return { status: classification.status, body: { error: { code: classification.code, message: error.publicMessage, retryable: classification.retryable, ...diagnostic } } };
  }
  return { status: 500, body: { error: { code: 'ai/unavailable', message: 'The AI Tutor is temporarily unavailable.', retryable: false } } };
}
