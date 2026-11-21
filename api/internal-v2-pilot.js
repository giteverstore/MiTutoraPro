import { createV2PilotGatewayHandler, createV2PracticePilotGatewayHandler } from '../server/v2-pilot/V2PilotGateway.js';
import { createV2ProgressHandler } from '../server/v2-pilot/V2ProgressHandler.js';

export const config = { maxDuration: 60 };

function normalizedPath(value) {
  const joined = Array.isArray(value) ? value.join('/') : String(value ?? '');
  return joined.replace(/^\/+|\/+$/g, '');
}

function appendQueryValue(search, key, value) {
  if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)));
  else if (value != null) search.append(key, String(value));
}

export function reconstructV2PilotPublicRequest(request) {
  const pilotPath = normalizedPath(request.query?.pilotPath);
  const query = { ...request.query, path: pilotPath };
  delete query.pilotPath;
  request.query = query;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'path') appendQueryValue(search, key, value);
  }
  const suffix = search.size ? `?${search}` : '';
  request.url = `/api/v2-pilot${pilotPath ? `/${pilotPath}` : ''}${suffix}`;
  return pilotPath;
}

function pathSegments(request) {
  return normalizedPath(request.query?.path).split('/').filter(Boolean);
}

export function createV2PilotApiHandler({
  courseHandler = createV2PilotGatewayHandler(),
  practiceHandler = createV2PracticePilotGatewayHandler(),
  progressHandler = createV2ProgressHandler(),
} = {}) {
  return function v2PilotApi(request, response) {
    reconstructV2PilotPublicRequest(request);
    const [resource, contentId, segment, version, ...remainder] = pathSegments(request);
    if (resource === 'courses' && contentId) {
      request.query = { ...request.query, path: [contentId, segment, version, ...remainder].filter(Boolean).join('/') };
      return courseHandler(request, response);
    }
    if (resource === 'practice' && contentId) {
      request.query = { ...request.query, path: [contentId, segment, version, ...remainder].filter(Boolean).join('/') };
      return practiceHandler(request, response);
    }
    if (resource === 'progress' && contentId && segment === 'versions' && /^\d+$/.test(version ?? '') && remainder.length === 0) {
      request.query = { ...request.query, contentId, version };
      return progressHandler(request, response);
    }
    return response.status(404).json({ ok: false, error: { code: 'v2/route-not-found', message: 'The V2 pilot API route does not exist.' } });
  };
}

export default createV2PilotApiHandler();
