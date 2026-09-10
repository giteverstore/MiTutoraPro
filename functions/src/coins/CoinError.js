export class CoinError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'CoinError';
    this.code = code;
  }
}

export function failCoin(code, message) {
  throw new CoinError(code, message);
}
