export class PaymentClient {
  constructor({ tokenProvider, fetchImpl = globalThis.fetch }) { this.tokenProvider = tokenProvider; this.fetchImpl = fetchImpl; }
  async #post(path, body) {
    const token = await this.tokenProvider();
    let response;
    try { response = await this.fetchImpl(path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { throw Object.assign(new Error('Payment request failed.'), { category: 'ORDER_REQUEST_FAILED' }); }
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error('Payment request failed.'), { code: result?.error?.code || 'payment/unavailable', category: 'ORDER_REQUEST_FAILED' });
    return result;
  }
  createOrder(planId, requestId) { return this.#post('/api/payments/orders', { planId, requestId }); }
  verifyPayment(internalOrderId, callback) { return this.#post('/api/payments/verify', { internalOrderId, razorpay_order_id: callback.razorpay_order_id, razorpay_payment_id: callback.razorpay_payment_id, razorpay_signature: callback.razorpay_signature }); }
}
