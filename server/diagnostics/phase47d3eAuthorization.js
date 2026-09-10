import { timingSafeEqual } from 'node:crypto';

export function authorizePhase47d3eProbe(request, environment = process.env) {
  const expected = String(environment.AI_TUTOR_INFRA_PROBE_SECRET || '');
  const supplied = String(request?.headers?.['x-ai-tutor-infra-probe'] || '');
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function createPhase47d3eHandler({ layer, run, environment = process.env } = {}) {
  return async function phase47d3eHandler(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ probe: 'phase47d3e', layer, status: 'method-not-allowed' });
    }
    if (!authorizePhase47d3eProbe(request, environment)) {
      return response.status(401).json({ probe: 'phase47d3e', layer, status: 'unauthorized' });
    }
    if (request.body && Object.keys(request.body).length) {
      return response.status(400).json({ probe: 'phase47d3e', layer, status: 'invalid-request' });
    }
    try {
      await run({ request, environment });
      return response.status(200).json({ probe: 'phase47d3e', layer, status: 'pass' });
    } catch {
      return response.status(503).json({ probe: 'phase47d3e', layer, status: 'fail' });
    }
  };
}
