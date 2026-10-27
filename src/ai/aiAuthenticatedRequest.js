export function aiAuthenticatedRequest({ fetchImpl, url, token, body, signal }) {
  const hasBody = body !== undefined;
  return fetchImpl.call(globalThis, url, {
    ...(hasBody ? { method: 'POST' } : {}),
    headers: { Authorization: `Bearer ${token}`, ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    signal,
  });
}
