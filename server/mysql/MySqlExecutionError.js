export class MySqlExecutionError extends Error {
  constructor(code, message, { status = 400, cause } = {}) {
    super(message, { cause });
    this.name = 'MySqlExecutionError';
    this.code = code;
    this.status = status;
  }
}
