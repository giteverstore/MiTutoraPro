import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mammoth from 'mammoth';
import { load } from 'cheerio';
import { validateCourseComplexity } from '../src/content/validation/contentLimits.js';

const SOURCE = resolve('JAVA BASICS UPDATED.docx');
const PUBLIC = resolve('public/courses/java-course.json');
const ASSETS = resolve('public/assets/courses/java-basics');
const BUNDLE = resolve('firebase-content/course-content/java/v1');
const FIRESTORE = resolve('firebase-content/firestore/courses/java.json');
const LOCAL_METADATA = resolve('public/courses/course-metadata.json');
const missingAnswerKeys = new Set(['1.4.20', '2.3.5', '5.1.9']);

const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const slug = (value) => clean(value).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'content';
const clone = (value) => JSON.parse(JSON.stringify(value));
const lessonList = (module) => module.sections.flatMap((section) => section.lessons);
const estimate = (blocks) => blocks.some((b) => b.type === 'exercise') ? 12 : blocks.some((b) => b.type === 'quiz') ? 4 : Math.max(4, Math.min(10, Math.ceil(blocks.length * .75)));

await mkdir(ASSETS, { recursive: true });
let imageIndex = 0;
const images = new Map();
const conversion = await mammoth.convertToHtml({ path: SOURCE }, {
  convertImage: mammoth.images.imgElement(async (image) => {
    const bytes = await image.readAsBuffer();
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (images.has(hash)) return { src: images.get(hash) };
    const extension = image.contentType === 'image/jpeg' ? 'jpg' : image.contentType.split('/')[1];
    const name = `java-basics-image-${String(++imageIndex).padStart(2, '0')}.${extension}`;
    await writeFile(resolve(ASSETS, name), bytes);
    const src = `/assets/courses/java-basics/${name}`;
    images.set(hash, src);
    return { src };
  }),
});
if (conversion.messages.some(({ type }) => type === 'error')) throw new Error(conversion.messages.map(({ message }) => message).join('\n'));
const $ = load(conversion.value);
const children = $('body').children().toArray();

