import { resolveGoogleWifConfiguration } from '../auth/VercelGoogleCredentialAdapter.js';
import { AIServiceError } from '../ai/AIServiceError.js';

// The Admin Vercel project must not impersonate the AI Tutor or compiler identity.
// The service-account address is supplied by Production configuration, not bundled.
const adminProfile = Object.freeze({
  projectId: 'mi-tutora-pro',
  wif: Object.freeze({
    projectNumber: '196429461457',
    poolId: 'ai-tutor-vercel',
    providerId: 'vercel-admin-production',
  }),
  matchesServiceAccount: (email, projectId) => /^ycoders-admin-[a-z0-9-]+$/.test(email.split('@')[0])
    && email.endsWith(`@${projectId}.iam.gserviceaccount.com`),
});

export function resolveAdminGoogleWifConfiguration(environment = process.env) {
  if (environment.VERCEL_ENV === 'production' && environment.VERCEL_PROJECT_ID
    && environment.VERCEL_PROJECT_ID !== 'prj_VdnJ6Q6FzEL5u5nSvUL88uoMB4xq') {
    // Deployment metadata is defense in depth when provided by the platform.
    // The provider condition remains the authoritative project/subject gate.
    throw new AIServiceError('ai/server-unavailable', 'Admin server configuration is unavailable.', { status: 503 });
  }
  return resolveGoogleWifConfiguration(environment, adminProfile);
}
