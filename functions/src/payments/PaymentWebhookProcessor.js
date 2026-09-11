export class PaymentWebhookProcessor {
  constructor({ provider, paymentService, activationCoordinator }) {
    if (!provider?.verifyWebhook || !paymentService?.recordVerifiedEvent) throw new TypeError('Webhook processing dependencies are required.');
    this.provider = provider;
    this.paymentService = paymentService;
    this.activationCoordinator = activationCoordinator;
  }

  async process({ rawBody, headers }) {
    if (!(rawBody instanceof Uint8Array) && !Buffer.isBuffer(rawBody)) {
      throw Object.assign(new Error('Webhook raw body is required.'), { code: 'payment/raw-body-required' });
    }
    const evidence = await this.provider.verifyWebhook({ rawBody, headers });
    const payment = await this.paymentService.recordVerifiedEvent(evidence);
    if (payment.status === 'CAPTURED' && this.activationCoordinator) {
      await this.activationCoordinator.activateFromCapturedPayment(payment.paymentId);
    }
    return payment;
  }
}
