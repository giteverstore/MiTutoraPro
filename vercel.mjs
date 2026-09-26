const MAIN_DEPLOYMENT_TARGET = 'main';
const COMPILER_DEPLOYMENT_TARGET = 'compiler';

export const CRON_SCHEDULES = Object.freeze({
  payments: Object.freeze({ path: '/api/payments/reconcile', schedule: '15 2 * * *' }),
  shares: Object.freeze({ path: '/api/compiler/share/janitor', schedule: '50 3 * * *' }),
});

export function createVercelConfig(target = MAIN_DEPLOYMENT_TARGET) {
  if (![MAIN_DEPLOYMENT_TARGET, COMPILER_DEPLOYMENT_TARGET].includes(target)) {
    throw new Error(`Unsupported YCODERS_DEPLOYMENT_TARGET: ${target}`);
  }

  return {
    framework: 'vite',
    outputDirectory: 'dist',
    functions: {
      'api/ai/explain.js': { maxDuration: 60, supportsCancellation: true },
      'api/compiler/[...path].js': { maxDuration: 60, supportsCancellation: true },
    },
    crons: target === COMPILER_DEPLOYMENT_TARGET
      ? [CRON_SCHEDULES.shares]
      : [CRON_SCHEDULES.payments, CRON_SCHEDULES.shares],
    routes: [
      { handle: 'filesystem' },
      { src: '/((?!api(?:/|$)|assets(?:/|$)|vendor(?:/|$)|src(?:/|$)|node_modules(?:/|$)|@[^/]+(?:/|$))[^.]*)', dest: '/index.html' },
    ],
  };
}

export const config = createVercelConfig(process.env.YCODERS_DEPLOYMENT_TARGET || MAIN_DEPLOYMENT_TARGET);
