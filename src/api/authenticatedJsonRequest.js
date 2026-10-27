export async function authenticatedJsonPost({ tokenProvider, fetchImpl, url, body }) {
  const token = await tokenProvider();
  if (!token) return null;

  const hasBody = body !== undefined;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try {
    if (typeof response.json === 'function') payload = await response.json();
  } catch { /* Tolerate empty and malformed JSON responses. */ }
  return { response, payload };
}
