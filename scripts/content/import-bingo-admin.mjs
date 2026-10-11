import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertContentSize, MAX_DRAFT_BYTES, normalizeContent, validateContent } from '../../shared/content/index.js';

export const ADMIN_PRODUCTION_ORIGIN = 'https://ycoders-admin.vercel.app';
export const BINGO_CONTENT_ID = 'bingo';
export const BINGO_CONFIRMATION = 'bingo:PROJECT';
export const BINGO_SOURCE_HASHES = Object.freeze({
  'bingoProjectDraft.mjs': 'ad37e69bc0c489a71efdd20e71277f419dfaf1517966b78c057e3f410b1dfd28',
  'sourcePages.mjs': '4b77648feb43cc2c046df49a31f44e793842a3c8765eb55c2a482de22be85297',
});

export class BingoImportError extends Error {
  constructor(message) { super(message); this.name = 'BingoImportError'; }
}

const fail = (message) => { throw new BingoImportError(message); };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isBingo = (value) => String(value ?? '').trim().toLowerCase() === BINGO_CONTENT_ID;

export function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--base-url', '--source', '--content-type', '--execute', '--confirm'].includes(flag)
      || index + 1 >= args.length || flag in options) fail('Use --base-url, --source, --content-type, --execute, and --confirm with one value each.');
    options[flag] = args[index + 1];
  }
  if (options['--base-url'] !== ADMIN_PRODUCTION_ORIGIN) fail('Use the exact approved Admin Production origin.');
  if (options['--content-type'] !== 'PROJECT') fail('Only the canonical Bingo PROJECT is supported.');
  if (!options['--source']) fail('The canonical Bingo source path is required.');
  const source = resolve(options['--source']);
  if (!source.replaceAll('\\', '/').endsWith('/content/projects/bingo/bingoProjectDraft.mjs')) fail('Only the canonical Bingo source path is supported.');
  const execute = options['--execute'] === 'yes';
  if (options['--execute'] != null && !execute) fail('Use --execute yes only when authorized to import.');
  if (execute ? options['--confirm'] !== BINGO_CONFIRMATION : options['--confirm'] != null) {
    fail('Execution requires --confirm bingo:PROJECT; dry-run must omit --confirm.');
  }
  return { baseUrl: ADMIN_PRODUCTION_ORIGIN, source, execute, confirmed: execute && options['--confirm'] === BINGO_CONFIRMATION };
}

export async function loadCanonicalBingo(source) {
  if (basename(source) !== 'bingoProjectDraft.mjs') fail('The canonical Bingo source file is required.');
  for (const [name, expectedHash] of Object.entries(BINGO_SOURCE_HASHES)) {
    let bytes;
    try { bytes = await readFile(resolve(dirname(source), name)); }
    catch { fail(`Canonical Bingo ${name} is unavailable.`); }
    if (hash(bytes) !== expectedHash) fail(`Canonical Bingo ${name} differs from the reviewed source; stop and revalidate.`);
  }
  const { bingoProjectDraft } = await import(pathToFileURL(source).href);
  return prepareBingoDocument(bingoProjectDraft);
}

export function prepareBingoDocument(sourceDocument) {
  if (sourceDocument?.contentId !== BINGO_CONTENT_ID || sourceDocument.contentType !== 'PROJECT'
    || sourceDocument.content?.projectId !== BINGO_CONTENT_ID || sourceDocument.content?.title !== 'Bingo') {
    fail('The source is not the canonical Bingo PROJECT.');
  }
  const document = normalizeContent(sourceDocument);
  if (JSON.stringify(document) !== JSON.stringify(sourceDocument)) fail('Canonical normalization changed the reviewed Bingo payload.');
  const validation = validateContent(document);
  if (!validation.valid || validation.errors.length || validation.warnings.length) fail('Canonical Bingo validation did not pass with zero errors and warnings.');
  assertContentSize(document, MAX_DRAFT_BYTES, 'Bingo draft');
  const content = document.content;
  const tasks = content.checkpoints.flatMap((checkpoint) => checkpoint.tasks);
  const groups = content.checkpoints.map((checkpoint) => checkpoint.tasks.length);
  const allBlocks = [
    ...content.checkpoints.flatMap((checkpoint) => [
      ...checkpoint.blocks, ...checkpoint.tasks.flatMap((task) => task.blocks), ...checkpoint.completionBlocks,
    ]), ...content.completionBlocks,
  ];
  const pages = allBlocks.map(({ blockId }) => /^bingo-p(\d+)-title$/.exec(blockId)?.[1]).filter(Boolean).map(Number);
  if (content.checkpoints.length !== 8 || tasks.length !== 17 || groups.join() !== '2,2,2,2,2,2,2,3'
    || !pages.every((number, index) => number === index + 1) || pages.length !== 66
    || content.supportedLanguages.join() !== 'python,cpp,java'
    || !Object.entries({ python: 'bingo.py', cpp: 'main.cpp', java: 'Main.java' }).every(([language, path]) => {
      const starter = content.starterWorkspaces[language];
      return starter?.entrypoint === path && starter?.files?.length === 1
        && starter.files[0].path === path && starter.files[0].content === '';
    }) || tasks.some((task) => task.mentor?.revealPolicy?.referenceAllowed !== false)) {
    fail('Canonical Bingo structure, guide, starters, or mentor policy changed.');
  }
  const requestBody = JSON.stringify({ contentType: 'PROJECT', document, expectedRevision: 0 });
  return { document, requestBody, report: {
    contentId: BINGO_CONTENT_ID, contentType: 'PROJECT', checkpoints: 8, tasks: 17,
    sourcePages: 66, languages: content.supportedLanguages, requestBytes: Buffer.byteLength(requestBody),
    errors: 0, warnings: 0,
  } };
}

