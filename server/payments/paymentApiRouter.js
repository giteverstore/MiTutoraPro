import {
  createPaymentOrderHandler,
  createPaymentReconciliationHandler,
  createPaymentVerifyHandler,
  createRazorpayWebhookHandler,
} from './paymentHandlers.js';

const MAX_JSON_BYTES = 256 * 1024;

async function parseJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function routeSegment(request) {
  const queryPath = request.query?.path;
  if (Array.isArray(queryPath)) return queryPath.filter(Boolean).join('/');
  if (typeof queryPath === 'string') return queryPath;
  return new URL(request.url || '/', 'http://localhost').pathname.replace(/^\/api\/payments\/?/, '');
}

export function createPaymentApiRouter() {
  const handlers = new Map([
    ['orders', createPaymentOrderHandler()],
    ['razorpay-webhook', createRazorpayWebhookHandler()],
    ['reconcile', createPaymentReconciliationHandler()],
    ['verify', createPaymentVerifyHandler()],
  ]);

  return async function paymentApiRouter(request, response) {
    const route = routeSegment(request);
    const handler = handlers.get(route);
    if (!handler) return response.status(404).json({ error: { code: 'payment/not-found', message: 'Payment API route not found.' } });

    if ((route === 'orders' || route === 'verify') && request.method === 'POST') {
      try {
        request.body = await parseJsonBody(request);
      } catch (error) {
        return response.status(error.status || 400).json({ error: { code: error.status === 413 ? 'payment/request-too-large' : 'payment/invalid-request', message: error.message } });
      }
    }
    return handler(request, response);
  };
}
