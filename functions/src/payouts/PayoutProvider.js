export class PayoutProvider {
  async validateDestination() { throw unavailable(); }
  async createContact() { throw unavailable(); }
  async createFundAccount() { throw unavailable(); }
  async createPayout() { throw unavailable(); }
  async fetchPayout() { throw unavailable(); }
  async verifyWebhook() { throw unavailable(); }
}

export class UnavailablePayoutProvider extends PayoutProvider {}

export function createPayoutProvider(options = {}) {
  if ((options.environment ?? process.env).PAYOUT_PROVIDER === 'razorpayx') return new RazorpayXPayoutProvider(options);
  return new UnavailablePayoutProvider();
}

function unavailable() {
  return Object.assign(new Error('A production payout provider is not configured.'), { code: 'payout/provider-unavailable' });
}
import { RazorpayXPayoutProvider } from './providers/razorpayx/RazorpayXPayoutProvider.js';
