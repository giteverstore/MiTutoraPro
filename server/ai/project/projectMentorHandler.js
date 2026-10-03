import { Buffer } from 'node:buffer';
import { createAIProvider } from '../createAIProvider.js';
import { AIServiceError } from '../AIServiceError.js';
import { classifyAIError } from '../aiErrorTaxonomy.js';
import { tutorTelemetry } from '../tutor/tutorTelemetry.js';
import { createTutorUsagePlan, normalizeProviderUsage, usageFitsReservation } from '../tutor/tutorUsage.js';
import { createTutorPricingConfiguration, createTutorProviderTokenConstraints } from '../tutor/tutorRuntimeConfig.js';
import { normalizeProjectMentorRequest, createProjectMentorProviderRequest } from './projectMentorRequest.js';
import { validateProjectMentorResponse } from './projectMentorSchema.js';

const ZERO_USAGE = Object.freeze({ inputTokens: 0, outputTokens: 0, costMicros: 0 });

export async function explainProjectMentor(body, { principal, signal, quotaGuard, featureGate, providerFactory = createAIProvider, telemetry = tutorTelemetry, pricing, providerTokenConstraints } = {}) {
  if (!principal?.uid) throw new AIServiceError('ai/auth-required', 'Sign in to use the AI Tutor.', { status: 401 });
  const startedAt = Date.now();
  let operation;
  let reservation;
  let providerInvoked = false;
  let usage;
  let usageMaximum = ZERO_USAGE;
  let resolvedPricing;
  let metadata = { provider: 'unknown', model: 'unknown' };
  const settleQuota = async (outcome) => {
    if (!reservation) return;
    const charge = providerInvoked
      ? usage ?? { ...usageMaximum, tokenUsageKnown: false, costKnown: resolvedPricing?.known === true }
      : { ...ZERO_USAGE, tokenUsageKnown: true, costKnown: true };
    await quotaGuard.settle(reservation, {
      inputTokens: charge.inputTokens,
      outputTokens: charge.outputTokens,
      costMicros: charge.costMicros,
      chargeEstimate: providerInvoked && charge.tokenUsageKnown !== true,
      outcome,
    });
    reservation = null;
  };
  try {
    await featureGate.assertEnabled({ uid: principal.uid, activityHint: 'project', requestBody: body });
    const request = normalizeProjectMentorRequest(body);
    operation = request.operation;
    const providerRequest = createProjectMentorProviderRequest(request);
    resolvedPricing = pricing ?? createTutorPricingConfiguration();
    const plan = createTutorUsagePlan(providerRequest, resolvedPricing, providerTokenConstraints ?? createTutorProviderTokenConstraints());
    usageMaximum = plan.maximum;
    reservation = await quotaGuard.assertAllowed({ uid: principal.uid, usageEstimate: plan.estimate, usageMaximum: plan.maximum });
    const provider = providerFactory();
    metadata = provider.getMetadata?.() ?? metadata;
    providerInvoked = true;
    const result = await provider.explain(providerRequest, { signal });
    usage = normalizeProviderUsage({ inputTokens: result?.usage?.input_tokens ?? result?.usage?.prompt_tokens, outputTokens: result?.usage?.output_tokens ?? result?.usage?.completion_tokens }, plan.estimate, resolvedPricing);
    if (!usageFitsReservation(usage, reservation ?? { maximum: plan.maximum })) {
      throw new AIServiceError('ai/quota-integrity', 'The AI Tutor usage report exceeded its authorized reservation.', { status: 503 });
    }
    const response = validateProjectMentorResponse(result?.text, request.operation);
    await settleQuota('success');
    telemetry.record({ ...metadata, operation, latencyMs: Date.now() - startedAt, httpStatus: 200, success: true, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.inputTokens + usage.outputTokens, estimatedCostMicros: usage.costMicros, costKnown: usage.costKnown, responseBytes: Buffer.byteLength(JSON.stringify(response), 'utf8'), quotaDecision: 'allowed' });
    return response;
  } catch (error) {
    const normalizedError = error?.name === 'AbortError' ? new AIServiceError('ai/cancelled', 'The explanation was cancelled.', { status: 499, cause: error }) : error;
    const classification = classifyAIError(normalizedError);
    await settleQuota(classification.code);
    telemetry.record({ ...metadata, operation, latencyMs: Date.now() - startedAt, httpStatus: classification.status, retryable: classification.retryable, success: false, errorCategory: classification.code, quotaDecision: classification.code === 'ai/rate-limited' ? 'rejected' : 'allowed' });
    throw normalizedError;
  }
}
