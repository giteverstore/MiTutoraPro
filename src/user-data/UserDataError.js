export const USER_DATA_ERROR_CODES = Object.freeze({
  unauthenticated: 'user-data/unauthenticated',
  unavailable: 'user-data/unavailable',
  readFailed: 'user-data/read-failed',
  writeFailed: 'user-data/write-failed',
});

export class UserDataError extends Error {
  constructor(code, message, { cause, operation } = {}) {
    super(message, { cause });
    this.name = 'UserDataError';
    this.code = code;
    this.operation = operation ?? null;
  }
}
