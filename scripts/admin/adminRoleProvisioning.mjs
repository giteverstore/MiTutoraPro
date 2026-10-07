import {
  ADMIN_ROLES,
  isAdminRole,
} from "../../shared/admin/adminAuthorization.js";

export class AdminRoleProvisioningError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdminRoleProvisioningError";
  }
}

function readOption(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new AdminRoleProvisioningError(`${option} requires a value.`);
  }
  return value;
}

export function parseAdminRoleArguments(argv, { remove = false } = {}) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!["--email", "--uid", "--role"].includes(option)) {
      throw new AdminRoleProvisioningError(`Unknown option: ${option}`);
    }
    if (parsed[option]) {
      throw new AdminRoleProvisioningError(`${option} may only be provided once.`);
    }
    parsed[option] = readOption(argv, index, option);
    index += 1;
  }

  const email = parsed["--email"]?.trim();
  const uid = parsed["--uid"]?.trim();
  const role = parsed["--role"]?.trim();

  if ((!email && !uid) || (email && uid)) {
    throw new AdminRoleProvisioningError(
      "Provide exactly one user selector: --email or --uid.",
    );
  }

  if (remove) {
    if (role) {
      throw new AdminRoleProvisioningError(
        "--role is not accepted when removing an admin role.",
      );
    }
  } else {
    if (!role) {
      throw new AdminRoleProvisioningError("--role is required.");
    }
    if (!isAdminRole(role)) {
      throw new AdminRoleProvisioningError(
        `Invalid role. Allowed roles: ${Object.values(ADMIN_ROLES).join(", ")}.`,
      );
    }
  }

  return { email, uid, role: remove ? null : role, remove };
}

export function claimsWithAdminRole(customClaims, role) {
  if (!isAdminRole(role)) {
    throw new AdminRoleProvisioningError("Cannot apply an invalid admin role.");
  }
  return { ...(customClaims ?? {}), adminRole: role };
}

export function claimsWithoutAdminRole(customClaims) {
  const nextClaims = { ...(customClaims ?? {}) };
  delete nextClaims.adminRole;
  return nextClaims;
}

export async function provisionAdminRole({ auth, email, uid, role, remove = false }) {
  const user = email ? await auth.getUserByEmail(email) : await auth.getUser(uid);
  const previousAdminRole = user.customClaims?.adminRole ?? null;
  const nextClaims = remove
    ? claimsWithoutAdminRole(user.customClaims)
    : claimsWithAdminRole(user.customClaims, role);

  await auth.setCustomUserClaims(user.uid, nextClaims);

  return {
    email: user.email ?? "(no email)",
    uid: user.uid,
    previousAdminRole,
    newAdminRole: remove ? null : role,
  };
}
