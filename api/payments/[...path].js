import { createPaymentApiRouter } from '../../server/payments/paymentApiRouter.js';

export const config = { api: { bodyParser: false } };

export default createPaymentApiRouter();
