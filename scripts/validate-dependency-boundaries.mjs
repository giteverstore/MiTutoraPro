import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const SERVER_ONLY_PACKAGE_PATTERN = /(?:from\s+|import\s*\(|require\s*\()(['"])(?:firebase-admin(?:\/[^'"]+)?|@google-cloud\/firestore|google-auth-library|@vercel\/oidc|[^'"]*server\/(?:ai\/quota|auth)[^'"]*)\1/;

export function findServerDependencyImports(files) {
  return files
    .filter((file) => existsSync(file))
    .filter((file) => SERVER_ONLY_PACKAGE_PATTERN.test(readFileSync(file, 'utf8')));
}

export function assertBrowserDependencyBoundary(files) {
  const offenders = findServerDependencyImports(files);
  if (offenders.length) {
    throw new Error(`Browser source imports a server-only Firebase dependency: ${offenders.join(', ')}`);
  }
  return files.length;
}

export function validateDependencyBoundaries({ packageManifest, browserFiles }) {
  if (!packageManifest.dependencies?.['firebase-admin']) {
    throw new Error('Production serverless functions require firebase-admin in root dependencies.');
  }
  if (packageManifest.devDependencies?.['firebase-admin']) {
    throw new Error('firebase-admin must not be classified as development-only.');
  }
  if (!packageManifest.dependencies?.['@google-cloud/firestore']) throw new Error('@google-cloud/firestore must be an explicit server runtime dependency.');
  if (!packageManifest.dependencies?.['google-auth-library']) throw new Error('google-auth-library must be an explicit server runtime dependency.');
  if (!packageManifest.dependencies?.['@vercel/oidc']) throw new Error('@vercel/oidc must be an explicit server runtime dependency.');
  return assertBrowserDependencyBoundary(browserFiles);
}

function repositoryBrowserFiles() {
  const tracked = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src'], { encoding: 'utf8' });
  return [...new Set(`${tracked}\n${untracked}`.split(/\r?\n/))]
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && existsSync(file));
}

export function runRepositoryDependencyBoundaryValidation() {
  const packageManifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const browserFiles = repositoryBrowserFiles();
  const inspected = validateDependencyBoundaries({ packageManifest, browserFiles });
  console.log(`Dependency boundary validation passed (${inspected} browser source files inspected; firebase-admin retained for server runtimes).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) runRepositoryDependencyBoundaryValidation();
