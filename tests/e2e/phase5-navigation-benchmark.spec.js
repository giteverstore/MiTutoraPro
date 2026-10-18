import { expect, test } from '@playwright/test';

test.skip(process.env.LEARNER_PHASE5_BENCHMARK !== '1', 'Run explicitly for the local navigation investigation.');

const course = {
  contentId: 'python', contentType: 'COURSE', schemaVersion: '1.0.0', version: 1,
  status: 'published', locale: 'en', metadata: {},
  content: {
    courseId: 'python', slug: 'python', title: 'Python Foundations', description: 'Learn Python basics.',
    language: 'python', difficulty: 'Beginner', estimatedMinutes: 5, prerequisites: [],
    learningOutcomes: ['Learn Python.'], tags: [], defaultLessonId: 'first-lesson',
    modules: [{ id: 'first-module', order: 1, title: 'First module', description: 'Introduction.', lessons: [{
      id: 'first-lesson', order: 1, number: '1', title: 'First lesson', summary: 'Introduction.',
      status: 'available', estimatedMinutes: 5, tags: [],
      blocks: [{ id: 'first-paragraph', type: 'paragraph', content: 'Hello.', format: 'plain' }],
    }] }],
  },
};

function category(request) {
  const url = request.url();
  if (url.includes('/api/admin-content/public')) return 'published-content';
  if (url.includes(':8080/') || url.includes('firestore.googleapis.com')) return 'firestore';
  if (url.includes(':9099/') || url.includes('identitytoolkit.googleapis.com')) return 'auth';
  if (request.resourceType() === 'script') return 'script';
  if (request.resourceType() === 'stylesheet') return 'css';
  return 'other';
}

async function measure(page, label, action, ready) {
  const requests = [];
  const observe = (request) => requests.push({ category: category(request), url: request.url() });
  page.on('request', observe);
  const started = performance.now();
  try {
    await action();
    await ready();
    const meaningfulMs = Math.round(performance.now() - started);
    await page.waitForTimeout(100);
    const counts = Object.fromEntries([...new Set(requests.map((item) => item.category))]
      .map((type) => [type, requests.filter((item) => item.category === type).length]));
    const duplicates = requests.length - new Set(requests.map((item) => item.url)).size;
    console.log(`PHASE5_BENCHMARK ${JSON.stringify({ label, meaningfulMs, requests: requests.length, counts, duplicates })}`);
  } finally {
    page.off('request', observe);
  }
}

async function shellNavigate(page, label) {
  await page.getByRole('button', { name: label, exact: true }).first().click();
}

for (const throttled of [false, true]) {
  test(`authenticated local route timing (${throttled ? '150ms latency' : 'normal'})`, async ({ page, request, context }, testInfo) => {
    test.setTimeout(240_000);
    if (throttled) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 1_500_000 / 8, uploadThroughput: 750_000 / 8,
      });
    }
    await page.route('**/api/admin-content/public**', async (route) => {
      const url = new URL(route.request().url());
      const body = url.searchParams.get('contentType') === 'COURSE'
        ? { items: [{ contentId: 'python', activeVersion: 1, metadata: { title: 'Python Foundations', language: 'python' } }] }
        : url.searchParams.has('contentType') ? { items: [] }
          : url.pathname.endsWith('/python') || url.pathname.endsWith('/python/1') ? { document: course }
            : { error: { code: 'content/not-published', message: 'Not published.' } };
      await route.fulfill({ status: body.error ? 404 : 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    const email = `phase5-${testInfo.workerIndex}-${Date.now()}@example.test`;
    const password = 'LocalBenchmark123!';
    const signup = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
      data: { email, password, returnSecureToken: true },
    });
    expect(signup.ok()).toBe(true);
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /^Sign in/ }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();

    for (const pass of ['first', 'repeat']) {
      await measure(page, `${pass} cold Home reload`, () => page.reload(), () => expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible());
      await measure(page, `${pass} Home to Library`, () => shellNavigate(page, 'Library'), () => expect(page.locator('.library-course-card').filter({ hasText: 'Python Foundations' })).toBeVisible());
      await measure(page, `${pass} Library to Course Overview`, () => page.locator('.library-course-card').filter({ hasText: 'Python Foundations' }).click(), () => expect(page.locator('.overview-hero h1')).toHaveText('Python Foundations'));
      await measure(page, `${pass} Course Overview to Learning Engine`, () => page.locator('.overview-primary-action').first().click(), () => expect(page.getByLabel('Lesson content and navigation')).toBeVisible());
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
      await measure(page, `${pass} Home to Practice`, () => shellNavigate(page, 'Practice'), () => expect(page.locator('.practice-question-list')).toBeVisible());
      await measure(page, `${pass} Practice to detail`, () => page.getByRole('button', { name: /Create a User Label/ }).first().click(), () => expect(page.getByRole('heading', { level: 1, name: 'Create a User Label' })).toBeVisible());
      await shellNavigate(page, 'Home');
      await measure(page, `${pass} Home to Challenges`, () => shellNavigate(page, 'Challenges'), () => expect(page.locator('.challenge-today-card')).toBeVisible());
      await shellNavigate(page, 'Home');
      await measure(page, `${pass} Home to Projects`, () => shellNavigate(page, 'Projects'), () => expect(page.locator('.project-card').first()).toBeVisible());
      await measure(page, `${pass} Projects to Overview`, () => page.locator('.project-card').first().click(), () => expect(page.locator('.project-details h1')).toBeVisible());
      await shellNavigate(page, 'Home');
    }
  });
}
