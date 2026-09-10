export class AIServiceError extends Error {
  constructor(code, publicMessage, { status = 500, cause } = {}) {
    super(publicMessage, { cause });
    this.name = 'AIServiceError';
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}
