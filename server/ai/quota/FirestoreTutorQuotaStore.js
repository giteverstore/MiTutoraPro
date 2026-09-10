import { AIServiceError } from '../AIServiceError.js';

function dayStartUtc(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function windowCounter(current, now, windowMs) {
  if (!current || !Number.isFinite(current.startedAt) || now - current.startedAt >= windowMs) {
    return { startedAt: now, requests: 0 };
  }
  return { startedAt: current.startedAt, requests: Number(current.requests) || 0 };
}

function dailyCounter(current, now) {
  const startedAt = dayStartUtc(now);
  if (!current || current.startedAt !== startedAt) {
    return { startedAt, requests: 0, inputTokens: 0, outputTokens: 0, costMicros: 0, reservedInputTokens: 0, reservedOutputTokens: 0, reservedCostMicros: 0, unknownCostRequests: 0 };
  }
  return {
    startedAt,
    requests: Number(current.requests) || 0,
    inputTokens: Number(current.inputTokens) || 0,
    outputTokens: Number(current.outputTokens) || 0,
    costMicros: Number(current.costMicros) || 0,
    reservedInputTokens: Number(current.reservedInputTokens) || 0,
    reservedOutputTokens: Number(current.reservedOutputTokens) || 0,
    reservedCostMicros: Number(current.reservedCostMicros) || 0,
    unknownCostRequests: Number(current.unknownCostRequests) || 0,
  };
}

function quotaExceeded(message = 'The AI Tutor usage limit has been reached. Try again later.') {
  return new AIServiceError('ai/rate-limited', message, { status: 429 });
}

const RESERVATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

function usageEnvelopeMatches(left = {}, right = {}) {
  return left.inputTokens === right.inputTokens
    && left.outputTokens === right.outputTokens
    && left.costMicros === right.costMicros;
}

export function assertMatchingQuotaReservation(existing, requested) {
  if (existing.identityKey === requested.identityKey
    && usageEnvelopeMatches(existing.estimate, requested.estimate)
    && usageEnvelopeMatches(existing.maximum, requested.maximum)) {
    return existing;
  }
  throw new AIServiceError(
    'ai/idempotency-conflict',
    'The AI Tutor request could not be safely resumed.',
    { status: 409 },
  );
}

export function applyQuotaReservation(current, { now, policy, maximum }) {
  const burst = windowCounter(current?.burst, now, policy.burst.windowMs);
  const sustained = windowCounter(current?.sustained, now, policy.sustained.windowMs);
  const hourly = windowCounter(current?.hourly, now, policy.hourly.windowMs);
  const daily = dailyCounter(current?.daily, now);
  if (burst.requests + 1 > policy.burst.requests || sustained.requests + 1 > policy.sustained.requests
    || hourly.requests + 1 > policy.hourly.requests || daily.requests + 1 > policy.daily.requests) {
    throw quotaExceeded();
  }
  if (daily.inputTokens + daily.reservedInputTokens + maximum.inputTokens > policy.daily.inputTokens
    || daily.outputTokens + daily.reservedOutputTokens + maximum.outputTokens > policy.daily.outputTokens) {
    throw quotaExceeded('The AI Tutor token limit has been reached. Try again later.');
  }
  if (policy.daily.costMicros != null && maximum.costMicros == null) {
    throw new AIServiceError('ai/quota-unavailable', 'The AI Tutor usage budget cannot be verified.', { status: 503 });
  }
  if (policy.daily.costMicros != null
    && daily.costMicros + daily.reservedCostMicros + maximum.costMicros > policy.daily.costMicros) {
    throw quotaExceeded('The AI Tutor usage budget has been reached. Try again later.');
  }
  return {
    burst: { ...burst, requests: burst.requests + 1 },
    sustained: { ...sustained, requests: sustained.requests + 1 },
    hourly: { ...hourly, requests: hourly.requests + 1 },
    daily: {
      ...daily,
      requests: daily.requests + 1,
      reservedInputTokens: daily.reservedInputTokens + maximum.inputTokens,
      reservedOutputTokens: daily.reservedOutputTokens + maximum.outputTokens,
      reservedCostMicros: daily.reservedCostMicros + (maximum.costMicros ?? 0),
      unknownCostRequests: daily.unknownCostRequests + (maximum.costMicros == null ? 1 : 0),
    },
    updatedAt: now,
  };
}

export function applyQuotaSettlement(current, reservation, usage) {
  const daily = { ...current.daily };
  const reported = {
    inputTokens: Math.max(0, Number(usage.inputTokens) || 0),
    outputTokens: Math.max(0, Number(usage.outputTokens) || 0),
    costMicros: usage.costMicros == null ? null : Math.max(0, Number(usage.costMicros) || 0),
  };
  const invalidReport = reported.inputTokens > reservation.maximum.inputTokens
    || reported.outputTokens > reservation.maximum.outputTokens
    || (reservation.maximum.costMicros != null && (reported.costMicros == null || reported.costMicros > reservation.maximum.costMicros));
  const charged = usage.chargeEstimate === true || invalidReport ? reservation.maximum : reported;
  daily.reservedInputTokens = Math.max(0, daily.reservedInputTokens - reservation.maximum.inputTokens);
  daily.reservedOutputTokens = Math.max(0, daily.reservedOutputTokens - reservation.maximum.outputTokens);
  daily.reservedCostMicros = Math.max(0, daily.reservedCostMicros - (reservation.maximum.costMicros ?? 0));
  daily.unknownCostRequests = Math.max(0, daily.unknownCostRequests - (reservation.maximum.costMicros == null ? 1 : 0));
  daily.inputTokens += charged.inputTokens;
  daily.outputTokens += charged.outputTokens;
  daily.costMicros += charged.costMicros ?? 0;
  if (charged.costMicros == null) daily.unknownCostRequests += 1;
  return { ...current, daily, updatedAt: usage.now };
}

export class FirestoreTutorQuotaStore {
  constructor({ db, collection = 'aiTutorQuotas', reservationCollection = 'aiTutorQuotaReservations', now = Date.now } = {}) {
    if (!db?.runTransaction) throw new TypeError('A Firestore transaction client is required.');
    this.db = db;
    this.collection = collection;
    this.reservationCollection = reservationCollection;
    this.now = now;
  }

  async reserve({ identityKey, requestId, policy, estimate, maximum = estimate }) {
    const quotaRef = this.db.collection(this.collection).doc(identityKey);
    const reservationRef = this.db.collection(this.reservationCollection).doc(requestId);
    const now = this.now();
    return this.db.runTransaction(async (transaction) => {
      const existingReservation = await transaction.get(reservationRef);
      if (existingReservation.exists) {
        return assertMatchingQuotaReservation(existingReservation.data(), { identityKey, estimate, maximum });
      }
      const quotaSnapshot = await transaction.get(quotaRef);
      const next = applyQuotaReservation(quotaSnapshot.exists ? quotaSnapshot.data() : null, { now, policy, maximum });
      const reservation = { requestId, identityKey, estimate, maximum, state: 'PENDING', createdAt: now, expiresAt: new Date(now + RESERVATION_RETENTION_MS) };
      transaction.set(quotaRef, next, { merge: false });
      transaction.create(reservationRef, reservation);
      return reservation;
    });
  }

  async settle(reservation, usage = {}) {
    if (!reservation?.requestId || !reservation?.identityKey) return;
    const quotaRef = this.db.collection(this.collection).doc(reservation.identityKey);
    const reservationRef = this.db.collection(this.reservationCollection).doc(reservation.requestId);
    const now = this.now();
    await this.db.runTransaction(async (transaction) => {
      const [quotaSnapshot, reservationSnapshot] = await Promise.all([transaction.get(quotaRef), transaction.get(reservationRef)]);
      if (!reservationSnapshot.exists || reservationSnapshot.data().state !== 'PENDING') return;
      const storedReservation = reservationSnapshot.data();
      if (storedReservation.identityKey !== reservation.identityKey) {
        throw new AIServiceError(
          'ai/idempotency-conflict',
          'The AI Tutor request could not be safely resumed.',
          { status: 409 },
        );
      }
      const next = applyQuotaSettlement(quotaSnapshot.data(), storedReservation, { ...usage, now });
      transaction.set(quotaRef, next, { merge: false });
      transaction.update(reservationRef, { state: 'SETTLED', outcome: String(usage.outcome || 'unknown'), settledAt: now });
    });
  }
}
