import { GoogleAuth } from 'google-auth-library';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (projectId !== 'mi-tutora-pro') throw new Error('Expected mi-tutora-pro.');
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();
const request = async (url, method = 'GET', data) => {
  try {
    const response = await client.request({ url, method, data });
    return { ok: true, data: response.data };
  } catch (error) {
    return { ok: false, status: error.response?.status ?? null, code: error.code ?? null, message: error.message };
  }
};

const project = await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`);
const projectNumber = project.data?.projectNumber;
const functions = await request(`https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/-/functions`);
const webApps = await request(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`);
const appCheck = {};
for (const app of webApps.data?.apps ?? []) {
  const appId = encodeURIComponent(app.appId);
  appCheck[app.displayName || app.appId] = {
    appIdSuffix: app.appId.slice(-8),
    enterprise: await request(`https://firebaseappcheck.googleapis.com/v1/projects/${projectNumber}/apps/${appId}/recaptchaEnterpriseConfig`),
  };
}
const services = projectNumber ? await request(`https://firebaseappcheck.googleapis.com/v1/projects/${projectNumber}/services`) : { ok: false, message: 'project number unavailable' };
const alerts = await request(`https://monitoring.googleapis.com/v3/projects/${projectId}/alertPolicies`);
const channels = await request(`https://monitoring.googleapis.com/v3/projects/${projectId}/notificationChannels`);
const logs = await request('https://logging.googleapis.com/v2/entries:list', 'POST', {
  resourceNames: [`projects/${projectId}`],
  filter: 'resource.type=("cloud_run_revision" OR "cloud_function") AND severity>=ERROR',
  orderBy: 'timestamp desc', pageSize: 20,
});

const safeFunctions = (functions.data?.functions ?? []).map((item) => ({
  name: item.name?.split('/').at(-1), state: item.state, environment: item.environment,
  runtime: item.buildConfig?.runtime, entryPoint: item.buildConfig?.entryPoint,
  region: item.name?.split('/')[3], trigger: item.serviceConfig?.uri ? 'HTTPS' : item.eventTrigger ? 'EVENT' : 'UNKNOWN',
  updateTime: item.updateTime,
}));
const safe = {
  project: { ok: project.ok, projectId: project.data?.projectId, projectNumberPresent: Boolean(projectNumber) },
  functions: { ok: functions.ok, count: safeFunctions.length, items: safeFunctions, error: functions.ok ? undefined : functions },
  appCheck: { webAppCount: webApps.data?.apps?.length ?? 0, apps: appCheck, services },
  observability: {
    alertPolicyCount: alerts.data?.alertPolicies?.length ?? 0,
    notificationChannelCount: channels.data?.notificationChannels?.length ?? 0,
    recentErrorEntryCount: logs.data?.entries?.length ?? 0,
    errors: { alerts: alerts.ok ? null : alerts, channels: channels.ok ? null : channels, logs: logs.ok ? null : logs },
  },
};
console.log(JSON.stringify({ mode: 'READ_ONLY', mutationCount: 0, ...safe }, null, 2));
