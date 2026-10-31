function outputTokens(result) {
  const value = Number(result?.usage?.output_tokens ?? result?.usage?.completion_tokens);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function executeProviderWithTruncationRetry(provider, providerRequest, { signal } = {}) {
  let first;
  try { first = await provider.explain(providerRequest, { signal }); }
  catch (error) {
    if (error && typeof error === 'object') error.providerAttemptCount = 1;
    throw error;
  }
  const retryMaximum = Number(providerRequest?.retryMaxProviderTokens);
  if (first?.finishReason !== 'length'
    || !Number.isInteger(retryMaximum)
    || retryMaximum <= providerRequest.maxProviderTokens) {
    return Object.freeze({
      result: first,
      attempts: Object.freeze([first]),
      diagnostic: Object.freeze({
        attemptCount: 1,
        structuredOutputMode: first?.structuredOutputMode ?? 'unknown',
        firstFinishReason: first?.finishReason ?? 'unknown',
        finalFinishReason: first?.finishReason ?? 'unknown',
        ...(outputTokens(first) == null ? {} : { firstOutputTokens: outputTokens(first), finalOutputTokens: outputTokens(first) }),
      }),
    });
  }

  const retryRequest = Object.freeze({
    ...providerRequest,
    targetResponseTokens: retryMaximum,
    maxProviderTokens: retryMaximum,
  });
  let second;
  try { second = await provider.explain(retryRequest, { signal }); }
  catch (error) {
    if (error && typeof error === 'object') error.providerAttemptCount = 2;
    throw error;
  }
  return Object.freeze({
    result: second,
    attempts: Object.freeze([first, second]),
    diagnostic: Object.freeze({
      attemptCount: 2,
      retryReason: 'truncation',
      structuredOutputMode: second?.structuredOutputMode ?? first?.structuredOutputMode ?? 'unknown',
      firstFinishReason: first?.finishReason ?? 'unknown',
      finalFinishReason: second?.finishReason ?? 'unknown',
      ...(outputTokens(first) == null ? {} : { firstOutputTokens: outputTokens(first) }),
      ...(outputTokens(second) == null ? {} : { finalOutputTokens: outputTokens(second) }),
    }),
  });
}
