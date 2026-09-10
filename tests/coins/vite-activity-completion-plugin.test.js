import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { assertLocalCoinEnvironment, viteActivityCompletionPlugin } from '../../server/coins/viteActivityCompletionPlugin.js';

const environment = {
  LOCAL_COIN_FULL_STACK: 'true', FIREBASE_PROJECT_ID: 'demo-mitutora-coins',
  VITE_FIREBASE_PROJECT_ID: 'demo-mitutora-coins', VITE_FIREBASE_USE_EMULATORS: 'true',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

function request(method, body = '') {
  const value = new EventEmitter();
  Object.assign(value, { method, url: '/api/activity/complete', headers: {}, setEncoding: vi.fn() });
  queueMicrotask(() => { if (body) value.emit('data', body); value.emit('end'); });
  return value;
}

function response() {
  const value = new EventEmitter();
  value.headers = {};
  value.setHeader = vi.fn((name, header) => { value.headers[name] = header; });
  value.end = vi.fn((body) => { value.body = JSON.parse(body); });
  return value;
}

function middlewareFor(handler) {
  let middleware;
  viteActivityCompletionPlugin(environment, { handlerFactory: () => handler }).configureServer({
    middlewares: { use: (next) => { middleware = next; } },
  });
  return middleware;
}

describe('local activity completion Vite middleware', () => {
  it('fails closed unless browser and server use the pinned emulator project', () => {
    expect(() => assertLocalCoinEnvironment({ ...environment, FIREBASE_PROJECT_ID: 'mi-tutora-pro' })).toThrow(/pinned demo project/);
    expect(() => assertLocalCoinEnvironment({ ...environment, FIRESTORE_EMULATOR_HOST: 'remote.example:8080' })).toThrow(/loopback/);
  });

  it('parses POST JSON and invokes the real-handler boundary', async () => {
    const handler = vi.fn(async (req, res) => res.status(200).json({ activityId: req.body.activityId }));
    const res = response();
    await middlewareFor(handler)(request('POST', '{"activityId":"challenge-balanced-brackets"}'), res, vi.fn());
    expect(handler).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ activityId: 'challenge-balanced-brackets' });
  });

  it('rejects unsupported methods and malformed JSON before the handler', async () => {
    const handler = vi.fn();
    const methodResponse = response();
    await middlewareFor(handler)(request('GET'), methodResponse, vi.fn());
    expect(methodResponse.statusCode).toBe(405);
    const malformedResponse = response();
    await middlewareFor(handler)(request('POST', '{'), malformedResponse, vi.fn());
    expect(malformedResponse.statusCode).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});