function text(node) { const copy = $(node).clone(); copy.find('br').replaceWith('\n'); return clean(copy.text()); }
function lines(node) { return $(node).find('p').toArray().flatMap((p) => text(p).split('\n')).map(clean).filter(Boolean); }
function factory(number) { let index = 0; return (type, value) => ({ id: `java-${number.replaceAll('.', '-')}-${type}-${++index}`, type, ...value }); }
function optionRecords(nodes) {
  const records = [];
  for (const node of nodes) {
    for (const line of text(node).split('\n')) {
      const match = clean(line).match(/^([A-D])\s*:\s*(.*)$/i);
      if (match) records.push({ id: `option-${match[1].toLowerCase()}`, text: clean(match[2]) });
      else if (records.length && !/^Answer\s*:/i.test(line) && clean(line)) records.at(-1).text = clean(`${records.at(-1).text}\n${line}`);
    }
  }
  return records.filter(({ text: value }) => value);
}
function quizBlocks(number, title, nodes, block) {
  const allText = nodes.map(text).join('\n');
  const answer = allText.match(/\bAnswer\s*:\s*([A-D])/i)?.[1]?.toLowerCase();
  const options = optionRecords(nodes);
  const question = nodes.map(text).find((value) => value && !/^Quiz:/i.test(value) && !/^[A-D]\s*:/i.test(value) && !/^Answer\s*:/i.test(value)) || title.replace(/^Quiz:\s*/i, '');
  const supporting = [];
  for (const node of nodes) {
    if ($(node).is('table')) supporting.push(block('code', { language: 'java', code: lines(node).join('\n'), caption: 'Quiz code', mode: 'display' }));
  }
  if (!answer || missingAnswerKeys.has(number)) {
    return [...supporting, block('heading', { level: 3, text: question }), block('paragraph', { content: options.map((o) => `${o.id.slice(-1).toUpperCase()}: ${o.text}`).join('\n'), format: 'markdown' })];
  }
  return [...supporting, block('quiz', { question, selectionMode: 'single', options, correctOptionIds: [`option-${answer}`], submitLabel: 'Check answer' })];
}
function problemBlocks(title, nodes, block) {
  const beforeSolution = []; const solution = []; let target = beforeSolution; let expected = ''; let captureExpected = false; let pendingCaption = '';
  for (const node of nodes) {
    const value = text(node); if (!value && !$(node).find('img').length) continue;
    if (/^Solution$/i.test(value)) { target = solution; captureExpected = false; continue; }
    if (/^Expected Output$/i.test(value)) { captureExpected = true; continue; }
    if (/^(Example|Test Input|Input|Output)$/i.test(value)) { pendingCaption = /^Test Input$/i.test(value) ? 'Input' : value; continue; }
    const image = $(node).find('img').first();
    if (image.length) target.push({ kind: 'image', src: image.attr('src'), caption: value.replace(/^Figure:\s*/i, '') });
    else if ($(node).is('table')) {
      const tableLines = lines(node);
      const embeddedCaption = /^(Expected Output|Output|Test Input|Input)$/i.test(tableLines[0] ?? '') ? tableLines.shift() : '';
      const isExpectedOutput = captureExpected || /^(Expected Output|Output)$/i.test(embeddedCaption);
      const code = tableLines.join('\n');
      if (isExpectedOutput) { expected = code; captureExpected = false; } else target.push({ kind: 'code', code });
      if (!isExpectedOutput) target.at(-1).caption = /^Test Input$/i.test(embeddedCaption) ? 'Input' : embeddedCaption || pendingCaption || 'Example';
      pendingCaption = '';
    } else if ($(node).is('ul, ol')) target.push({ kind: 'text', value: $(node).find('li').toArray().map((li) => `- ${text(li)}`).join('\n') });
    else target.push({ kind: 'text', value });
  }
  const solutionCode = solution.find((item) => item.kind === 'code')?.code ?? '';
  const description = solution.filter((item) => item.kind === 'text' && !/^(How (It|the Solution) Works|Would you like)/i.test(item.value)).map((item) => item.value).join('\n\n');
  const instructions = beforeSolution.filter((item) => item.kind === 'text' && !/^(Problem|Example|Expected Output)$/i.test(item.value)).map((item) => item.value).join('\n\n');
  const starter = `class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}`;
  const input = beforeSolution.filter((item) => item.kind === 'code' && /^Input$/i.test(item.caption)).map((item) => item.code).join('\n');
  const examples = beforeSolution.filter((item) => item.kind === 'code' && /^Example$/i.test(item.caption));
  if (!expected && examples.length === 1) expected = examples[0].code;
  const validation = /Cube Root/i.test(title)
    ? { type: 'numeric_tolerance', tolerance: 1e-9 }
    : /Random Lucky Number/i.test(title)
      ? { type: 'integer_range', min: 1, max: 50 }
      : { type: 'normalized_output' };
  const blocks = [
    block('exercise', { title, instructions: { content: instructions || title, format: 'markdown' }, objectives: [instructions.split('\n')[0] || title], difficulty: 'easy', starterFiles: [{ name: 'Main.java', content: starter }], actionLabel: 'Start exercise' }),
    block('compiler', { language: 'java', runtime: 'teavm', files: [{ name: 'Main.java', content: starter }], activeFile: 'Main.java', stdin: input, expectedOutput: expected, execution: { mode: 'program', mainClass: 'Main' }, timeoutMs: 10000, validation, runLabel: 'Run code', resetLabel: 'Reset starter code' }),
  ];
  for (const image of [...beforeSolution, ...solution].filter((item) => item.kind === 'image')) blocks.push(block('image', { src: image.src, alt: image.caption || `${title} figure`, caption: image.caption, loading: 'lazy' }));
  for (const example of beforeSolution.filter((item) => item.kind === 'code')) blocks.push(block('code', { language: 'text', code: example.code, caption: example.caption, mode: 'display' }));
  if (expected) blocks.push(block('code', { language: 'text', code: expected, caption: 'Expected Output', mode: 'display' }));
  if (solutionCode) blocks.push(block('solution', { title: 'View solution', description, language: 'java', code: solutionCode }));
  return blocks;
}
function standardBlocks(nodes, block) {
  const blocks = []; let caption = '';
  for (const node of nodes) {
    const value = text(node); const image = $(node).find('img').first();
    if (image.length) { blocks.push(block('image', { src: image.attr('src'), alt: value.replace(/^Figure:\s*/i, '') || 'Java course figure', caption: value, loading: 'lazy' })); continue; }
    if (!value) continue;
    if ($(node).is('ul, ol')) { blocks.push(block('paragraph', { content: $(node).find('li').toArray().map((li) => `- ${text(li)}`).join('\n'), format: 'markdown' })); continue; }
    if (/^(Example|Output|Expected Output)$/i.test(value)) { caption = value; continue; }
    if ($(node).is('table')) { const output = /output/i.test(caption) || /^Output/i.test(lines(node)[0] ?? ''); blocks.push(block('code', { language: output ? 'text' : 'java', code: lines(node).filter((line) => !/^(Expected )?Output$/i.test(line)).join('\n'), caption: caption || (output ? 'Output' : 'Example'), mode: 'display' })); caption = ''; continue; }
    if (/^Note:/i.test(value)) {
      const content = value.replace(/^Note:\s*/i, '');
      blocks.push(content ? block('note', { title: 'Note', content, format: 'plain' }) : block('heading', { level: 3, text: value }));
    } else if (/^(Warning|Important|Remember):/i.test(value)) {
      const separator = value.indexOf(':');
      const title = value.slice(0, separator);
      const content = value.slice(separator + 1).trim();
      blocks.push(content ? block('warning', { title, content, format: 'plain' }) : block('heading', { level: 3, text: value }));
    }
    else if ($(node).find('strong').length && value.length < 100) blocks.push(block('heading', { level: 3, text: value }));
    else blocks.push(block('paragraph', { content: value, format: 'plain' }));
  }
  return blocks;
}

