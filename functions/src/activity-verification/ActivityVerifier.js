import { failVerification } from './ActivityVerificationError.js';

function validateExecutorResult(result, expectedTests) {
  if (!result || typeof result !== 'object' || typeof result.passed !== 'boolean'
    || !Number.isSafeInteger(result.testCount) || result.testCount !== expectedTests) {
    failVerification('activity-verification/malformed-verifier-result', 'The execution verifier returned an invalid result.', { status: 503 });
  }
  return Object.freeze({ passed: result.passed, testCount: result.testCount });
}

export class ActivityVerifier {
  constructor({ activityType, executor }) {
    this.activityType = activityType;
    this.executor = executor;
  }

  async verify({ request, activity, limits }) {
    if (request.activityType !== this.activityType) {
      failVerification('activity-verification/activity-mismatch', 'The verifier does not support this activity.');
    }
    const controller = new AbortController();
    let timer;
    let timedOut = false;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(Object.assign(new Error('timeout'), { code: 'activity-verification/timeout' }));
        }, limits.executionTimeoutMs);
      });
      let result;
      try {
        result = await Promise.race([
          this.executor.execute({
            language: activity.language,
            sourceCode: request.sourceCode,
            verification: activity.verification,
            limits,
            signal: controller.signal,
          }),
          timeout,
        ]);
      } catch (error) {
        if (timedOut || error?.code === 'activity-verification/timeout') {
          failVerification('activity-verification/timeout', 'Activity verification timed out.', { status: 503 });
        }
        failVerification('activity-verification/verifier-failed', 'Activity verification infrastructure failed.', { status: 503, cause: error });
      }
      return validateExecutorResult(result, activity.verification.tests.length);
    } finally {
      clearTimeout(timer);
    }
  }
}
