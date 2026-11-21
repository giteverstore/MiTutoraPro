import { authService } from '../auth/AuthService';
import { V2CourseError } from './V2CourseError';

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

export function createV2PracticeIdentity({ contentId, publicationVersion } = {}) {
  if (!SAFE_ID.test(String(contentId ?? ''))) throw new TypeError('A valid V2 Practice contentId is required.');
  if (publicationVersion !== undefined && (!Number.isSafeInteger(publicationVersion) || publicationVersion < 1)) throw new TypeError('publicationVersion must be a positive integer when supplied.');
  return Object.freeze({ namespace: 'v2', contentType: 'practice', contentId, ...(publicationVersion === undefined ? {} : { publicationVersion }) });
}

export function parseLearnerPractice(value, identity) {
  if (!value || typeof value !== 'object' || value.identity?.namespace !== 'v2' || value.identity?.contentType !== 'practice'
    || value.identity?.contentId !== identity.contentId || value.identity?.publicationVersion !== identity.publicationVersion
    || !Array.isArray(value.languages?.supported) || !value.languages.supported.some(({ id }) => id === value.languages.defaultLanguageId)
    || !Array.isArray(value.starterCode) || !value.execution || !Array.isArray(value.publicTests) || value.publicTests.length === 0
    || value.executionAssurance !== 'browser-public-tests') {
    throw new V2CourseError('v2/practice-dto-invalid', 'The delivered Practice does not satisfy the frozen learner contract.', { status: 502 });
  }
  const serialized = JSON.stringify(value);
  if (serialized.includes('referenceSolutions') || serialized.includes('publishedObjectPath') || serialized.includes('draftRevision')) throw new V2CourseError('v2/practice-dto-unsafe', 'The delivered Practice failed learner safety validation.', { status: 502 });
  return Object.freeze(structuredClone(value));
}

async function parseResponse(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) throw new V2CourseError(body?.error?.code ?? 'v2/delivery-failed', body?.error?.message ?? 'The V2 Practice could not be loaded.', { status: response.status, correlationId: body?.error?.correlationId ?? response.headers.get('x-correlation-id') });
  return body?.data ?? body;
}

export class V2PracticeRepository {
  constructor({ tokenProvider = () => authService.getIdToken(), fetchImpl = globalThis.fetch } = {}) { this.tokenProvider = tokenProvider; this.fetch = fetchImpl === globalThis.fetch ? (...args) => globalThis.fetch(...args) : fetchImpl; }

  async load(identity, { signal } = {}) {
    const requested = createV2PracticeIdentity(identity), token = await this.tokenProvider();
    if (!token) throw new V2CourseError('v2/auth-required', 'Sign in to open this V2 pilot Practice.', { status: 401 });
    const suffix = requested.publicationVersion ? `/versions/${requested.publicationVersion}` : '';
    const response = await this.fetch(`/api/v2-pilot/practice/${encodeURIComponent(requested.contentId)}${suffix}`, { signal, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const delivered = await parseResponse(response);
    const resolved = createV2PracticeIdentity({ contentId: delivered.contentId, publicationVersion: delivered.publicationVersion });
    if (resolved.contentId !== requested.contentId || (requested.publicationVersion && resolved.publicationVersion !== requested.publicationVersion)) throw new V2CourseError('v2/identity-mismatch', 'The V2 delivery identity did not match the requested Practice.', { status: 502 });
    return Object.freeze({ ...delivered, identity: resolved, practice: parseLearnerPractice(delivered.practice, resolved) });
  }
}

export const v2PracticeRepository = new V2PracticeRepository();
