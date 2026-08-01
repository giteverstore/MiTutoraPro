export function logAuthenticationEvent(stage, details = {}) {
  console.info(`[Authentication] ${stage}`, details);
}

export function logAuthenticationError(stage, error) {
  console.error(`[Authentication] ${stage}`, {
    code: error?.code ?? 'unknown',
    message: error?.message ?? String(error),
    stack: error?.stack ?? 'No stack trace available.',
  });
}
