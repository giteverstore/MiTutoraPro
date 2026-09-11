import { createHash } from 'node:crypto';

function eventId(withdrawalId, status) { return `initiation:${createHash('sha256').update(`${withdrawalId}\0${status}`).digest('hex')}`; }

export class RazorpayXPayoutCoordinator {
  constructor({ withdrawalService, provider }) {
    if (!withdrawalService?.requestWithdrawal || !withdrawalService?.applyProviderEvent || !provider?.createContact || !provider?.createFundAccount || !provider?.createPayout) throw new TypeError('RazorpayXPayoutCoordinator dependencies are required.');
    this.withdrawalService = withdrawalService; this.provider = provider;
  }

  async requestAndInitiate({ principal, request }) {
    const reserved = await this.withdrawalService.requestWithdrawal({ principal, request });
    let contact;
    let fundAccount;
    try {
      contact = await this.provider.createContact({ withdrawalId: reserved.withdrawalId });
      fundAccount = await this.provider.createFundAccount({ providerContactId: contact.providerContactId, upiId: request.upiId });
      const evidence = await this.provider.createPayout({ withdrawalId: reserved.withdrawalId, providerFundAccountId: fundAccount.providerFundAccountId, amountMinor: reserved.amountMinor, currency: reserved.currency });
      return this.withdrawalService.applyProviderEvent({ ...evidence, providerContactId: contact.providerContactId });
    } catch (error) {
      if (!['payout/provider-unknown', 'payout/provider-unavailable'].includes(error?.code)) throw error;
      await this.withdrawalService.applyProviderEvent({ trusted: true, source: 'PROVIDER_RESPONSE', eventId: eventId(reserved.withdrawalId, 'unknown'), withdrawalId: reserved.withdrawalId, status: 'UNKNOWN', providerContactId: contact?.providerContactId, providerFundAccountId: fundAccount?.providerFundAccountId, amountMinor: reserved.amountMinor, currency: reserved.currency });
      throw error;
    }
  }

  async processWebhook({ rawBody, headers, repository }) {
    const evidence = await this.provider.verifyWebhook({ rawBody, headers, resolveWithdrawal: (providerPayoutId) => repository.findByProviderPayoutId(providerPayoutId) });
    return this.withdrawalService.applyProviderEvent(evidence);
  }
}
