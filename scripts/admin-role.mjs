import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  AdminRoleProvisioningError,
  parseAdminRoleArguments,
  provisionAdminRole,
} from "./admin/adminRoleProvisioning.mjs";

const APP_NAME = "ycoders-admin-role-provisioner";

function initializeAdminApp() {
  const existingApp = getApps().find((candidate) => candidate.name === APP_NAME);
  if (existingApp) return existingApp;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  return initializeApp(
    {
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    },
    APP_NAME,
  );
}

function printSummary(result) {
  console.log(`Email: ${result.email}`);
  console.log(`UID: ${result.uid}`);
  console.log(`Previous adminRole: ${result.previousAdminRole ?? "(none)"}`);
  console.log(`New adminRole: ${result.newAdminRole ?? "(none)"}`);
  console.log("Sign out and sign back in to refresh the Firebase ID token.");
}

function reportError(error) {
  if (error instanceof AdminRoleProvisioningError) {
    console.error(`Admin role provisioning failed: ${error.message}`);
    return;
  }
  if (error?.code === "auth/user-not-found") {
    console.error("Admin role provisioning failed: Firebase Auth user not found.");
    return;
  }
  console.error(
    `Admin role provisioning failed: ${error?.message || "Firebase Admin initialization or request failed."}`,
  );
}

let app;
try {
  const remove = process.argv.includes("--remove");
  const argv = process.argv.slice(2).filter((argument) => argument !== "--remove");
  const options = parseAdminRoleArguments(argv, { remove });
  app = initializeAdminApp();
  const result = await provisionAdminRole({ auth: getAuth(app), ...options });
  printSummary(result);
} catch (error) {
  reportError(error);
  process.exitCode = 1;
} finally {
  if (app) await deleteApp(app);
}
