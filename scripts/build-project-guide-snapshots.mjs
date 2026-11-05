import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.env.PROJECT_GUIDE_AUDIT_JSON;
if (!inputPath) throw new Error('PROJECT_GUIDE_AUDIT_JSON is required.');

const outputPath = path.resolve('src/projects/catalog/projectGuideSourcePages.js');
const documents = JSON.parse(fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, ''));
const projectIds = {
  blackjack: 'blackjack',
  hangman: 'hangman',
  'stone-paper-scissors': 'stone-paper-scissors',
  'currency-converter': 'currency-converter',
};
const taskPages = {
  blackjack: [4, 6, 11, 13, 15, 17, 19, 21, 23, 25, 27, 30, 32, 35, 37, 39],
  hangman: [4, 5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25],
  'stone-paper-scissors': [4, 6, 12, 14, 16, 18, 20, 23, 25, 27, 29, 31, 34, 36, 39, 41, 43],
  'currency-converter': [4, 6, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29],
};
const sourceHashes = {
  blackjack: '1A0E7AE12AFAD9C29C80CFE24A12AA4427D542158FC36292F0A0F34F89C1F1DD',
  hangman: 'F8F957B8DDC960820F03348DBA2FCC20EBAB59C3233A573133B358E542A0E3B3',
  'stone-paper-scissors': '4239F19B484A8DE84AD089E788049195C4CFFF31F514D396D1987ECE4D9C6B61',
  'currency-converter': '1804FC0EEA72ABC4167E9EAF82D4DF4627BE03A4D11A5DE960F0010BFB22087E',
};
const sourceDocuments = {
  blackjack: 'docs/project-content/blackjack/Blackjack.docx',
  hangman: 'docs/project-content/Hangman/Hangman.docx',
  'stone-paper-scissors': 'docs/project-content/Stone Paper Scissors/StonePaperScissors.docx',
  'currency-converter': 'docs/project-content/Currency Converter/Currency Converter.docx',
};
const imagePages = {
  blackjack: { 9: ['image1.png', 'Blackjack game flow diagram'] },
  hangman: {
    6: ['image1.png', 'Hangman game flow diagram'],
    8: ['image2.png', 'Hangman program structure diagram'],
    9: ['image3.png', 'Hangman rules diagram'],
  },
  'stone-paper-scissors': {
    8: ['image1.png', 'Stone Paper Scissors game flow diagram'],
    10: ['image2.png', 'Stone Paper Scissors program structure diagram'],
    11: ['image3.png', 'Stone Paper Scissors rules diagram'],
  },
  'currency-converter': {
    8: ['image1.png', 'Currency Converter program flow diagram'],
    9: ['image2.png', 'Currency Converter class structure diagram'],
  },
};

const clean = (value) => String(value ?? '').replace(/\u000b/g, '\n').replace(/\r/g, '').trim();
const isHeading = (item) => item.bold === -1 || Number(item.fontSize) >= 13 || /^(?:chapter|task|milestone|appendix|reflection|extension|expected output|driver|verify|project)/i.test(item.text);
const looksLikeOutput = (heading) => /expected output|sample output|output/i.test(heading);
const looksLikeCode = (item) => /consolas|courier/i.test(item.font ?? '') || /(?:public static void main|#include|def |class |System\.out|std::|print\(|```)/.test(item.text ?? '');

function paragraphBlock(item, heading) {
  const text = clean(item.text);
  if (!text) return null;
  if (item.listType || item.listLabel || /^[•·✓-]\s*/.test(text)) {
    return { type: 'list', ordered: /^\d+[.)]/.test(item.listLabel ?? ''), items: [text.replace(/^[•·✓-]\s*/, '')] };
  }
  if (looksLikeCode(item) || text.includes('\n')) {
    return looksLikeOutput(heading)
      ? { type: 'expected-output', output: text }
      : { type: 'code', code: text };
  }
  if (isHeading(item)) return { type: 'heading', level: Number(item.fontSize) >= 14 ? 3 : 4, text };
  return { type: 'paragraph', text };
}

