export const ENVIRONMENT_CHECK_STATUS = Object.freeze({
  PASS: 'pass',
  FAIL: 'fail',
});

export class EnvironmentResult {
  constructor({ id, label, status, message }) {
    this.id = id;
    this.label = label;
    this.status = status;
    this.message = message;
    Object.freeze(this);
  }

  get passed() {
    return this.status === ENVIRONMENT_CHECK_STATUS.PASS;
  }
}
