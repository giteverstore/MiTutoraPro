export const ADMIN_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  CONTENT_ADMIN: 'CONTENT_ADMIN',
  CONTENT_EDITOR: 'CONTENT_EDITOR',
  CONTENT_REVIEWER: 'CONTENT_REVIEWER',
});

export const ADMIN_PERMISSIONS = Object.freeze({
  ADMIN_ACCESS: 'ADMIN_ACCESS',
  CONTENT_CREATE: 'CONTENT_CREATE',
  CONTENT_EDIT: 'CONTENT_EDIT',
  CONTENT_VALIDATE: 'CONTENT_VALIDATE',
  CONTENT_PREVIEW: 'CONTENT_PREVIEW',
  CONTENT_PUBLISH: 'CONTENT_PUBLISH',
  CONTENT_REVIEW: 'CONTENT_REVIEW',
  MEDIA_MANAGE: 'MEDIA_MANAGE',
  AUDIT_VIEW: 'AUDIT_VIEW',
  ADMIN_MANAGE: 'ADMIN_MANAGE',
});

const ALL_PERMISSIONS = Object.freeze(Object.values(ADMIN_PERMISSIONS));
const CONTENT_AUTHOR_PERMISSIONS = Object.freeze([
  ADMIN_PERMISSIONS.ADMIN_ACCESS,
  ADMIN_PERMISSIONS.CONTENT_CREATE,
  ADMIN_PERMISSIONS.CONTENT_EDIT,
  ADMIN_PERMISSIONS.CONTENT_VALIDATE,
  ADMIN_PERMISSIONS.CONTENT_PREVIEW,
]);

export const ADMIN_ROLE_PERMISSIONS = Object.freeze({
  [ADMIN_ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ADMIN_ROLES.CONTENT_ADMIN]: Object.freeze([
    ...CONTENT_AUTHOR_PERMISSIONS,
    ADMIN_PERMISSIONS.CONTENT_PUBLISH,
    ADMIN_PERMISSIONS.CONTENT_REVIEW,
    ADMIN_PERMISSIONS.MEDIA_MANAGE,
    ADMIN_PERMISSIONS.AUDIT_VIEW,
  ]),
  [ADMIN_ROLES.CONTENT_EDITOR]: CONTENT_AUTHOR_PERMISSIONS,
  [ADMIN_ROLES.CONTENT_REVIEWER]: Object.freeze([
    ADMIN_PERMISSIONS.ADMIN_ACCESS,
    ADMIN_PERMISSIONS.CONTENT_VALIDATE,
    ADMIN_PERMISSIONS.CONTENT_PREVIEW,
    ADMIN_PERMISSIONS.CONTENT_REVIEW,
  ]),
});

export const isAdminRole = (role) => typeof role === 'string'
  && Object.prototype.hasOwnProperty.call(ADMIN_ROLE_PERMISSIONS, role);

export const permissionsForRole = (role) => isAdminRole(role)
  ? ADMIN_ROLE_PERMISSIONS[role]
  : Object.freeze([]);

export const hasAdminPermission = (role, permission) => permissionsForRole(role).includes(permission);

// The claim is intentionally singular for V1. Legacy certification `admin: true`
// and client-editable profile fields do not grant Content Admin access.
export const adminRoleFromClaims = (claims) => isAdminRole(claims?.adminRole)
  ? claims.adminRole
  : null;

export const adminRoleLabel = (role) => ({
  [ADMIN_ROLES.SUPER_ADMIN]: 'Super Admin',
  [ADMIN_ROLES.CONTENT_ADMIN]: 'Content Admin',
  [ADMIN_ROLES.CONTENT_EDITOR]: 'Content Editor',
  [ADMIN_ROLES.CONTENT_REVIEWER]: 'Content Reviewer',
}[role] ?? 'Unauthorized');
