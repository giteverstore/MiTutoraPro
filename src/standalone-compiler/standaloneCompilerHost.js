const STANDALONE_COMPILER_HOSTS = new Set([
  'compiler.ycoders.com',
  'ycoders-compiler.vercel.app',
]);

export function isStandaloneCompilerHost(hostname, deploymentTarget = '') {
  return String(deploymentTarget).trim().toLowerCase() === 'compiler'
    || STANDALONE_COMPILER_HOSTS.has(String(hostname).trim().toLowerCase());
}

export function isStandaloneCompilerRequest({ hostname, pathname, deploymentTarget = '' }) {
  return isStandaloneCompilerHost(hostname, deploymentTarget)
    || pathname === '/__compiler'
    || pathname.startsWith('/__compiler/');
}
