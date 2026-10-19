import { expect, test } from '@playwright/test';

test.skip(process.env.LEARNER_PHASE5B_BENCHMARK !== '1', 'Opt-in local performance investigation.');

const course = (version, title) => ({
  contentId: 'python', contentType: 'COURSE', schemaVersion: '1.0.0', version,
  status: 'published', locale: 'en', metadata: {},
  content: {
    courseId: 'python', slug: 'python', title, description: 'Learn Python basics.',
    language: 'python', difficulty: 'Beginner', estimatedMinutes: 5, prerequisites: [],
    learningOutcomes: ['Learn Python.'], tags: [], defaultLessonId: 'first-lesson',
    modules: [{ id: 'first-module', order: 1, title: 'First module', description: 'Introduction.', lessons: [{
      id: 'first-lesson', order: 1, number: '1', title: 'First lesson', summary: 'Introduction.',
      status: 'available', estimatedMinutes: 5, tags: [],
      blocks: [{ id: 'first-paragraph', type: 'paragraph', content: 'Hello.', format: 'plain' }],
    }] }],
  },
});

async function capture(page, label, action, ready, settled) {
  const requests = [];
  const onRequest = (request) => requests.push({ url: request.url(), type: request.resourceType() });
  page.on('request', onRequest);
  await page.evaluate(() => performance.clearMarks());
  try {
    await action();
    await ready();
    if (settled) await settled();
    const result = await page.evaluate(() => {
      const marks = performance.getEntriesByType('mark').filter((entry) => entry.name.startsWith('phase5:'));
      const zero = marks.find((entry) => entry.name === 'phase5:navigation:start')?.startTime ?? 0;
      return marks.map((entry) => ({ name: entry.name.slice(7), at: Math.round(entry.startTime - zero), detail: entry.detail ?? null }));
    });
    const meaningful = result.find((mark) => mark.name === 'course:hero-committed' || mark.name === 'projects:first-card-committed');
    console.log(`PHASE5B_TRACE ${JSON.stringify({ label, meaningfulMs: meaningful?.at ?? null, requests: requests.length,
      scripts: requests.filter((item) => item.type === 'script').map((item) => new URL(item.url).pathname),
      firestoreRequests: requests.filter((item) => item.url.includes(':8080/')).length,
      publishedRequests: requests.filter((item) => item.url.includes('/api/admin-content/public')).map((item) => new URL(item.url).pathname),
      marks: result })}`);
    return result;
  } finally {
    page.off('request', onRequest);
  }
}

for (const pinned of [false, true]) {
  test(`Course and Projects critical path (${pinned ? 'pinned' : 'new'} learner)`, async ({ page, request, context }, testInfo) => {
    test.setTimeout(240_000);
    await page.addInitScript(() => { window.__YCODERS_PHASE5_TRACE__ = true; });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 1_500_000 / 8, uploadThroughput: 750_000 / 8,
    });
    await page.route('**/api/admin-content/public**', async (route) => {
      const url = new URL(route.request().url());
      const body = url.searchParams.get('contentType') === 'COURSE'
        ? { items: [{ contentId: 'python', activeVersion: 2, metadata: { title: 'Active Python v2', language: 'python' } }] }
        : url.searchParams.has('contentType') ? { items: [] }
          : url.pathname.endsWith('/python/1') ? { document: course(1, 'Pinned Python v1') }
            : url.pathname.endsWith('/python') || url.pathname.endsWith('/python/2') ? { document: course(2, 'Active Python v2') }
              : { error: { code: 'content/not-published', message: 'Not published.' } };
      await route.fulfill({ status: body.error ? 404 : 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const email = `phase5b-${testInfo.workerIndex}-${Date.now()}@example.test`;
    const signup = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
      data: { email, password: 'LocalBenchmark123!', returnSecureToken: true },
    });
    expect(signup.ok()).toBe(true);
    if (pinned) {
      const { localId } = await signup.json();
      const seed = await request.patch(`http://127.0.0.1:8080/v1/projects/demo-mitutora/databases/(default)/documents/users/${localId}/progress/python`, {
        headers: { Authorization: 'Bearer owner' },
        data: { fields: { courseId: { stringValue: 'python' }, contentVersion: { integerValue: '1' },
          completedLessons: { arrayValue: {} }, visitedLessons: { arrayValue: {} } } },
      });
      expect(seed.ok(), `Local Firestore fixture seeding failed (${seed.status()}): ${(await seed.text()).slice(0, 300)}`).toBe(true);
      const projectSeed = await request.patch(`http://127.0.0.1:8080/v1/projects/demo-mitutora/databases/(default)/documents/users/${localId}/activeProjects/simple-calculator`, {
        headers: { Authorization: 'Bearer owner' },
        data: { fields: { projectId: { stringValue: 'simple-calculator' }, schemaVersion: { integerValue: '1' },
          revision: { integerValue: '1' }, status: { stringValue: 'active' }, languageId: { stringValue: 'python' },
          currentCheckpoint: { integerValue: '0' } } },
      });
      expect(projectSeed.ok(), `Local Project fixture seeding failed (${projectSeed.status()})`).toBe(true);
    }
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('LocalBenchmark123!');
    await page.getByRole('button', { name: /^Sign in/ }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();

    for (const pass of [1, 2, 3]) {
      await page.getByRole('button', { name: 'Library', exact: true }).first().click();
      await expect(page.locator('.library-course-card').filter({ hasText: 'Active Python v2' })).toBeVisible();
      await capture(page, `${pinned ? 'pinned' : 'new'} course ${pass}`,
        () => page.locator('.library-course-card').filter({ hasText: 'Active Python v2' }).click(),
        () => expect(page.locator('.overview-hero h1')).toHaveText(pinned ? 'Pinned Python v1' : 'Active Python v2'));
      await page.getByRole('button', { name: 'Home', exact: true }).first().click();
      await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
      await capture(page, `${pinned ? 'pinned' : 'new'} projects ${pass}`,
        () => page.getByRole('button', { name: 'Projects', exact: true }).first().click(),
        () => expect(page.locator('.project-card').first()).toBeVisible(),
        () => expect(page.locator('.project-card-action:disabled')).toHaveCount(0));
      if (pinned) {
        await expect(page.locator('.project-card').filter({ hasText: 'Simple Calculator' }).getByRole('button', { name: 'Continue Project' })).toBeVisible();
        await expect(page.locator('.project-card').filter({ hasText: 'Number Guessing Game' })).toHaveCount(0);
      }
      await page.locator('.project-card').filter({ hasText: 'Simple Calculator' }).click();
      await expect(page.locator('.project-details h1')).toHaveText('Simple Calculator');
      await page.getByRole('button', { name: 'Home', exact: true }).first().click();
      await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    }
  });
}
