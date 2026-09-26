import { getPublicCompilerLanguage, publicCompilerLanguages } from '../compiler/languages/supportedLanguages.js';
import { isStandaloneCompilerHost } from './standaloneCompilerHost.js';

export const STANDALONE_DEV_PREFIX = '/__compiler';

export function parseStandaloneCompilerRoute(pathname, hostname = '') {
  const usesDevPrefix = !isStandaloneCompilerHost(hostname);
  let path = pathname || '/';
  if (usesDevPrefix && (path === STANDALONE_DEV_PREFIX || path.startsWith(`${STANDALONE_DEV_PREFIX}/`))) {
    path = path.slice(STANDALONE_DEV_PREFIX.length) || '/';
  }
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return { kind: 'index' };
  if (parts[0] === 'share') return parts.length === 2 ? { kind: 'share', shareId: parts[1] } : { kind: 'not-found' };
  if (parts.length !== 1) return { kind: 'not-found' };
  const language = getPublicCompilerLanguage(parts[0]);
  if (!language) return { kind: 'not-found' };
  return { kind: 'language', language, canonical: parts[0] === language.publicSlug };
}

export function standaloneCompilerPath(language, hostname = window.location.hostname) {
  const prefix = isStandaloneCompilerHost(hostname) ? '' : STANDALONE_DEV_PREFIX;
  return `${prefix}/${language.publicSlug}`;
}

export function allPublicCompilerRoutes() {
  return publicCompilerLanguages.map(({ publicSlug }) => `/${publicSlug}`);
}
