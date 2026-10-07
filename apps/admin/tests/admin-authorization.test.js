import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  adminRoleFromClaims,
  hasAdminPermission,
  isAdminRole,
} from '../../../shared/admin/adminAuthorization.js';
import {
  AdminAuthorizationError,
  requireAdminAuth,
  requireAdminPermission,
} from '../../../server/admin/AdminAuthorization.js';

describe('central Admin role and permission contract', () => {
  it.each(Object.values(ADMIN_ROLES))('recognizes and permits Admin access for %s', (role) => {
    expect(isAdminRole(role)).toBe(true);
    expect(hasAdminPermission(role, ADMIN_PERMISSIONS.ADMIN_ACCESS)).toBe(true);
  });

  it('denies missing and unknown roles', () => {
    expect(adminRoleFromClaims({})).toBeNull();
    expect(adminRoleFromClaims({ adminRole: 'OWNER' })).toBeNull();
    expect(hasAdminPermission('OWNER', ADMIN_PERMISSIONS.ADMIN_ACCESS)).toBe(false);
  });

  it('grants publishing only to Super Admin and Content Admin', () => {
    expect(hasAdminPermission(ADMIN_ROLES.SUPER_ADMIN, ADMIN_PERMISSIONS.CONTENT_PUBLISH)).toBe(true);
    expect(hasAdminPermission(ADMIN_ROLES.CONTENT_ADMIN, ADMIN_PERMISSIONS.CONTENT_PUBLISH)).toBe(true);
    expect(hasAdminPermission(ADMIN_ROLES.CONTENT_EDITOR, ADMIN_PERMISSIONS.CONTENT_PUBLISH)).toBe(false);
    expect(hasAdminPermission(ADMIN_ROLES.CONTENT_REVIEWER, ADMIN_PERMISSIONS.CONTENT_PUBLISH)).toBe(false);
  });

  it('does not treat legacy certification admin or client values as an Admin role', () => {
    expect(adminRoleFromClaims({ admin: true })).toBeNull();
    expect(adminRoleFromClaims({ profile: { role: ADMIN_ROLES.SUPER_ADMIN } })).toBeNull();
  });
});

describe('server Admin authorization boundary', () => {
  const request = { headers: { authorization: 'Bearer verified-token' } };

  it('returns a verified authorized actor', async () => {
    const verifyToken = vi.fn().mockResolvedValue({ uid: 'admin-1', email: 'editor@example.test', adminRole: ADMIN_ROLES.CONTENT_EDITOR });
    await expect(requireAdminAuth(request, { verifyToken })).resolves.toMatchObject({ uid: 'admin-1', role: ADMIN_ROLES.CONTENT_EDITOR });
    expect(verifyToken).toHaveBeenCalledWith('verified-token', expect.any(Object));
  });

  it('rejects missing tokens and unauthorized verified accounts', async () => {
    await expect(requireAdminAuth({ headers: {} }, { verifyToken: vi.fn() })).rejects.toMatchObject({ status: 401, code: 'admin/auth-required' });
    await expect(requireAdminAuth(request, { verifyToken: vi.fn().mockResolvedValue({ uid: 'learner-1' }) })).rejects.toMatchObject({ status: 403, code: 'admin/access-denied' });
  });

  it('enforces permissions after authentication', async () => {
    const editor = vi.fn().mockResolvedValue({ uid: 'editor-1', adminRole: ADMIN_ROLES.CONTENT_EDITOR });
    await expect(requireAdminPermission(request, ADMIN_PERMISSIONS.CONTENT_PUBLISH, { verifyToken: editor })).rejects.toBeInstanceOf(AdminAuthorizationError);
    const contentAdmin = vi.fn().mockResolvedValue({ uid: 'admin-1', adminRole: ADMIN_ROLES.CONTENT_ADMIN });
    await expect(requireAdminPermission(request, ADMIN_PERMISSIONS.CONTENT_PUBLISH, { verifyToken: contentAdmin })).resolves.toMatchObject({ role: ADMIN_ROLES.CONTENT_ADMIN });
  });
});