const modules = []; let currentModule; let currentSection;
for (let index = 0; index < children.length; index += 1) {
  const marker = text(children[index]);
  const chapter = marker.match(/^CHAPTER\s+(\d+)\s*:\s*(.+)$/i);
  if (chapter) { currentModule = { id: `module-${chapter[1]}-${slug(chapter[2])}`, title: `CH ${chapter[1]}: ${clean(chapter[2])}`, description: '', initiallyExpanded: chapter[1] === '1', sections: [] }; modules.push(currentModule); currentSection = null; continue; }
  const section = marker.match(/^(\d+\.\d+)\s*:\s*(.+)$/);
  if (section) { currentSection = { id: `section-${section[1].replace('.', '-')}-${slug(section[2])}`, title: `${section[1]} ${clean(section[2])}`, description: '', initiallyExpanded: section[1] === '1.1', lessons: [] }; currentModule?.sections.push(currentSection); continue; }
  const lesson = marker.match(/^(\d+\.\d+\.\d+)\s*:\s*(.+)$/);
  if (!lesson || !currentSection) continue;
  const nodes = [];
  for (let cursor = index + 1; cursor < children.length; cursor += 1) { const next = text(children[cursor]); if (/^(?:CHAPTER\s+\d+|\d+\.\d+(?:\.\d+)?)\s*:/i.test(next)) break; nodes.push(children[cursor]); }
  const block = factory(lesson[1]); const title = clean(lesson[2]);
  const isQuiz = /quiz/i.test(title); const isProblem = !/^Problem with the Code$/i.test(title) && (/^(?:Problem|Practice)\b/i.test(title) || nodes.some((node) => /^Problem Description$/i.test(text(node))));
  const blocks = isQuiz ? quizBlocks(lesson[1], title, nodes, block) : isProblem ? problemBlocks(title, nodes, block) : standardBlocks(nodes, block);
  currentSection.lessons.push({ id: `java-lesson-${lesson[1].replaceAll('.', '-')}-${slug(title)}`, number: lesson[1], title, summary: blocks.find((b) => b.content)?.content?.slice(0, 240) || title, status: 'available', estimatedMinutes: estimate(blocks), tags: [slug(currentSection.title)], blocks });
}

