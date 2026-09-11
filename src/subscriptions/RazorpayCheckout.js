const CHECKOUT_SOURCE = 'https://checkout.razorpay.com/v1/checkout.js';
let checkoutPromise;

function checkoutError(category, message) {
  return Object.assign(new Error(message), { category });
}

export function loadRazorpayCheckout(documentValue = document, windowValue = window) {
  if (windowValue.Razorpay) return Promise.resolve(windowValue.Razorpay);
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise((resolve, reject) => {
    let existing = documentValue.querySelector(`script[src="${CHECKOUT_SOURCE}"]`);
    if (existing && existing.dataset.mitutoraPaymentState !== 'loading') { existing.remove(); existing = null; }
    const script = existing ?? documentValue.createElement('script');
    let settled = false;
    const timer = setTimeout(() => failed(), 15_000);
    const loaded = () => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      checkoutPromise = undefined;
      if (windowValue.Razorpay) { script.dataset.mitutoraPaymentState = 'loaded'; resolve(windowValue.Razorpay); }
      else { script.dataset.mitutoraPaymentState = 'failed'; reject(checkoutError('CHECKOUT_GLOBAL_UNAVAILABLE', 'Checkout did not initialize.')); }
    };
    function failed() {
      if (settled) return;
      settled = true; clearTimeout(timer);
      checkoutPromise = undefined; script.dataset.mitutoraPaymentState = 'failed'; reject(checkoutError('CHECKOUT_SCRIPT_LOAD_FAILED', 'Checkout could not be loaded.'));
    }
    script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true });
    if (!existing) { script.src = CHECKOUT_SOURCE; script.async = true; script.dataset.mitutoraPayment = 'razorpay'; script.dataset.mitutoraPaymentState = 'loading'; documentValue.head.append(script); }
  });
  return checkoutPromise;
}

export function validateCheckoutOrder(order, expectedPlanId) {
  if (!order || typeof order !== 'object' || Array.isArray(order)
    || typeof order.internalOrderId !== 'string' || !/^order_[A-Za-z0-9]{8,64}$/.test(order.internalOrderId)
    || typeof order.providerOrderId !== 'string' || !/^order_[A-Za-z0-9]{8,64}$/.test(order.providerOrderId)
    || typeof order.keyId !== 'string' || !/^rzp_(?:test|live)_[A-Za-z0-9]+$/.test(order.keyId)
    || !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0
    || typeof order.currency !== 'string' || !/^[A-Z]{3}$/.test(order.currency)
    || order.planId !== expectedPlanId) {
    throw checkoutError('ORDER_RESPONSE_INVALID', 'Payment order response is invalid.');
  }
  return order;
}

export function createRazorpayCheckout({ RazorpayClass, order, onSuccess, onDismiss }) {
  if (typeof RazorpayClass !== 'function') throw checkoutError('CHECKOUT_GLOBAL_UNAVAILABLE', 'Razorpay Checkout is unavailable.');
  return new RazorpayClass({ key: order.keyId, order_id: order.providerOrderId, amount: order.amountMinor, currency: order.currency, name: 'Mi Tutora', description: `${order.planName} Premium`, handler: onSuccess, modal: { ondismiss: onDismiss }, retry: { enabled: false } });
}
