const RETURN_KEY = 'ycoders:auth-return';
const safePath = (value) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';

export function requestAuthentication(destination = window.location.pathname, screen = 'login') {
  sessionStorage.setItem(RETURN_KEY, safePath(destination));
  window.history.pushState({ ycoders: true }, '', screen === 'signup' ? '/signup' : '/login');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function consumeAuthenticationReturn() {
  const destination = safePath(sessionStorage.getItem(RETURN_KEY) ?? '/');
  sessionStorage.removeItem(RETURN_KEY);
  return destination;
}
