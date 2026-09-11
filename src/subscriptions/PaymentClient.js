export class PaymentClient {
  constructor({ tokenProvider, fetchImpl = globalThis.fetch }) { this.tokenProvider = tokenProvider; this.fetchImpl = fetchImpl; }
  async #post(path, body) {
    const token = await this.tokenProvider();
    const response = await this.fetchImpl(path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(result?.error?.message || 'Payment request failed.'), { code: result?.error?.code || 'payment/unavailable' });
    return result;
  }
  createOrder(planId, requestId) { return this.#post('/api/payments/orders', { planId, requestId }); }
  verifyPayment(internalOrderId, callback) { return this.#post('/api/payments/verify', { internalOrderId, razorpay_order_id: callback.razorpay_order_id, razorpay_payment_id: callback.razorpay_payment_id, razorpay_signature: callback.razorpay_signature }); }
}
