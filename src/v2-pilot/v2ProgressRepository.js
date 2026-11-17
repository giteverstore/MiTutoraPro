import { authService } from '../auth/AuthService';

export function createV2ProgressRepository(identity, { persist = true, fetchImpl=globalThis.fetch, tokenProvider=()=>authService.getIdToken() } = {}) {
  const endpoint=`/api/v2-pilot/progress/${encodeURIComponent(identity.contentId)}/versions/${identity.publicationVersion}`;
  async function request(method,body){const token=await tokenProvider();if(!token)throw new Error('Authentication required.');const response=await fetchImpl(endpoint,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(value?.error?.message??'V2 progress request failed.'),{code:value?.error?.code,status:response.status});return value?.data??null;}
  return Object.freeze({
    async load() {
      if (!persist) return null;
      return request('GET');
    },
    async save(_userId, _courseId, progress) {
      if (!persist) return progress;
      return request('PUT',progress);
    },
    async clear() { throw new Error('V2 pilot progress deletion is not available.'); },
  });
}

export const disabledV2TrustedCompletionService = Object.freeze({
  async beginLessonEvidence() {},
  async recordLessonCompletion() {},
});
