import { describe, expect, it, vi } from "vitest";
import {
  AdminRoleProvisioningError,
  claimsWithAdminRole,
  claimsWithoutAdminRole,
  parseAdminRoleArguments,
  provisionAdminRole,
} from "../../scripts/admin/adminRoleProvisioning.mjs";

describe("admin role provisioning", () => {
  it("parses email and UID selectors", () => {
    expect(
      parseAdminRoleArguments(["--email", "admin@example.com", "--role", "SUPER_ADMIN"]),
    ).toEqual({ email: "admin@example.com", uid: undefined, role: "SUPER_ADMIN", remove: false });
    expect(
      parseAdminRoleArguments(["--uid", "firebase-uid", "--role", "CONTENT_EDITOR"]),
    ).toEqual({ email: undefined, uid: "firebase-uid", role: "CONTENT_EDITOR", remove: false });
  });

  it.each([
    [[]],
    [["--email", "a@example.com", "--uid", "uid", "--role", "SUPER_ADMIN"]],
    [["--email", "a@example.com"]],
    [["--email", "a@example.com", "--role", "OWNER"]],
    [["--unknown", "value"]],
  ])("rejects invalid arguments", (argv) => {
    expect(() => parseAdminRoleArguments(argv)).toThrow(AdminRoleProvisioningError);
  });

  it("validates remove arguments", () => {
    expect(
      parseAdminRoleArguments(["--email", "admin@example.com"], { remove: true }),
    ).toEqual({ email: "admin@example.com", uid: undefined, role: null, remove: true });
    expect(() =>
      parseAdminRoleArguments(
        ["--email", "admin@example.com", "--role", "SUPER_ADMIN"],
        { remove: true },
      ),
    ).toThrow("--role is not accepted");
  });

  it("sets and removes only adminRole", () => {
    const original = { subscription: "premium", featureFlag: true, adminRole: "CONTENT_EDITOR" };
    expect(claimsWithAdminRole(original, "SUPER_ADMIN")).toEqual({
      subscription: "premium",
      featureFlag: true,
      adminRole: "SUPER_ADMIN",
    });
    expect(claimsWithoutAdminRole(original)).toEqual({ subscription: "premium", featureFlag: true });
    expect(original.adminRole).toBe("CONTENT_EDITOR");
  });

  it("resolves a user and writes merged claims", async () => {
    const auth = {
      getUserByEmail: vi.fn().mockResolvedValue({
        uid: "uid-1",
        email: "admin@example.com",
        customClaims: { existing: "claim", adminRole: "CONTENT_REVIEWER" },
      }),
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    };

    const result = await provisionAdminRole({
      auth,
      email: "admin@example.com",
      role: "SUPER_ADMIN",
    });

    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("uid-1", {
      existing: "claim",
      adminRole: "SUPER_ADMIN",
    });
    expect(result).toEqual({
      email: "admin@example.com",
      uid: "uid-1",
      previousAdminRole: "CONTENT_REVIEWER",
      newAdminRole: "SUPER_ADMIN",
    });
  });

  it("removes only adminRole for a UID-selected user", async () => {
    const auth = {
      getUser: vi.fn().mockResolvedValue({
        uid: "uid-2",
        email: "editor@example.com",
        customClaims: { existing: "claim", adminRole: "CONTENT_EDITOR" },
      }),
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    };

    await provisionAdminRole({ auth, uid: "uid-2", remove: true });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("uid-2", { existing: "claim" });
  });
});
