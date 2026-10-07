import { verifyFirebaseIdToken } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import {
  ADMIN_PERMISSIONS,
  adminRoleFromClaims,
  hasAdminPermission,
} from '../../shared/admin/adminAuthorization.js';

export class AdminAuthorizationError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'AdminAuthorizationError';
    this.code = code;
    this.status = status;
  }
}

function bearerToken(request) {
  const header = request?.headers?.authorization ?? request?.headers?.Authorization;
  const match = typeof header === 'string' ? header.match(/^Bearer\s+([^\s]+)$/i) : null;
  if (!match) throw new AdminAuthorizationError('admin/auth-required', 'Admin authentication is required.', 401);
  return match[1];
}

export async function requireAdminAuth(request, {
  verifyToken = verifyFirebaseIdToken,
  environment = process.env,
  googleCredentials,
} = {}) {
  let claims;
  try {
    claims = await verifyToken(bearerToken(request), { environment, googleCredentials });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) throw error;
    throw new AdminAuthorizationError('admin/auth-invalid', 'The Admin session is not valid.', 401);
  }
  const role = adminRoleFromClaims(claims);
  if (!claims?.uid || !role) {
    throw new AdminAuthorizationError('admin/access-denied', 'This account does not have access to Y Coders Admin.', 403);
  }
  return Object.freeze({ uid: claims.uid, email: claims.email ?? '', role, claims });
}

export async function requireAdminPermission(request, permission, options) {
  if (!Object.values(ADMIN_PERMISSIONS).includes(permission)) {
    throw new TypeError(`Unknown Admin permission: ${permission}`);
  }
  const actor = await requireAdminAuth(request, options);
  if (!hasAdminPermission(actor.role, permission)) {
    throw new AdminAuthorizationError('admin/permission-denied', 'This Admin action is not permitted for this account.', 403);
  }
  return actor;
}
