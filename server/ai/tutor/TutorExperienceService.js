import { randomUUID } from 'node:crypto';
import { classifyTutorCacheEligibility, createExactTutorCacheKey } from './tutorCachePolicy.js';
import { resolveTutorEntitlement } from './tutorEntitlement.js';

export class TutorExperienceService {
  constructor({ store, identityKey }) { this.store = store; this.identityKey = identityKey; }
  async prepare({ principal, entitlement, scope, body }) {
    const ownerKey = this.identityKey(principal.uid); const requestId = typeof body.requestId === 'string' && /^[A-Za-z0-9_-]{16,128}$/u.test(body.requestId) ? body.requestId : randomUUID(); const capability = resolveTutorEntitlement(entitlement);
    const reservation = await this.store.reserveIncluded({ ownerKey, requestId, limit: capability.includedTutorMessages, unlimited: capability.unlimitedTutorMessages });
    const cache = classifyTutorCacheEligibility(body, scope); const cacheKey = cache.eligible ? createExactTutorCacheKey({ scope, language: body.language ?? body.context?.languageId, normalizedQuestion: cache.normalizedQuestion }) : null; const cachedResponse = cacheKey ? (await this.store.getCache(cacheKey))?.response ?? null : null;
    return { ownerKey, requestId, capability, reservation, cache, cacheKey, cachedResponse };
  }
  async complete(prepared, { scope, body, response }) {
    if (prepared.cacheKey && !prepared.cachedResponse) await this.store.putCache(prepared.cacheKey, { response, surface: scope.surface, scopeId: scope.scopeId, activityId: scope.activityId, contentVersion: scope.contentVersion });
    if (body.requestType !== 'project-questions') await this.store.persistInteraction({ ownerKey: prepared.ownerKey, requestId: prepared.requestId, scope, userText: String(body.learnerMessage ?? body.question?.label ?? ''), assistant: response, metadata: { language: body.language ?? body.context?.languageId ?? null, fullAnswerRequested: /(?:full|complete)\s+(?:answer|solution|code)/iu.test(String(body.learnerMessage ?? body.question?.label ?? '')), cacheHit: Boolean(prepared.cachedResponse) } });
    const usage = await this.store.settleIncluded(prepared.reservation, { consume: true }); return { usedMessages: usage?.usedMessages ?? 0, includedLimit: prepared.capability.includedTutorMessages, unlimited: prepared.capability.unlimitedTutorMessages, remainingMessages: prepared.capability.unlimitedTutorMessages ? null : Math.max(0, prepared.capability.includedTutorMessages - (usage?.usedMessages ?? 0)) };
  }
  async release(prepared) { if (prepared) await this.store.settleIncluded(prepared.reservation, { consume: false }); }
}
