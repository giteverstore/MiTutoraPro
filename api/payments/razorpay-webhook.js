import { createRazorpayWebhookHandler } from '../../server/payments/paymentHandlers.js';
export const config = { api: { bodyParser: false } };
export default createRazorpayWebhookHandler();
