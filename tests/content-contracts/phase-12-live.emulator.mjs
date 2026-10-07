import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';
import { AdminAssetService, MAX_ASSET_BYTES } from '../../server/admin/content/AdminAssetService.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { FirebaseArtifactStore, FirebaseAssetRegistry, FirebaseContentPublicationStore } from '../../server/admin/content/FirebaseContentPublicationStore.js';
import { migrateCliTaskManager, migratePracticeBank, migratePythonCourse, assertEmulatorOnly } from '../../scripts/content/migrationCore.mjs';
assertEmulatorOnly();
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
assert.match(process.env.STORAGE_EMULATOR_HOST ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
const app = initializeApp({ projectId: 'demo-mitutora', storageBucket: 'demo-mitutora.firebasestorage.app' }, `phase12-live-${Date.now()}`);
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const registry = new FirebaseAssetRegistry(db, bucket);
const store = new FirebaseContentPublicationStore(db);
const artifacts = new FirebaseArtifactStore(bucket);
const service = new ContentPublicationService({ store, artifacts, assets: registry });
const delivery = new PublishedContentService({ store, artifacts });
const assetService = new AdminAssetService(registry);
const router = createAdminContentApiRouter({ dependencies: async () => ({ service, delivery, assetService }) });
const tokens = {};
const actor = { uid: 'phase12-super-admin', role: 'SUPER_ADMIN' };
const canonical = ({ documentId, ...document }) => JSON.parse(JSON.stringify(document));
const checks = [];
const check = (name) => checks.push({ name, ok: true });
const png = readFileSync(new URL('../../public/assets/courses/python-foundations/python-foundations-image-01.png', import.meta.url));

async function call(method, path, input, role = 'SUPER_ADMIN') {
  const url = new URL(`http://localhost/api/admin-content/${path}`);
  const request = { method, url: url.href, query: { path: url.pathname.replace('/api/admin-content/', '').split('/'), ...Object.fromEntries(url.searchParams) }, headers: role === 'none' ? {} : { authorization: `Bearer ${tokens[role]}` }, body: input };
  const response = { statusCode: 0, headers: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; }, send(value) { this.value = value; return this; }, setHeader(key, value) { this.headers[key] = value; } };
  await router(request, response);
  return response;
}
const post = (path, input, role) => call('POST', path, input, role);
const get = (path, role) => call('GET', path, undefined, role);
const uploadInput = (name, mediaType, bytes) => ({ name, mediaType, data: bytes.toString('base64') });