const lessons = modules.flatMap(lessonList); const estimatedMinutes = lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0);
const course = { $schema: '../../schemas/learning-course.schema.json', schemaVersion: '1.0.0', id: 'java', slug: 'java', title: 'Java Basics', description: 'Build a practical Java foundation through structured explanations, examples, quizzes, and programming problems.', locale: 'en-US', status: 'published', metadata: { version: '1.0.0', authors: [{ name: 'MI Tutora' }], level: 'beginner', estimatedMinutes, tags: ['java', 'programming', 'fundamentals'], updatedAt: '2026-08-21T00:00:00.000Z' }, navigation: { defaultLessonId: lessons[0].id, sequence: 'module-order', skipLockedLessons: true, labels: { previous: 'Previous lesson', next: 'Next lesson', progress: 'Course progress', currentLesson: 'Current lesson' } }, modules };
validateCourseComplexity(course);
await writeFile(PUBLIC, `${JSON.stringify(course, null, 2)}\n`);
await mkdir(BUNDLE, { recursive: true });
for (let i = 0; i < modules.length; i++) await writeFile(resolve(BUNDLE, `module-${i + 1}.json`), `${JSON.stringify(modules[i], null, 2)}\n`);
const outline = { ...clone(course), modules: clone(modules).map((module) => ({ ...module, sections: module.sections.map((section) => ({ ...section, lessons: section.lessons.map((lesson) => ({ ...lesson, blocks: [] })) })) })), moduleFiles: modules.map((_, i) => `module-${i + 1}.json`) };
await writeFile(resolve(BUNDLE, 'course.json'), `${JSON.stringify(outline, null, 2)}\n`);
const metadata = { id: 'java', slug: 'java', title: course.title, description: course.description, thumbnail: imageIndex ? '/assets/courses/java-basics/java-basics-image-01.png' : '', language: 'java', domain: 'programming', difficulty: 'beginner', estimatedMinutes, moduleCount: modules.length, lessonCount: lessons.length, published: true, version: 'v1', storagePath: 'course-content/java' };
await mkdir(resolve('firebase-content/firestore/courses'), { recursive: true }); await writeFile(FIRESTORE, `${JSON.stringify(metadata, null, 2)}\n`);
const local = JSON.parse(await readFile(LOCAL_METADATA, 'utf8')); local.courses = [...local.courses.filter(({ id }) => id !== 'java'), { id: 'java', title: course.title, description: course.description, version: '1.0.0', source: '/courses/java-course.json' }]; await writeFile(LOCAL_METADATA, `${JSON.stringify(local, null, 2)}\n`);
console.log(JSON.stringify({ modules: modules.length, sections: modules.reduce((n, m) => n + m.sections.length, 0), lessons: lessons.length, quizzes: lessons.filter((l) => l.blocks.some((b) => b.type === 'quiz')).length, sourceQuizLessons: lessons.filter((l) => /quiz/i.test(l.title)).length, exercises: lessons.filter((l) => l.blocks.some((b) => b.type === 'exercise')).length, codeBlocks: lessons.flatMap((l) => l.blocks).filter((b) => b.type === 'code' && b.language === 'java').length, solutions: lessons.flatMap((l) => l.blocks).filter((b) => b.type === 'solution').length, assets: imageIndex, estimatedMinutes, missingAnswerKeys: [...missingAnswerKeys] }, null, 2));
