import { createV2PilotGatewayHandler } from '../../server/v2-pilot/V2PilotGateway.js';
import { createV2ProgressHandler } from '../../server/v2-pilot/V2ProgressHandler.js';

export const config = { maxDuration: 60 };

function pathSegments(request) {
  const value = request.query?.path;
  return (Array.isArray(value) ? value : String(value ?? '').split('/')).filter(Boolean);
}

export function createV2PilotApiHandler({
  courseHandler = createV2PilotGatewayHandler(),
  progressHandler = createV2ProgressHandler(),
} = {}) {
  return function v2PilotApi(request, response) {
    const [resource, contentId, segment, version, ...remainder] = pathSegments(request);
    if (resource === 'courses' && contentId) {
      request.query = { ...request.query, path: [contentId, segment, version, ...remainder].filter(Boolean).join('/') };
      return courseHandler(request, response);
    }
    if (resource === 'progress' && contentId && segment === 'versions' && /^\d+$/.test(version ?? '') && remainder.length === 0) {
      request.query = { ...request.query, contentId, version };
      return progressHandler(request, response);
    }
    return response.status(404).json({ ok: false, error: { code: 'v2/route-not-found', message: 'The V2 pilot API route does not exist.' } });
  };
}

export default createV2PilotApiHandler();
