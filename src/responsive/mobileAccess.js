import { useEffect, useState } from 'react';

export const MOBILE_PHONE_MAX_WIDTH = 720;
export const MOBILE_PHONE_QUERY = `(max-width: ${MOBILE_PHONE_MAX_WIDTH}px)`;
export const MOBILE_LOGIN_NOTICE_PENDING_KEY = 'ycoders:mobile-login-notice-pending';
export const MOBILE_LOGIN_NOTICE_DISMISSED_KEY = 'ycoders:mobile-login-notice-dismissed';

export function isMobilePhoneViewport() {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') return window.matchMedia(MOBILE_PHONE_QUERY).matches;
  return window.innerWidth <= MOBILE_PHONE_MAX_WIDTH;
}

export function useMobilePhoneViewport({ snapshot = false } = {}) {
  const [matches, setMatches] = useState(isMobilePhoneViewport);

  useEffect(() => {
    if (snapshot || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(MOBILE_PHONE_QUERY);
    const update = (event) => setMatches(event.matches);
    setMatches(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, [snapshot]);

  return matches;
}

export function markMobileLoginNoticePending() {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(MOBILE_LOGIN_NOTICE_PENDING_KEY, 'true');
}

export function dismissMobileLoginNotice() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(MOBILE_LOGIN_NOTICE_PENDING_KEY);
  sessionStorage.setItem(MOBILE_LOGIN_NOTICE_DISMISSED_KEY, 'true');
}

export function hasPendingMobileLoginNotice() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(MOBILE_LOGIN_NOTICE_PENDING_KEY) === 'true'
    && sessionStorage.getItem(MOBILE_LOGIN_NOTICE_DISMISSED_KEY) !== 'true';
}

export function isMobileRestrictedPath(pathname) {
  return /^\/courses\/[^/]+\/lesson\/[^/]+\/?$/.test(pathname)
    || /^\/projects\/[^/]+\/workspace\/?$/.test(pathname);
}
