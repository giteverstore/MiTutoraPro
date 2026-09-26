export class RemoteCompilerError extends Error {
  constructor(code, message, { status = 400, cause } = {}) {
    super(message, { cause });
    this.name = 'RemoteCompilerError';
    this.code = code;
    this.status = status;
  }
}
