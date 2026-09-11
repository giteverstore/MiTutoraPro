import { RazorpayPaymentProvider } from './providers/razorpay/RazorpayPaymentProvider.js';

export class PaymentProvider {
  async createOrder() { throw unavailable(); }
  async verifyCheckoutSignature() { throw unavailable(); }
  async verifyWebhook() { throw unavailable(); }
  async fetchPayment() { throw unavailable(); }
  async fetchOrder() { throw unavailable(); }
  async fetchPaymentRefunds() { throw unavailable(); }
  async fetchCanonicalEvidence() { throw unavailable(); }
}

export class UnavailablePaymentProvider extends PaymentProvider {}

export function createPaymentProvider({ environment = process.env, ...options } = {}) {
  if (environment.PAYMENT_PROVIDER === 'razorpay') {
    return new RazorpayPaymentProvider({ environment, ...options });
  }
  return new UnavailablePaymentProvider();
}

function unavailable() {
  return Object.assign(new Error('A production payment provider is not configured.'), { code: 'payment/provider-unavailable' });
}
