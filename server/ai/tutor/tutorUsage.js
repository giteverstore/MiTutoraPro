import { Buffer } from 'node:buffer';
import { TUTOR_RESPONSE_TOKEN_BUDGETS } from './tutorConfig.js';
import { AIServiceError } from '../AIServiceError.js';

function tokens(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.ceil(parsed) : null;
}

export function estimateTokenCount(value) {
  return Math.max(1, Math.ceil(Buffer.byteLength(String(value ?? ''), 'utf8') / 4));
}

export function estimateCostMicros({ inputTokens, outputTokens }, pricing) {
  if (!pricing?.known) return null;
  const numerator = (BigInt(inputTokens) * BigInt(pricing.inputMicrosPerMillion))
    + (BigInt(outputTokens) * BigInt(pricing.outputMicrosPerMillion));
  const value = (numerator + 999_999n) / 1_000_000n;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Calculated tutor cost exceeds the supported integer range.');
  return Number(value);
}

export function estimateTutorRequestUsage(body, pricing) {
  let serialized = '';
  try { serialized = JSON.stringify(body ?? {}); } catch { serialized = ''; }
  const inputTokens = estimateTokenCount(serialized);
  const outputTokens = TUTOR_RESPONSE_TOKEN_BUDGETS.complex;
  return Object.freeze({
    inputTokens,
    outputTokens,
    costMicros: estimateCostMicros({ inputTokens, outputTokens }, pricing),
  });
}

export function createTutorUsagePlan(tutorRequest, pricing, constraints) {
  const inputBytes = Buffer.byteLength(`${tutorRequest.systemInstruction}\n${tutorRequest.userContent}`, 'utf8');
  const estimatedInputTokens = estimateTokenCount(`${tutorRequest.systemInstruction}\n${tutorRequest.userContent}`);
  const maximumInputTokens = inputBytes + constraints.inputOverheadTokens;
  if (maximumInputTokens > constraints.maxInputTokens) {
    throw new AIServiceError('ai/request-too-large', 'The code context is too large to explain in one request.', { status: 413 });
  }
  const maximumOutputTokens = Math.min(tutorRequest.maxProviderTokens, TUTOR_RESPONSE_TOKEN_BUDGETS.complex);
  const estimate = Object.freeze({
    inputTokens: estimatedInputTokens,
    outputTokens: tutorRequest.targetResponseTokens,
    costMicros: estimateCostMicros({ inputTokens: estimatedInputTokens, outputTokens: tutorRequest.targetResponseTokens }, pricing),
  });
  const maximum = Object.freeze({
    inputTokens: maximumInputTokens,
    outputTokens: maximumOutputTokens,
    costMicros: estimateCostMicros({ inputTokens: maximumInputTokens, outputTokens: maximumOutputTokens }, pricing),
  });
  return Object.freeze({ estimate, maximum });
}

export function usageFitsReservation(usage, reservation) {
  const maximum = reservation?.maximum ?? reservation?.estimate;
  if (!maximum) return false;
  return usage.inputTokens <= maximum.inputTokens
    && usage.outputTokens <= maximum.outputTokens
    && (maximum.costMicros == null || usage.costMicros == null || usage.costMicros <= maximum.costMicros);
}

export function normalizeProviderUsage(usage, estimate, pricing) {
  const inputTokens = tokens(usage?.inputTokens ?? usage?.input_tokens ?? usage?.prompt_tokens);
  const outputTokens = tokens(usage?.outputTokens ?? usage?.output_tokens ?? usage?.completion_tokens);
  const known = inputTokens != null && outputTokens != null;
  const effective = {
    inputTokens: inputTokens ?? estimate.inputTokens,
    outputTokens: outputTokens ?? estimate.outputTokens,
  };
  return Object.freeze({
    ...effective,
    tokenUsageKnown: known,
    costMicros: estimateCostMicros(effective, pricing),
    costKnown: pricing?.known === true,
  });
}
