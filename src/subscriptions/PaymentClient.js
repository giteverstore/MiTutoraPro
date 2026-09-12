const SAFE_SERVER_CODE = /^[a-z][a-z0-9-]{0,31}\/[a-z0-9-]{1,63}$/;
const SAFE_EXCEPTION_NAMES = new Set(['AbortError', 'NetworkError', 'NotAllowedError', 'SecurityError', 'TypeError']);

function paymentRequestError(category, details = {}) {
  return Object.assign(new Error('Payment request failed.'), { category, ...details });
}

function sanitizedServerCode(value) {
  return typeof value === 'string' && SAFE_SERVER_CODE.test(value) ? value : 'payment/unavailable';
}

export class PaymentClient {
  constructor({ tokenProvider, fetchImpl = (...args) => globalThis.fetch(...args) }) { this.tokenProvider = tokenProvider; this.fetchImpl = fetchImpl; }
  async #post(path, body, { transportCategory, httpCategory }) {
    const token = await this.tokenProvider();
    let response;
    try { response = await this.fetchImpl(path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (error) {
      throw paymentRequestError(transportCategory, {
        endpoint: path,
        method: 'POST',
        exceptionName: SAFE_EXCEPTION_NAMES.has(error?.name) ? error.name : 'Error',
      });
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) throw paymentRequestError(httpCategory, {
      endpoint: path,
      method: 'POST',
      status: Number.isInteger(response.status) ? response.status : 0,
      serverCode: sanitizedServerCode(result?.error?.code),
    });
    return result;
  }
  createOrder(planId, requestId) { return this.#post('/api/payments/orders', { planId, requestId }, { transportCategory: 'ORDER_TRANSPORT_FAILED', httpCategory: 'ORDER_HTTP_FAILED' }); }
  verifyPayment(internalOrderId, callback) { return this.#post('/api/payments/verify', { internalOrderId, razorpay_order_id: callback.razorpay_order_id, razorpay_payment_id: callback.razorpay_payment_id, razorpay_signature: callback.razorpay_signature }, { transportCategory: 'PAYMENT_TRANSPORT_FAILED', httpCategory: 'PAYMENT_HTTP_FAILED' }); }
}
