export class ActivityVerificationError extends Error {
  constructor(code, message, { status = 400, cause } = {}) {
    super(message, { cause });
    this.name = 'ActivityVerificationError';
    this.code = code;
    this.status = status;
  }
}

export function failVerification(code, message, options) {
  throw new ActivityVerificationError(code, message, options);
}

export function sanitizedVerificationError(error) {
  if (error instanceof ActivityVerificationError) {
    return Object.freeze({ code: error.code, message: error.message, status: error.status });
  }
  return Object.freeze({
    code: 'activity-verification/internal',
    message: 'Activity verification could not be completed.',
    status: 500,
  });
}
