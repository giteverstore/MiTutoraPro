const CHECKOUT_SOURCE = 'https://checkout.razorpay.com/v1/checkout.js';
let checkoutPromise;

export function loadRazorpayCheckout(documentValue = document, windowValue = window) {
  if (windowValue.Razorpay) return Promise.resolve(windowValue.Razorpay);
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise((resolve, reject) => {
    const existing = documentValue.querySelector(`script[src="${CHECKOUT_SOURCE}"]`);
    const script = existing ?? documentValue.createElement('script');
    const loaded = () => windowValue.Razorpay ? resolve(windowValue.Razorpay) : reject(new Error('Checkout did not initialize.'));
    const failed = () => { checkoutPromise = undefined; reject(new Error('Checkout could not be loaded.')); };
    script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true });
    if (!existing) { script.src = CHECKOUT_SOURCE; script.async = true; script.dataset.mitutoraPayment = 'razorpay'; documentValue.head.append(script); }
  });
  return checkoutPromise;
}

export function openRazorpayCheckout({ RazorpayClass, order, onSuccess, onDismiss }) {
  if (typeof RazorpayClass !== 'function') throw new TypeError('Razorpay Checkout is unavailable.');
  const checkout = new RazorpayClass({ key: order.keyId, order_id: order.providerOrderId, amount: order.amountMinor, currency: order.currency, name: 'Mi Tutora', description: `${order.planName} Premium`, handler: onSuccess, modal: { ondismiss: onDismiss }, retry: { enabled: false } });
  checkout.open();
  return checkout;
}