export async function runBingoImport(options, {
  fetcher = globalThis.fetch,
  token = process.env.ADMIN_FIREBASE_ID_TOKEN,
  loadSource = loadCanonicalBingo,
  output = console.log,
} = {}) {
  const prepared = await loadSource(options.source);
  if (!options.execute) {
    output(JSON.stringify({ mode: 'dry-run', ...prepared.report, productionMutation: false }));
    return { mode: 'dry-run', ...prepared.report };
  }
  if (options.confirmed !== true) fail('Execution requires explicit Bingo PROJECT confirmation.');
  if (options.baseUrl !== ADMIN_PRODUCTION_ORIGIN) fail('Use the exact approved Admin Production origin.');
  if (typeof token !== 'string' || !/^[^\s]{100,}$/.test(token)) fail('ADMIN_FIREBASE_ID_TOKEN is required; no Production request was sent.');
  const api = async (path, { method = 'GET', body } = {}) => {
    let response;
    try {
      response = await fetcher(`${options.baseUrl}/api/admin-content/${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body } : {}), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(method === 'POST' ? 70_000 : 20_000),
      });
    } catch { fail(method === 'POST' ? 'Create outcome is uncertain; do not retry. Inspect the draft read-only.' : 'Admin preflight request failed; no create request was sent.'); }
    if (response.status === 401 || response.status === 403) fail(`Admin API authorization failed (${response.status}); no credential details were logged.`);
    if (!response.ok) fail(method === 'POST'
      ? `Create returned HTTP ${response.status}; do not retry. Inspect the draft read-only.`
      : `Admin preflight returned HTTP ${response.status}; no create request was sent.`);
    try { return await response.json(); }
    catch { fail(method === 'POST' ? 'Create response was unreadable; do not retry. Inspect the draft read-only.' : 'Admin preflight response was unreadable.'); }
  };

  const exact = await api(`drafts/${BINGO_CONTENT_ID}`);
  if (!exact || typeof exact !== 'object' || !Object.hasOwn(exact, 'draft')) fail('Admin draft preflight response is incomplete.');
  if (exact.draft) fail('Bingo draft already exists; import refused.');
  const history = await api(`history/${BINGO_CONTENT_ID}`);
  if (!history || typeof history !== 'object' || !Array.isArray(history.versions) || !Object.hasOwn(history, 'active')) fail('Admin publication preflight response is incomplete.');
  if (history.active || history.versions.length) fail('Bingo publication history already exists; import refused.');

  let cursor = null;
  const seenCursors = new Set();
  for (let page = 0; page < 100; page += 1) {
    const result = await api(`draft-summaries?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    if (!result || typeof result !== 'object' || !Array.isArray(result.items)) fail('Admin draft summary response is incomplete.');
    for (const summary of result.items) {
      if (summary.contentType !== 'PROJECT') continue;
      if (!summary.contentId || isBingo(summary.contentId) || isBingo(summary.title)) fail('A Bingo PROJECT identity/title collision exists; import refused.');
      const detail = await api(`drafts/${encodeURIComponent(summary.contentId)}`);
      const project = detail.draft?.document?.content;
      if (!project) fail('A PROJECT draft could not be inspected for slug collision.');
      if (isBingo(project.projectId) || isBingo(project.slug) || isBingo(project.title)) fail('A Bingo PROJECT slug/title collision exists; import refused.');
    }
    if (!result.nextCursor) { cursor = null; break; }
    if (seenCursors.has(result.nextCursor)) fail('Admin draft pagination repeated a cursor.');
    seenCursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  if (cursor) fail('Admin draft preflight exceeded its bounded pagination limit.');

  // There is intentionally one create request, with no retry on an uncertain outcome.
  const created = await api('drafts', { method: 'POST', body: prepared.requestBody });
  const draft = created?.draft;
  if (draft?.contentId !== BINGO_CONTENT_ID || draft.contentType !== 'PROJECT'
    || draft.draftRevision !== 1 || draft.lifecycleState !== 'DRAFT'
    || draft.document?.status !== 'draft' || draft.validationSummary != null
    || JSON.stringify(draft.document) !== JSON.stringify(prepared.document)) {
    fail('Create response did not match the expected Bingo draft; do not retry. Inspect it read-only.');
  }
  const result = { mode: 'created', contentId: draft.contentId, revision: draft.draftRevision, lifecycle: draft.lifecycleState, status: draft.document?.status ?? null };
  output(JSON.stringify(result));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runBingoImport(parseOptions(process.argv.slice(2))); }
  catch (error) {
    console.error(error instanceof BingoImportError ? error.message : 'Bingo import preparation failed; no automatic retry is allowed.');
    process.exitCode = 1;
  }
}