try {
  const browser = await chromium.launch({ headless: true });
  const imagePage = await browser.newPage();
  const renderedImages = await imagePage.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const context = canvas.getContext('2d');
    context.fillStyle = '#2563eb'; context.fillRect(0, 0, 2, 2);
    return { jpeg: canvas.toDataURL('image/jpeg').split(',')[1], webp: canvas.toDataURL('image/webp').split(',')[1] };
  });
  await browser.close();
  const realJpeg = Buffer.from(renderedImages.jpeg, 'base64');
  const realWebp = Buffer.from(renderedImages.webp, 'base64');
  const auth = getAuth(app);
  for (const role of ['SUPER_ADMIN', 'CONTENT_ADMIN', 'CONTENT_EDITOR', 'CONTENT_REVIEWER', 'learner']) {
    const email = `${role.toLowerCase().replace('_', '-')}@phase12.test`;
    const password = 'Phase12SyntheticOnly!123';
    const user = await auth.createUser({ email, password });
    if (role !== 'learner') await auth.setCustomUserClaims(user.uid, { adminRole: role });
    const signIn = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    const result = await signIn.json();
    assert.equal(signIn.status, 200, `Auth emulator sign-in failed for ${role}: ${result.error?.message ?? ''}`);
    tokens[role] = result.idToken;
  }
  assert.equal((await get('assets', 'none')).statusCode, 401);
  assert.equal((await get('assets', 'learner')).statusCode, 403);

  const migrated = migratePythonCourse();
  assert.equal(migrated.assets.length, 17);
  for (const asset of migrated.assets) {
    const ref = db.collection('adminContentAssets').doc(asset.assetId);
    await ref.create(asset);
    assert.equal((await ref.get()).data().path, asset.path);
  }
  const registryPage = await get('assets?limit=50');
  assert.equal(registryPage.statusCode, 200);
  assert.equal(registryPage.value.items.length, 17);
  assert.equal(new Set(registryPage.value.items.map(({ assetId }) => assetId)).size, 17);
  await assert.rejects(db.collection('adminContentAssets').doc(migrated.assets[0].assetId).create(migrated.assets[0]));
  assert.equal((await get('assets?limit=50')).value.items.length, 17);
  check('17 deterministic migrated asset records');

  const uploaded = [];
  for (const [name, mediaType, bytes] of [['diagram.png', 'image/png', png], ['diagram.jpg', 'image/jpeg', realJpeg], ['diagram.webp', 'image/webp', realWebp]]) {
    const result = await post('assets', uploadInput(name, mediaType, bytes));
    assert.equal(result.statusCode, 201, `${name}: ${JSON.stringify(result.value?.error)}`);
    const asset = result.value.asset;
    assert.equal(asset.mediaType, mediaType);
    assert.equal(asset.size, bytes.length);
    const expectedDimensions = mediaType === 'image/png' ? [png.readUInt32BE(16), png.readUInt32BE(20)] : [2, 2];
    assert.deepEqual([asset.width, asset.height], expectedDimensions);
    assert.deepEqual((await bucket.file(asset.path).download())[0], bytes);
    assert.equal((await registry.get(asset.assetId)).assetId, asset.assetId);
    const preview = await get(`assets/${asset.assetId}/file`);
    assert.equal(preview.statusCode, 200);
    assert.deepEqual(preview.value, bytes);
    uploaded.push(asset);
  }
  check('PNG, JPEG, WebP upload and preview via real API/Storage');

  const overSide = Buffer.from(png); overSide.writeUInt32BE(6001, 16);
  const overArea = Buffer.from(png); overArea.writeUInt32BE(5000, 16); overArea.writeUInt32BE(5000, 20);
  for (const input of [
    uploadInput('bad.svg', 'image/svg+xml', png), uploadInput('bad.gif', 'image/gif', png),
    uploadInput('bad.png', 'image/jpeg', png), uploadInput('bad.png', 'image/png', Buffer.from('not an image')),
    uploadInput('bad.png', 'image/png', Buffer.alloc(MAX_ASSET_BYTES + 1)),
    uploadInput('bad.png', 'image/png', overSide), uploadInput('bad.png', 'image/png', overArea),
  ]) {
    const result = await post('assets', input);
    assert.equal(result.statusCode, 400, `Invalid upload accepted: ${input.name}`);
  }
  check('all seven invalid asset categories rejected server-side');

  const documents = [migrateCliTaskManager().drafts[0], migrated.drafts[0], ...migratePracticeBank().drafts.slice(0, 2)].map(canonical);
  for (const document of documents) {
    const saved = await post('drafts', { contentType: document.contentType, document, expectedRevision: 0 });
    assert.equal(saved.statusCode, 200, `${document.contentId}: ${JSON.stringify(saved.value?.error)}`);
  }
  const summaries = await get('draft-summaries?limit=50');
  assert.equal(summaries.statusCode, 200);
  assert.equal(summaries.value.items.length, 4);
  assert.deepEqual(new Set(summaries.value.items.map(({ contentType }) => contentType)), new Set(['PROJECT', 'COURSE', 'PRACTICE']));
  check('Project, Course, Practice draft API and summaries');

  const course = (await get('drafts/python')).value.draft;
  const selected = structuredClone(course.document);
  const image = selected.content.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons)).flatMap((lesson) => lesson.blocks).find((block) => block.type === 'image');
  assert.ok(image);
  image.assetId = uploaded[0].assetId;
  const savedSelection = await post('drafts', { contentType: 'COURSE', document: selected, expectedRevision: course.draftRevision });
  assert.equal(savedSelection.statusCode, 200, JSON.stringify(savedSelection.value?.error));
  const reloaded = (await get('drafts/python')).value.draft;
  const persisted = reloaded.document.content.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons)).flatMap((lesson) => lesson.blocks).find((block) => block.type === 'image');
  assert.equal(persisted.assetId, uploaded[0].assetId);
  assert.ok(!JSON.stringify(reloaded.document).includes(uploaded[0].path));
  assert.ok(!JSON.stringify(reloaded.document).includes(png.toString('base64')));
  check('Course image stable asset ID persisted without binary');

  for (const document of documents.slice(0, 3)) {
    const draft = (await get(`drafts/${document.contentId}`)).value.draft;
    const validation = await post('validate', { contentType: document.contentType, contentId: document.contentId, expectedRevision: draft.draftRevision });
    assert.equal(validation.statusCode, 200, `${document.contentId}: ${JSON.stringify(validation.value?.error)}`);
    assert.equal(validation.value.validation.valid, true);
    const v1 = await post('publish', { contentType: document.contentType, contentId: document.contentId, expectedRevision: draft.draftRevision });
    assert.equal(v1.statusCode, 201, `${document.contentId}: ${JSON.stringify(v1.value?.error)}`);
    assert.equal(v1.value.version.version, 1);
  }
  const catalog = await get('catalog?limit=50');
  assert.equal(catalog.value.items.length, 3);
  check('real validation, publication, catalog');

  const project = (await get('drafts/cli-task-manager')).value.draft;
  const changed = { ...project.document, metadata: { ...project.document.metadata, phase12Version: 2 } };
  const v2draft = await post('drafts', { contentType: 'PROJECT', document: changed, expectedRevision: project.draftRevision });
  assert.equal(v2draft.statusCode, 200);
  const v2 = await post('publish', { contentType: 'PROJECT', contentId: 'cli-task-manager', expectedRevision: v2draft.value.draft.draftRevision, expectedActiveRevision: 1 });
  assert.equal(v2.statusCode, 201, JSON.stringify(v2.value?.error));
  const history = await get('history/cli-task-manager');
  assert.deepEqual(history.value.versions.map(({ version }) => version), [2, 1]);
  for (const version of history.value.versions) {
    assert.equal(version.status, 'READY');
    assert.match(version.artifactHash, /^[a-f0-9]{64}$/);
    assert.ok(version.artifactSize > 0);
    assert.deepEqual((await bucket.file(version.artifactPath).exists())[0], true);
  }
  const rollback = await post('rollback', { contentType: 'PROJECT', contentId: 'cli-task-manager', version: 1, expectedActiveRevision: 2 });
  assert.equal(rollback.statusCode, 200);
  assert.equal(rollback.value.active.activeVersion, 1);
  const archive = await post('archive', { contentType: 'PROJECT', contentId: 'cli-task-manager', expectedActiveRevision: 3 });
  assert.equal(archive.statusCode, 200);
  assert.equal(archive.value.active.publicationStatus, 'ARCHIVED');
  const reactivate = await post('rollback', { contentType: 'PROJECT', contentId: 'cli-task-manager', version: 2, expectedActiveRevision: 4 });
  assert.equal(reactivate.statusCode, 200);
  assert.equal(reactivate.value.active.activeVersion, 2);
  assert.equal((await get('public/cli-task-manager')).value.document.version, 2);
  check('v1/v2 history, rollback, archive, reactivate, retained artifacts');

  const forbidden = [
    ['assets', uploadInput('blocked.png', 'image/png', png)],
    ['publish', { contentType: 'PROJECT', contentId: 'cli-task-manager', expectedRevision: 2 }],
    ['archive', { contentType: 'PROJECT', contentId: 'cli-task-manager', expectedActiveRevision: 5 }],
    ['rollback', { contentType: 'PROJECT', contentId: 'cli-task-manager', version: 1, expectedActiveRevision: 5 }],
  ];
  for (const role of ['CONTENT_EDITOR', 'CONTENT_REVIEWER', 'learner']) {
    for (const [path, input] of forbidden) {
      const result = await post(path, input, role);
      const expected = role === 'CONTENT_EDITOR' && path === 'assets' ? 201 : 403;
      assert.equal(result.statusCode, expected, `${role} ${path}: ${JSON.stringify(result.value?.error)}`);
    }
  }
  assert.equal((await post('assets', uploadInput('admin.png', 'image/png', png), 'CONTENT_ADMIN')).statusCode, 201);
  assert.equal((await post('publish', { contentType: 'PRACTICE', contentId: documents[3].contentId, expectedRevision: 1 }, 'CONTENT_ADMIN')).statusCode, 201);
  assert.equal((await post('archive', { contentType: 'PROJECT', contentId: 'cli-task-manager', expectedActiveRevision: 5 }, 'CONTENT_ADMIN')).statusCode, 200);
  assert.equal((await post('rollback', { contentType: 'PROJECT', contentId: 'cli-task-manager', version: 1, expectedActiveRevision: 6 }, 'CONTENT_ADMIN')).statusCode, 200);
  check('real Auth emulator role matrix across upload/publish/archive/rollback');

  const audits = (await db.collection('adminContentAudit').get()).docs.map((doc) => doc.data());
  for (const event of ['ASSET_CREATED', 'CONTENT_PUBLISHED', 'CONTENT_ACTIVATED', 'CONTENT_ROLLED_BACK', 'CONTENT_ARCHIVED']) assert.ok(audits.some((entry) => entry.event === event), `Missing ${event} audit`);
  for (const entry of audits) {
    assert.ok(entry.actorUid && entry.timestamp);
    assert.ok(!('document' in entry) && !('token' in entry) && !('password' in entry));
    if (entry.event.startsWith('CONTENT_')) assert.ok(entry.contentType && Number.isInteger(entry.version ?? 0));
  }
  check('real audit entries contain actor and no content bodies/credentials');

  const vite = await createServer({ mode: 'phase12-live', configFile: new URL('../../apps/admin/vite.config.js', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''), server: { host: '127.0.0.1', port: 0 } });
  try {
    await vite.listen();
    const vitePort = vite.httpServer.address().port;
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route('**/assets/courses/python-foundations/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        assert.match(pathname, /^\/assets\/courses\/python-foundations\/python-foundations-image-\d{2}\.png$/);
        await route.fulfill({ path: fileURLToPath(new URL(`../../public${pathname}`, import.meta.url)) });
      });
      await page.route('**/api/admin-content/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = `${url.pathname.replace('/api/admin-content/', '')}${url.search}`;
        const result = await call(request.method(), path, request.postDataJSON());
        await route.fulfill({ status: result.statusCode, contentType: Buffer.isBuffer(result.value) ? result.headers['Content-Type'] : 'application/json', body: Buffer.isBuffer(result.value) ? result.value : JSON.stringify(result.value) });
      });
      await page.goto(`http://127.0.0.1:${vitePort}/tests/browser/publishing.html`);
      await expect(page.getByRole('heading', { name: 'CLI Task Manager' })).toBeVisible();
      await page.getByLabel('Content type').selectOption('COURSE');
      await expect(page.getByRole('heading', { name: 'Python Foundations' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'CLI Task Manager' })).toHaveCount(0);
      await page.getByLabel('Search').fill('no-such-draft');
      await expect(page.getByText('No drafts match these filters.')).toBeVisible();
      await page.getByLabel('Search').fill('');
      await page.getByLabel('Status').selectOption('Valid');
      await expect(page.getByRole('heading', { name: 'Python Foundations' })).toBeVisible();
      await page.getByLabel('Status').selectOption('Draft');
      await expect(page.getByText('No drafts match these filters.')).toBeVisible();
      await page.getByRole('link', { name: 'Published' }).click();
      await expect(page.getByRole('heading', { name: 'CLI Task Manager' })).toBeVisible();
      await page.getByRole('link', { name: 'Assets' }).click();
      await expect(page.locator('.publishing-assets article')).toHaveCount(22);
      await expect.poll(() => page.locator('.publishing-assets article img').first().evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
      await page.getByRole('link', { name: 'Version History' }).click();
      await expect(page.getByRole('heading', { name: 'v2 · CLI Task Manager' })).toBeVisible();
      await page.getByRole('link', { name: 'Document Editor' }).click();
      await page.getByRole('button', { name: 'Add Image block' }).click();
      await page.getByRole('button', { name: 'Select asset' }).click();
      const picker = page.getByRole('dialog', { name: 'Select asset' });
      await picker.getByLabel('Search assets').fill(uploaded[0].assetId);
      await expect(picker.locator('.publishing-assets article')).toHaveCount(1);
      await picker.getByRole('button', { name: 'Select' }).click();
      await expect(page.getByLabel('Asset ID')).toHaveValue(uploaded[0].assetId);
      const selectedAssetId = await page.getByLabel('Asset ID').inputValue();
      const latestCourse = (await get('drafts/python')).value.draft;
      const selectedCourse = structuredClone(latestCourse.document);
      selectedCourse.content.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons)).flatMap((lesson) => lesson.blocks).find((block) => block.type === 'image').assetId = selectedAssetId;
      assert.equal((await post('drafts', { contentType: 'COURSE', document: selectedCourse, expectedRevision: latestCourse.draftRevision })).statusCode, 200);
      const courseAfterPicker = (await get('drafts/python')).value.draft;
      assert.equal(courseAfterPicker.document.content.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons)).flatMap((lesson) => lesson.blocks).find((block) => block.type === 'image').assetId, selectedAssetId);
      assert.ok(!JSON.stringify(courseAfterPicker.document).includes(png.toString('base64')));
      page.on('dialog', (dialog) => dialog.accept());
      await page.getByRole('link', { name: 'Drafts' }).click();
      await expect(page.getByRole('main').getByRole('heading', { name: 'Drafts', level: 1 })).toBeVisible();
      await page.getByLabel('Content type').selectOption('COURSE');
      await page.locator('.publishing-row').filter({ hasText: 'Python Foundations' }).getByRole('button', { name: 'Open' }).click();
      await expect(page.getByRole('textbox', { name: 'Stable Course ID' })).toHaveValue('python');
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Python Foundations');
      await page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: '3. Working of the Program', exact: true }).click();
      await page.getByRole('article', { name: 'image block' }).first().click();
      await page.getByRole('button', { name: 'Select asset' }).click();
      const coursePicker = page.getByRole('dialog', { name: 'Select asset' });
      await coursePicker.getByLabel('Search assets').fill(uploaded[1].assetId);
      await coursePicker.getByRole('button', { name: 'Select' }).click();
      await expect(page.getByLabel('Asset ID')).toHaveValue(uploaded[1].assetId);
      await expect.poll(async () => {
        const saved = (await get('drafts/python')).value.draft;
        return saved.document.content.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons)).flatMap((lesson) => lesson.blocks).find((block) => block.id === 'page-1-3-image-5')?.assetId;
      }, { timeout: 20_000 }).toBe(uploaded[1].assetId);
      await page.reload();
      await page.locator('.publishing-row').filter({ hasText: 'Python Foundations' }).getByRole('button', { name: 'Open' }).click();
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Python Foundations');
      await page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: '3. Working of the Program', exact: true }).click();
      await page.getByRole('article', { name: 'image block' }).first().click();
      await expect(page.getByLabel('Asset ID')).toHaveValue(uploaded[1].assetId);
      check('Admin browser Drafts/Published/Version History/Assets and picker backed by live API');
    } finally { await browser.close(); }
  } finally { await vite.close(); }

  console.log(JSON.stringify({ phase: '12.1', checks, audits: audits.length, migratedAssets: 17, uploadedAssets: uploaded.length, productionWrites: false }, null, 2));
} finally {
  await deleteApp(app);
}
