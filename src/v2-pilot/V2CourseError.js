export class V2CourseError extends Error {
  constructor(code, message, { status = 500, cause, correlationId = null } = {}) {
    super(message, { cause });
    this.name = 'V2CourseError';
    this.code = code;
    this.status = status;
    this.correlationId = correlationId;
  }
}