function tableBlock(item, heading) {
  const rows = (item.rows ?? []).map((row) => row.map(clean));
  if (!rows.length) return null;
  if (rows.every((row) => row.length === 1)) {
    const text = rows.flat().filter(Boolean).join('\n');
    if (!text) return null;
    if (looksLikeOutput(heading)) return { type: 'expected-output', output: text };
    if (/(?:public static void main|#include|def |class |System\.out|std::|print\(|```)/.test(text)) return { type: 'code', code: text };
    return { type: 'paragraph', text };
  }
  const width = Math.max(...rows.map((row) => row.length));
  const columns = rows[0].map((column, index) => column || `Column ${index + 1}`);
  while (columns.length < width) columns.push(`Column ${columns.length + 1}`);
  return { type: 'table', columns, rows: rows.slice(1).map((row) => [...row, ...Array(width - row.length).fill('')]) };
}

function physicalPageItems(document, page) {
  const allItems = [...new Map(document.pages.flatMap((sourcePage) => sourcePage.items).map((item) => [`${item.kind}:${item.start}`, item])).values()];
  return allItems.flatMap((item) => {
    if (item.kind === 'table') {
      const tablePages = document.pages.filter((sourcePage) => sourcePage.items.some((candidate) => candidate.kind === 'table' && candidate.start === item.start));
      if (tablePages.length === 1) return item.start >= page.start && item.start <= page.end ? [item] : [];
      if (!tablePages.some(({ page: number }) => number === page.page)) return [];
      const raw = (item.rows ?? []).map((row) => row.map(clean).join('\t')).join('\n');
      // Word character positions align with the table text except for trailing
      // cell/end markers, so direct range slicing mirrors the physical page.
      const from = Math.max(0, page.start - item.start);
      const to = Math.min(raw.length, page.end - item.start + 1);
      return [{ kind: 'paragraph', start: Math.max(item.start, page.start), text: raw.slice(from, to), font: 'Consolas', fontSize: 10, bold: 0, listType: 0, listLabel: '' }];
    }
    const raw = String(item.text ?? '');
    const itemEnd = item.start + raw.length;
    if (itemEnd < page.start || item.start > page.end) return [];
    const from = Math.max(0, page.start - item.start);
    const to = Math.min(raw.length, page.end - item.start + 1);
    return [{ ...item, text: raw.slice(from, to) }];
  });
}

function buildPage(projectId, page, checkpointCount) {
  const texts = page.items.filter((item) => item.kind === 'paragraph').map((item) => clean(item.text)).filter(Boolean);
  const tableTitle = page.items.find((item) => item.kind === 'table')?.rows?.flat()?.map(clean).find(Boolean)?.split('\n')[0]?.slice(0, 120);
  const paragraphTitle = texts.find((text) => !text.includes('\n') && text.length <= 160);
  const title = paragraphTitle || tableTitle || `Source page ${page.page}`;
  let currentHeading = title;
  const blocks = [];
  let skippedTitle = false;
  for (const item of page.items) {
    if (item.kind === 'paragraph' && !skippedTitle && clean(item.text) === paragraphTitle) { skippedTitle = true; continue; }
    const block = item.kind === 'table' ? tableBlock(item, currentHeading) : paragraphBlock(item, currentHeading);
    if (!block) continue;
    if (block.type === 'heading') currentHeading = block.text;
    const previous = blocks.at(-1);
    if (block.type === 'list' && previous?.type === 'list' && previous.ordered === block.ordered) previous.items.push(...block.items);
    else blocks.push(block);
  }
  const image = imagePages[projectId]?.[page.page];
  if (image) blocks.push({ type: 'image', src: `/assets/projects/guides/${projectId}/${image[0]}`, alt: image[1], caption: image[1] });
  const taskIndex = taskPages[projectId].indexOf(page.page);
  const precedingTask = taskPages[projectId].filter((value) => value <= page.page).length - 1;
  const checkpointIndex = Math.max(0, Math.min(checkpointCount - 1, precedingTask));
  return {
    id: `${projectId}-source-page-${String(page.page).padStart(2, '0')}`,
    sourcePageStart: page.page,
    sourcePageEnd: page.page,
    sourcePages: [page.page],
    title,
    kind: taskIndex >= 0 ? 'task' : 'information',
    checkpointIndex: taskIndex >= 0 ? taskIndex : checkpointIndex,
    checkpointId: taskIndex >= 0 ? `${projectId}-task-${taskIndex + 1}` : null,
    taskId: taskIndex >= 0 ? `${projectId}-task-${taskIndex + 1}` : null,
    blocks,
  };
}

const generated = {};
for (const document of documents) {
  const projectId = projectIds[document.key];
  if (!projectId) continue;
  generated[projectId] = document.pages.map((page) => buildPage(projectId, { ...page, items: physicalPageItems(document, page) }, taskPages[projectId].length));
}

const contracts = Object.fromEntries(Object.entries(generated).map(([projectId, pages]) => [projectId, {
  physicalPageCount: pages.length,
  taskPages: taskPages[projectId],
  mergePolicy: 'one-physical-page-per-guide-page',
  sourceDocument: sourceDocuments[projectId],
  sourceSha256: sourceHashes[projectId],
}]));

const source = `// Generated from Word-paginated authoritative DOCX files. Do not hand-condense.\n`
  + `export const PROJECT_GUIDE_SOURCE_CONTRACTS = Object.freeze(${JSON.stringify(contracts, null, 2)});\n\n`
  + `export const PROJECT_GUIDE_SOURCE_PAGES = Object.freeze(${JSON.stringify(generated, null, 2)});\n\n`
  + `export const sourceGuidePagesFor = (projectId) => PROJECT_GUIDE_SOURCE_PAGES[projectId] ?? [];\n`;
fs.writeFileSync(outputPath, source);
console.log(`Wrote ${outputPath}: ${Object.entries(generated).map(([id, pages]) => `${id}=${pages.length}`).join(', ')}`);
